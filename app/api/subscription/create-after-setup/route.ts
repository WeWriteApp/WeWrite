import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserEmailFromId } from '../../auth-helper';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
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

    // Create subscription with the payment method from setup intent
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      default_payment_method: paymentMethodId,
      metadata: {
        userId: userId,
        amount: amount.toString(),
      },
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

    console.log(`[CREATE AFTER SETUP] Successfully created subscription ${subscription.id} for user ${userId}`);

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
