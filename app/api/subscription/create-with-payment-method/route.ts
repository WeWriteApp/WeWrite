/**
 * Create Subscription with Payment Method
 *
 * Creates subscription after payment method setup is complete
 * Updated to work with USD-based system instead of tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { determineTierFromAmount, calculateTokensForAmount } from '../../../utils/subscriptionTiers';
import { getEffectiveUsdTier, dollarsToCents } from '../../../utils/usdConstants';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { subscriptionAuditService } from '../../../services/subscriptionAuditService';
import { SubscriptionAnalyticsService } from '../../../services/subscriptionAnalyticsService';
import { ServerUsdService } from '../../../services/usdService.server';

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

    // Generate a shared correlation ID for all related audit events
    const subscriptionCorrelationId = `subscription_creation_${Date.now()}_${userId}`;

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
    let customerId = userData?.stripeCustomerId;

    // Verify customer exists in Stripe (handle deleted customers)
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
        console.log(`[CREATE SUBSCRIPTION] Verified existing Stripe customer ${customerId} for user ${userId}`);
      } catch (error) {
        console.warn(`[CREATE SUBSCRIPTION] Stripe customer ${customerId} not found, will create new one:`, error.message);
        customerId = null; // Force creation of new customer
      }
    }

    // Create new customer if needed
    if (!customerId) {
      if (!userData) {
        return NextResponse.json({
          error: 'User not found in database'
        }, { status: 404 });
      }

      const username = userData.username || 'Unknown User';
      const email = userData.email || `${userId}@wewrite.dev`;

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: email,
        description: `WeWrite user ${username} (${userId})`,
        metadata: {
          firebaseUID: userId,
          username: username,
          environment: process.env.NODE_ENV || 'development'
        }
      });

      customerId = customer.id;

      // Save customer ID to Firestore using environment-aware collection
      await adminDb.collection(getCollectionName('users')).doc(userId).set({
        stripeCustomerId: customerId
      }, { merge: true });

      // Log customer creation/recreation for audit trail
      const isRecreation = !!userData?.stripeCustomerId;
      await subscriptionAuditService.logEvent({
        userId,
        eventType: isRecreation ? 'subscription_updated' : 'subscription_created',
        description: isRecreation
          ? `Stripe customer recreated during subscription creation (previous customer deleted)`
          : `Stripe customer created for subscription`,
        entityType: 'subscription',
        entityId: customerId,
        afterState: {
          stripeCustomerId: customerId,
          email,
          username
        },
        metadata: {
          stripeCustomerId: customerId,
          email,
          username,
          isRecreation,
          reason: isRecreation ? 'Previous customer deleted from Stripe' : 'New customer for subscription',
          tier,
          amount
        },
        source: 'system',
        correlationId: subscriptionCorrelationId,
        severity: isRecreation ? 'warning' : 'info'
      });

      console.log(`[CREATE SUBSCRIPTION] ${isRecreation ? 'Recreated' : 'Created'} Stripe customer ${customerId} for user ${userId}`);
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
        usdAmount: amount.toString(),
        usdCents: dollarsToCents(amount).toString(),
        // Legacy token metadata for backward compatibility
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
        usdAmount: amount.toString(),
        usdCents: dollarsToCents(amount).toString(),
        // Legacy token metadata for backward compatibility
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

    // Initialize user's USD balance directly to avoid internal API call issues
    if (subscription.status === 'active') {
      console.log(`[CREATE SUBSCRIPTION] Updating USD allocation directly...`);
      try {
        // Initialize USD balance using the new USD service
        await ServerUsdService.updateMonthlyUsdAllocation(userId, amount);
        console.log(`[CREATE SUBSCRIPTION] Successfully updated USD allocation: $${amount}`);

        // Also maintain backward compatibility with token system during migration
        console.log(`[CREATE SUBSCRIPTION] Maintaining token system compatibility...`);
        try {
          const { ServerTokenService } = await import('../../../services/tokenService.server');
          await ServerTokenService.updateMonthlyTokenAllocation(userId, amount);
          console.log(`[CREATE SUBSCRIPTION] Successfully updated legacy token allocation`);

          // Convert unfunded tokens to funded tokens (legacy support)
          const convertResult = await ServerTokenService.convertUnfundedTokens(userId);
          console.log(`[CREATE SUBSCRIPTION] Successfully converted ${convertResult.convertedCount} unfunded token allocations`);
        } catch (tokenError) {
          console.warn(`[CREATE SUBSCRIPTION] Error with legacy token system:`, tokenError);
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
        correlationId: subscriptionCorrelationId,
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
