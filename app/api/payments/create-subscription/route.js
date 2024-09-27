import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe("123", { apiVersion: '2023-08-16' });

export async function POST(request) {
  const { amount, currency } = await request.json();

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Amount in cents (e.g., $300 -> 30000)
      currency: currency || 'usd',
      payment_method_types: ['card'], // Optionally extend this based on available methods
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}