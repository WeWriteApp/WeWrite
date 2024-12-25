import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { customerId } = await request.json();
    const baseAmount = 1000; // $10 in cents - fixed base subscription amount

    // Create a subscription with the fixed base amount
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price_data: {
          currency: 'usd',
          product: process.env.STRIPE_PRODUCT_ID,
          recurring: {
            interval: 'month'
          },
          unit_amount: baseAmount,
        },
      }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
