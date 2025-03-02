import { NextResponse } from 'next/server';
// import { get, child } from 'firebase/database';
import admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Initialize Firebase Admin SDK (ensure service account JSON is set up)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL, // Example: "https://your-project-id.firebaseio.com"
  });
}

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

export async function GET(request) {
  const {searchParams} = new URL(request.url);
  const stripeCustomerId = searchParams.get('uid');

  if (stripeCustomerId == null) {
    return NextResponse.json({error: "Bad Request"}, {status: 400});
  }

  const subscriptions = await stripe.subscriptions.list({
    "customer": stripeCustomerId
  });

  return NextResponse.json(subscriptions.data);
}

export async function PATCH(request) {
  const {subscription_id, item_id, price_id} = await request.json();

  const subscription = await stripe.subscriptions.update(
    subscription_id,
    {
      items: [
        {
          id: item_id,
          price: price_id,
        },
      ],
      proration_behavior: 'none',
    }
  );

  return NextResponse.json(subscription);
}