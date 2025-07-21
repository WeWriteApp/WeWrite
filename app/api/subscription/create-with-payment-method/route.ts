/**
 * Create Subscription with Payment Method
 * 
 * Creates subscription after payment method setup is complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { determineTierFromAmount, calculateTokensForAmount } from '../../../utils/subscriptionTiers';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { subscriptionAuditService } from '../../../services/subscriptionAuditService';
import { SubscriptionAnalyticsService } from '../../../services/subscriptionAnalyticsService';

// Initialize Firebase Admin
const admin = initAdmin();
const adminDb = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export async function POST(request: NextRequest) {
  try {
    // Environment validation
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[CREATE SUBSCRIPTION] Missing STRIPE_SECRET_KEY environment variable');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

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

    console.log(`[CREATE SUBSCRIPTION] Creating subscription for user ${userId}, tier: ${tier}, amount: $${amount}`, {
      environment: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      timestamp: new Date().toISOString()
    });

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

    // Save subscription directly to avoid internal API call issues in production
    console.log(`[CREATE SUBSCRIPTION] Saving subscription directly to Firestore...`);
    try {
      const { parentPath, subCollectionName } = getSubCollectionPath(
        PAYMENT_COLLECTIONS.USERS,
        userId,
        PAYMENT_COLLECTIONS.SUBSCRIPTIONS
      );

      console.log(`[CREATE SUBSCRIPTION] Firestore path:`, {
        parentPath,
        subCollectionName,
        fullPath: `${parentPath}/${subCollectionName}/current`
      });

      // Save to Firestore directly
      const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
      await subscriptionRef.set({
        ...subscriptionData,
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`[CREATE SUBSCRIPTION] Successfully saved subscription to Firestore`);
    } catch (saveError) {
      console.error(`[CREATE SUBSCRIPTION] Error saving subscription:`, saveError);
      throw new Error(`Failed to save subscription: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
    }

    // Initialize user's token balance directly to avoid internal API call issues
    if (subscription.status === 'active') {
      console.log(`[CREATE SUBSCRIPTION] Updating token allocation directly...`);
      try {
        // Import ServerTokenService dynamically to avoid circular dependencies
        const { ServerTokenService } = await import('../../../services/tokenService.server');
        await ServerTokenService.updateMonthlyTokenAllocation(userId, finalTokens);
        console.log(`[CREATE SUBSCRIPTION] Successfully updated token allocation`);

        // Convert unfunded tokens to funded tokens
        console.log(`[CREATE SUBSCRIPTION] Converting unfunded tokens to funded tokens...`);
        try {
          const convertResult = await ServerTokenService.convertUnfundedTokens(userId);
          console.log(`[CREATE SUBSCRIPTION] Successfully converted ${convertResult.convertedCount} unfunded token allocations`);
        } catch (convertError) {
          console.warn(`[CREATE SUBSCRIPTION] Error converting unfunded tokens:`, convertError);
          // Don't fail subscription creation if token conversion fails
        }
      } catch (tokenError) {
        console.warn(`[CREATE SUBSCRIPTION] Failed to update token allocation:`, tokenError);
        // Don't throw here - subscription was created successfully, token update is secondary
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

    // Track subscription completion analytics
    try {
      await SubscriptionAnalyticsService.trackSubscriptionCompleted(
        userId,
        subscription.id,
        tier,
        amount,
        finalTokens,
        {
          tierName,
          paymentMethodId,
          source: 'subscription_checkout'
        }
      );
    } catch (analyticsError) {
      console.warn('[CREATE SUBSCRIPTION] Failed to track subscription analytics:', analyticsError);
      // Don't fail the request if analytics tracking fails
    }

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      subscription: subscriptionData
    });

  } catch (error) {
    console.error('[CREATE SUBSCRIPTION] Critical error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      tier,
      amount,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create subscription',
        timestamp: new Date().toISOString(),
        correlationId: `create_subscription_${Date.now()}`
      },
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
