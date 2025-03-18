import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/app/firebase/auth';
import { createSubscription } from '@/app/firebase/subscription';

export async function POST(request) {
  try {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Get request body
    const body = await request.json();
    const { priceId, userId } = body;
    
    // Verify the authenticated user
    const user = auth.currentUser;
    if (!user || user.uid !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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
    
    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/account/subscription?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/account/subscription?canceled=true`,
      customer: customer.id,
      metadata: {
        firebaseUID: userId
      }
    });
    
    // Create an inactive subscription in Firestore
    await createSubscription(userId, {
      stripeCustomerId: customer.id,
      stripePriceId: priceId,
      stripeSubscriptionId: null, // Will be updated by webhook
      status: 'pending',
      amount: 0, // Will be updated by webhook
      pledgedAmount: 0,
      createdAt: new Date().toISOString()
    });
    
    return NextResponse.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 