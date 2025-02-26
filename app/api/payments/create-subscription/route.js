import { NextResponse } from 'next/server';
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
});

export async function POST(request) {
  const { amount, currency } = await request.json();

  try {
    const prices = await stripe.prices.list({
      lookup_keys: [amount],
      expand: ['data.product'],
    });

    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [{
        price: prices.data[0].id,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: '/profile',
      cancel_url: '/profile/billing?success=false'
    });

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}