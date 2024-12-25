import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import database, { ref, update } from '@/firebase/rtdb';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
    const userRef = ref(database, `users/${userId}`);
    await update(userRef, {
      stripeCustomerId: customer.id,
    });

    console.log('Successfully created Stripe customer:', customer.id, 'for user:', userId);

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
