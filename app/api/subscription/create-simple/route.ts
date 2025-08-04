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

    // Customer has payment method - create subscription directly
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      default_payment_method: paymentMethods.data[0].id,
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
