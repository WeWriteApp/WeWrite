import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/app/firebase/auth';
import { getUserSubscription } from '@/app/firebase/subscription';

export async function POST(request) {
  try {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Get request body
    const body = await request.json();
    const { userId } = body;
    
    // Verify the authenticated user
    const user = auth.currentUser;
    if (!user || user.uid !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get the user's subscription from Firestore
    const subscription = await getUserSubscription(userId);
    
    if (!subscription || !subscription.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }
    
    // Create the portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account/subscription`,
    });
    
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 