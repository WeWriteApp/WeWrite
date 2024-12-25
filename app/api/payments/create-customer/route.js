import { NextResponse } from 'next/server';
import { getFirebase } from '@/firebase/rtdb';
import { ref, update } from '@/firebase/rtdb';
import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY;
console.log('Create customer - Stripe key status:', {
  exists: !!stripeKey,
  length: stripeKey?.length,
  prefix: stripeKey?.substring(0, 7),
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    console.log('Received create-customer request');

    const { uid, email, name } = await request.json();
    console.log('Creating customer with data:', { uid, email, name });

    if (!uid) {
      console.error('Missing uid in request');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    try {
      console.log('Creating Stripe customer');
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { uid },
      });
      console.log('Successfully created Stripe customer:', customer.id);

      const { rtdb } = await getFirebase();
      const userRef = ref(rtdb, `users/${uid}`);
      await update(userRef, {
        stripeCustomerId: customer.id,
      });
      console.log('Updated user record with Stripe customer ID');

      return NextResponse.json({ customerId: customer.id });
    } catch (stripeError) {
      console.error('Stripe customer creation error:', {
        message: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
        statusCode: stripeError.statusCode,
      });

      return NextResponse.json(
        {
          error: 'Failed to create Stripe customer',
          details: stripeError.message
        },
        { status: stripeError.statusCode || 500 }
      );
    }
  } catch (error) {
    console.error('Server Error:', {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
