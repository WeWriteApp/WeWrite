import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserEmailFromId } from '../../auth-helper';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { subscriptionAuditService } from '../../../services/subscriptionAuditService';
import { SubscriptionValidationService } from '../../../services/subscriptionValidationService';
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

    const { amount } = await request.json();

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Get user email - handles development vs production users
    const userEmail = await getUserEmailFromId(userId);
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    // Create or get customer
    let customer: Stripe.Customer;
    try {
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            userId: userId,
          },
        });
      }
    } catch (error) {
      console.error('Error creating/finding customer:', error);
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }

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

    // Check if customer has a default payment method
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card',
    });

    if (paymentMethods.data.length === 0) {
      // No payment method - create setup intent for payment method collection
      const setupIntent = await stripe.setupIntents.create({
        customer: customer.id,
        // STRIPE LINK: Add Link support along with card payments
        payment_method_types: ['card', 'link'],
        usage: 'off_session',
        metadata: {
          userId: userId,
          amount: amount.toString(),
          flow: 'subscription_creation'
        }
      });

      return NextResponse.json({
        requiresPaymentMethod: true,
        clientSecret: setupIntent.client_secret,
        customerId: customer.id,
        setupIntentId: setupIntent.id
      });
    }

    // Check if customer already has active subscriptions
    const existingCheck = await SubscriptionValidationService.checkForExistingSubscriptions(customer.id);
    const validationError = SubscriptionValidationService.validateSubscriptionCreation(existingCheck);

    if (validationError) {
      SubscriptionValidationService.logValidationEvent('DUPLICATE_SUBSCRIPTION_PREVENTED', {
        userId,
        customerId: customer.id,
        existingSubscriptionId: validationError.existingSubscriptionId
      });

      return NextResponse.json(validationError, { status: validationError.statusCode });
    }

    // Customer has payment method and no existing subscription - create subscription directly
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const transferGroup = `subscription_${userId}_${currentMonth}`;

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      default_payment_method: paymentMethods.data[0].id,
      payment_behavior: 'error_if_incomplete',
      payment_settings: {
        payment_method_types: ['card', 'link'],
        save_default_payment_method: 'on_subscription'
      },
      metadata: {
        userId: userId,
        amount: amount.toString(),
        transferGroup,
        fundHoldingModel: 'platform_account',
        subscriptionType: 'monthly_funding'
      },
      expand: ['latest_invoice.payment_intent']
    });

    console.log(`[CREATE SIMPLE] Successfully created subscription ${subscription.id} for user ${userId} with status: ${subscription.status}`);

    // Validate subscription status
    SubscriptionValidationService.validateSubscriptionStatus(subscription, 'active');

    // Save subscription to Firestore
    const admin = getFirebaseAdmin();
    const adminDb = admin.firestore();

    const subscriptionData = {
      id: 'current',
      userId: userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customer.id,
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
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/account-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalidate-cache', userId })
      });
    } catch (cacheError) {
      console.warn('Failed to invalidate subscription cache:', cacheError);
      // Don't fail the subscription creation if cache invalidation fails
    }

    // Log subscription creation for audit trail
    try {
      await subscriptionAuditService.logSubscriptionCreated(userId, subscriptionData, {
        source: 'user',
        correlationId: `simple_subscription_${Date.now()}_${userId}`,
        metadata: {
          amount: amount.toString(),
          stripeSubscriptionId: subscription.id,
          paymentMethodId: paymentMethods.data[0].id,
          flow: 'existing_payment_method'
        }
      });
      console.log(`[CREATE SIMPLE] ✅ Logged subscription creation to audit trail`);
    } catch (auditError) {
      console.warn('[CREATE SIMPLE] Failed to log audit event:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
