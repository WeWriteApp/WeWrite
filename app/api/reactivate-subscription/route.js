import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '../../firebase/auth';
import { updateSubscription } from '../../firebase/subscription';
import { getStripeSecretKey } from '../../utils/stripeConfig';

export async function POST(request) {
  try {
    // Initialize Stripe with the appropriate key based on environment
    const stripeSecretKey = getStripeSecretKey();
    const stripe = new Stripe(stripeSecretKey);
    console.log('Stripe initialized for reactivating subscription');

    // Get request body
    const body = await request.json();
    const { userId, amount } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Verify the authenticated user
    let user = auth.currentUser;

    // Log authentication state for debugging
    console.log('Auth state:', {
      currentUser: user ? { uid: user.uid, email: user.email } : null,
      requestedUserId: userId
    });

    // Ensure the user is authenticated and the userId matches
    if (!user || user.uid !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Round amount to 2 decimal places
    const amountFloat = Math.round(parseFloat(amount) * 100) / 100;

    // Determine tier based on amount
    let tier = null;
    if (amountFloat >= 10 && amountFloat < 20) {
      tier = 'tier1';
    } else if (amountFloat >= 20 && amountFloat < 50) {
      tier = 'tier2';
    } else if (amountFloat >= 50 && amountFloat < 100) {
      tier = 'tier3';
    } else if (amountFloat >= 100) {
      tier = 'tier4';
    } else {
      return NextResponse.json(
        { error: 'Invalid amount for subscription tier' },
        { status: 400 }
      );
    }

    // Create a customer in Stripe if they don't exist yet
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customer;

    if (customers.data.length === 0) {
      customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          firebaseUID: userId
        }
      });
    } else {
      customer = customers.data[0];
    }

    // Create the price
    const price = await stripe.prices.create({
      unit_amount: Math.round(amountFloat * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      product_data: {
        name: `WeWrite Monthly Subscription - $${amountFloat}`,
      },
    });

    // Create the subscription in Stripe
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price: price.id,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        firebaseUID: userId,
        amount: amountFloat.toString(),
        tier: tier
      }
    });

    // Get the client secret for the payment intent
    const clientSecret = subscription.latest_invoice.payment_intent.client_secret;

    // Update the subscription in Firestore
    await updateSubscription(userId, {
      stripeCustomerId: customer.id,
      stripePriceId: price.id,
      stripeSubscriptionId: subscription.id,
      status: 'pending', // Will be updated by webhook when payment is complete
      amount: amountFloat,
      tier: tier,
      pledgedAmount: 0,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      clientSecret,
      subscriptionId: subscription.id
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
