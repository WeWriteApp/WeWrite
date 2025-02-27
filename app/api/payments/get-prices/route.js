import { NextResponse } from 'next/server';
// import { get, child } from 'firebase/database';
import admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export async function GET(request) {
  const {searchParams} = new URL(request.url);
  // const stripeCustomerId = searchParams.get('uid');

  try {
    const prices = await stripe.prices.list({
      product: "prod_RqrsHKfbMnaIHX"
    });

    return NextResponse.json(prices.data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}