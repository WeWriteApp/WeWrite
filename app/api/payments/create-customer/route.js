import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDatabase } from '@/firebase/database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = getDatabase();

export async function POST(request) {
  try {
    const { userId, email, name } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Create a Stripe customer with user information
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
      },
    });

    // Update user record with Stripe customer ID
    await db.ref(`users/${userId}`).update({
      stripeCustomerId: customer.id,
    });

    return NextResponse.json({
      customerId: customer.id
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
