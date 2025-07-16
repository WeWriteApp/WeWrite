/**
 * Create Subscription with Payment Method
 * 
 * Creates subscription after payment method setup is complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { determineTierFromAmount, calculateTokensForAmount } from '../../../utils/subscriptionTiers';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { subscriptionAuditService } from '../../../services/subscriptionAuditService';

// Initialize Firebase Admin
const admin = initAdmin();
const adminDb = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { paymentMethodId, tier, amount, tierName, tokens } = body;

    if (!paymentMethodId || !amount || !tier) {
      return NextResponse.json({ 
        error: 'paymentMethodId, amount, and tier are required' 
      }, { status: 400 });
    }

    console.log(`[CREATE SUBSCRIPTION] Creating subscription for user ${userId}, tier: ${tier}, amount: $${amount}`);

    // Force recompilation after serverTimestamp fix

    // Get user's Stripe customer ID using environment-aware collection
    const userDoc = await adminDb.collection(getCollectionName('users')).doc(userId).get();
    const userData = userDoc.data();
    const customerId = userData?.stripeCustomerId;

    if (!customerId) {
      return NextResponse.json({ 
        error: 'No Stripe customer found for user' 
      }, { status: 400 });
    }

    // Create or get product for subscriptions
    let product;
    try {
      // Try to get existing WeWrite subscription product
      const products = await stripe.products.list({ limit: 10 });
      product = products.data.find(p => p.name === 'WeWrite Subscription');
      
      if (!product) {
        // Create new product
        product = await stripe.products.create({
          name: 'WeWrite Subscription',
          description: 'Monthly subscription to WeWrite platform',
          type: 'service'
        });
      }
    } catch (error) {
      console.error('Error handling product:', error);
      return NextResponse.json({ 
        error: 'Failed to setup subscription product' 
      }, { status: 500 });
    }

    // Create price for this subscription amount
    const price = await stripe.prices.create({
      unit_amount: amount * 100, // Convert to cents
      currency: 'usd',
      recurring: { interval: 'month' },
      product: product.id,
      metadata: {
        tier,
        tokens: tokens?.toString() || (amount * 10).toString()
      }
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      default_payment_method: paymentMethodId,
      metadata: {
        userId,
        tier,
        tierName: tierName || tier,
        tokens: tokens?.toString() || (amount * 10).toString()
      },
      expand: ['latest_invoice.payment_intent']
    });

    console.log(`[CREATE SUBSCRIPTION] Created Stripe subscription ${subscription.id} for user ${userId}`);

    // Extract period timestamps from subscription items (Stripe stores them there)
    const subscriptionItem = subscription.items?.data?.[0];
    if (!subscriptionItem) {
      throw new Error('No subscription items found in Stripe subscription');
    }

    console.log(`[CREATE SUBSCRIPTION] Subscription item periods:`, {
      current_period_start: subscriptionItem.current_period_start,
      current_period_end: subscriptionItem.current_period_end,
      start_type: typeof subscriptionItem.current_period_start,
      end_type: typeof subscriptionItem.current_period_end,
      status: subscription.status
    });

    const startTimestamp = subscriptionItem.current_period_start;
    const endTimestamp = subscriptionItem.current_period_end;

    if (!startTimestamp || !endTimestamp || isNaN(startTimestamp) || isNaN(endTimestamp)) {
      throw new Error(`Invalid timestamps from Stripe: start=${startTimestamp}, end=${endTimestamp}`);
    }

    const startDate = new Date(startTimestamp * 1000);
    const endDate = new Date(endTimestamp * 1000);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error(`Invalid dates after conversion: start=${startDate}, end=${endDate}`);
    }

    console.log(`[CREATE SUBSCRIPTION] Converted dates:`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // Save subscription to Firestore
    const finalTier = tier || determineTierFromAmount(amount);
    const finalTokens = tokens || calculateTokensForAmount(amount);

    const subscriptionData = {
      id: 'current',
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripePriceId: price.id,
      status: subscription.status,
      tier: finalTier,
      amount,
      tokens: finalTokens,
      currency: 'usd',
      interval: 'month',
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    console.log(`[CREATE SUBSCRIPTION] Subscription data to save:`, {
      ...subscriptionData,
      currentPeriodStart: subscriptionData.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscriptionData.currentPeriodEnd.toISOString(),
      createdAt: 'FieldValue.serverTimestamp()',
      updatedAt: 'FieldValue.serverTimestamp()'
    });

    // Save subscription via API (following API-first architecture)
    console.log(`[CREATE SUBSCRIPTION] Saving subscription via API...`);
    const saveResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/subscription/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '', // Forward auth cookies
      },
      body: JSON.stringify(subscriptionData)
    });

    if (!saveResponse.ok) {
      const errorText = await saveResponse.text();
      throw new Error(`Failed to save subscription: ${saveResponse.status} ${errorText}`);
    }

    console.log(`[CREATE SUBSCRIPTION] Successfully saved subscription via API`);

    // Initialize user's token balance via API (following API-first architecture)
    if (subscription.status === 'active') {
      console.log(`[CREATE SUBSCRIPTION] Updating token allocation via API...`);
      const tokenResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tokens/update-allocation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '', // Forward auth cookies
        },
        body: JSON.stringify({
          userId,
          monthlyTokens: finalTokens
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.warn(`[CREATE SUBSCRIPTION] Failed to update token allocation: ${tokenResponse.status} ${errorText}`);
        // Don't throw here - subscription was created successfully, token update is secondary
      } else {
        console.log(`[CREATE SUBSCRIPTION] Successfully updated token allocation via API`);
      }
    }

    console.log(`[CREATE SUBSCRIPTION] Successfully created subscription for user ${userId}, status: ${subscription.status}`);

    // Log subscription creation for audit trail
    try {
      await subscriptionAuditService.logSubscriptionCreated(userId, subscriptionData, {
        source: 'user',
        correlationId: `create_${subscription.id}`,
        metadata: {
          tier,
          tierName,
          tokens: finalTokens,
          stripeSubscriptionId: subscription.id,
          paymentMethodId
        }
      });
    } catch (auditError) {
      console.warn('[CREATE SUBSCRIPTION] Failed to log audit event:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      subscription: subscriptionData
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to create subscription.' },
    { status: 405 }
  );
}
