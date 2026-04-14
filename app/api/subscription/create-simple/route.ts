import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserEmailFromId } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { subscriptionAuditService } from '../../../services/subscriptionAuditService';
import { SubscriptionValidationService } from '../../../services/subscriptionValidationService';
import { invalidateCache } from '../../../utils/internalApi';
import { getStripe } from '../../../lib/stripe';
import { getOrCreateStripeCustomer } from '../../../lib/stripeCustomer';

const stripe = getStripe();

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

    // Get or create Stripe customer (with deduplication)
    // Initialize Firebase Admin early since getOrCreateStripeCustomer needs the db
    const admin = getFirebaseAdmin();
    const adminDb = admin.firestore();

    const { customerId } = await getOrCreateStripeCustomer({
      userId,
      email: userEmail,
      db: adminDb,
    });

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
      customer: customerId,
      type: 'card',
    });

    if (paymentMethods.data.length === 0) {
      // No payment method - create setup intent for payment method collection
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
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
        customerId,
        setupIntentId: setupIntent.id
      });
    }

    // Check if customer already has active subscriptions
    const existingCheck = await SubscriptionValidationService.checkForExistingSubscriptions(customerId);
    const validationError = SubscriptionValidationService.validateSubscriptionCreation(existingCheck);

    if (validationError) {
      SubscriptionValidationService.logValidationEvent('DUPLICATE_SUBSCRIPTION_PREVENTED', {
        userId,
        customerId,
        existingSubscriptionId: validationError.existingSubscriptionId
      });

      return NextResponse.json(validationError, { status: validationError.statusCode });
    }

    // Customer has payment method and no existing subscription - create subscription directly
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const transferGroup = `subscription_${userId}_${currentMonth}`;

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
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

    // Validate subscription status (may be incomplete until payment succeeds)
    SubscriptionValidationService.validateSubscriptionStatus(subscription, 'active');

    // Save subscription to Firestore
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
    } catch (auditError) {
      console.warn('[CREATE SIMPLE] Failed to log audit event:', auditError);
      // Don't fail the request if audit logging fails
    }

    // Do not allocate funds here; wait for payment success webhook

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
