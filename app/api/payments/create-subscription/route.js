import Stripe from 'stripe';
import { NextResponse } from 'next/server';

// Log key presence without exposing the full key
const stripeKey = process.env.STRIPE_SECRET_KEY;
console.log('Stripe key status:', {
  exists: !!stripeKey,
  length: stripeKey?.length,
  prefix: stripeKey?.substring(0, 7),
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { customerId, priceId } = await request.json();
    console.log('Received request with:', { customerId, priceId });

    if (!customerId) {
      console.log('Missing customerId in request');
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Log environment variables status (safely)
    console.log('Environment variables status:', {
      hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
      hasPriceId: !!process.env.STRIPE_PRICE_ID,
      priceIdUsed: priceId || process.env.STRIPE_PRICE_ID,
    });

    console.log('Creating subscription for:', {
      customer: customerId,
      price: priceId || process.env.STRIPE_PRICE_ID,
    });

    // Create the subscription with Stripe
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: priceId || process.env.STRIPE_PRICE_ID,
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    console.log('Subscription created:', {
      id: subscription.id,
      status: subscription.status,
      hasPaymentIntent: !!subscription.latest_invoice?.payment_intent,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
    });
  } catch (error) {
    console.error('Error creating subscription:', {
      message: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      statusCode: error.statusCode,
    });
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
