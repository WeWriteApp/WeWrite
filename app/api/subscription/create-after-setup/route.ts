import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserEmailFromId } from '../../auth-helper';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { subscriptionAuditService } from '../../../services/subscriptionAuditService';
import { SubscriptionValidationService } from '../../../services/subscriptionValidationService';
import { invalidateCache } from '../../../utils/internalApi';
import Stripe from 'stripe';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2025-06-30.basil',
});

export async function POST(request: NextRequest) {
  try {
    // Get user ID from the authentication system
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, setupIntentId } = await request.json();

    if (!userId || !amount || amount <= 0 || !setupIntentId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Get the setup intent to retrieve the customer and payment method
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    
    if (!setupIntent.customer || !setupIntent.payment_method) {
      return NextResponse.json({ error: 'Setup intent not properly configured' }, { status: 400 });
    }

    const customerId = setupIntent.customer as string;
    const paymentMethodId = setupIntent.payment_method as string;

    // Create price for the amount
    const price = await stripe.prices.create({
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      product_data: {
        name: `WeWrite Account Funding - $${amount}/month`,
      },
    });

    // Check if customer already has active subscriptions
    const existingCheck = await SubscriptionValidationService.checkForExistingSubscriptions(customerId);
    const validationError = SubscriptionValidationService.validateSubscriptionCreation(existingCheck);

    if (validationError) {
      SubscriptionValidationService.logValidationEvent('DUPLICATE_SUBSCRIPTION_PREVENTED', {
        userId,
        customerId,
        setupIntentId,
        existingSubscriptionId: validationError.existingSubscriptionId
      });

      return NextResponse.json(validationError, { status: validationError.statusCode });
    }

    // Create subscription with the payment method from setup intent
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const transferGroup = `subscription_${userId}_${currentMonth}`;

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      default_payment_method: paymentMethodId,
      payment_behavior: 'error_if_incomplete',
      payment_settings: {
        payment_method_types: ['card', 'link'],
        save_default_payment_method: 'on_subscription'
      },
      metadata: {
        userId: userId,
        amount: amount.toString(),
        transferGroup, // For tracking funds without immediate transfer
        fundHoldingModel: 'platform_account', // Indicate new model
        subscriptionType: 'monthly_funding'
      },
      expand: ['latest_invoice.payment_intent']
    });

    // Save subscription to Firestore
    const admin = getFirebaseAdmin();
    const adminDb = admin.firestore();

    const subscriptionData = {
      id: 'current',
      userId: userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripePriceId: price.id,
      status: subscription.status,
      amount: amount,
      currency: 'usd',
      interval: 'month',
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: subscription.current_period_start
        ? admin.firestore.Timestamp.fromDate(new Date(subscription.current_period_start * 1000))
        : admin.firestore.FieldValue.serverTimestamp(),
      currentPeriodEnd: subscription.current_period_end
        ? admin.firestore.Timestamp.fromDate(new Date(subscription.current_period_end * 1000))
        : admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const collectionName = getCollectionName('users');
    const subscriptionRef = adminDb
      .collection(collectionName)
      .doc(userId)
      .collection(getCollectionName('subscriptions'))
      .doc('current');

    await subscriptionRef.set(subscriptionData);

    // Invalidate subscription cache to ensure fresh data is returned
    // SECURITY: Uses validated internal API URL to prevent SSRF
    await invalidateCache('/api/account-subscription', { action: 'invalidate-cache', userId });

    console.log(`[CREATE AFTER SETUP] Successfully created subscription ${subscription.id} for user ${userId} with status: ${subscription.status}`);

    // Validate subscription status
    SubscriptionValidationService.validateSubscriptionStatus(subscription, 'active');

    // Log subscription creation for audit trail
    try {
      await subscriptionAuditService.logSubscriptionCreated(userId, subscriptionData, {
        source: 'user',
        correlationId: `setup_intent_${setupIntentId}_${Date.now()}`,
        metadata: {
          amount: amount.toString(),
          setupIntentId,
          stripeSubscriptionId: subscription.id,
          paymentMethodId: setupIntent.payment_method
        }
      });
      console.log(`[CREATE AFTER SETUP] ✅ Logged subscription creation to audit trail`);
    } catch (auditError) {
      console.warn('[CREATE AFTER SETUP] Failed to log audit event:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status
    });

  } catch (error) {
    console.error('Error creating subscription after setup:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription after setup' },
      { status: 500 }
    );
  }
}
