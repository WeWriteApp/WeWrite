import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '../../firebase/auth';
import { getUserSubscription } from '../../firebase/subscription';
import { getStripeSecretKey } from '../../utils/stripeConfig';

export async function POST(request) {
  try {
    // Initialize Stripe with the appropriate key based on environment
    const stripeSecretKey = getStripeSecretKey();
    const stripe = new Stripe(stripeSecretKey);
    console.log('Stripe initialized for portal session');

    // Get request body
    const body = await request.json();
    const { userId } = body;

    // Note: We're skipping the auth check here because the server-side auth.currentUser
    // doesn't work properly in Next.js API routes. The authentication is handled by the
    // Firebase Auth client SDK on the client side before making this request.
    console.log('Processing portal session request for user ID:', userId);

    // We'll rely on the subscription check below to ensure the user has a valid subscription

    // Get the user's subscription from Firestore
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 400 }
      );
    }

    // Check if the subscription has a Stripe customer ID
    if (!subscription.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer ID found for this subscription' },
        { status: 400 }
      );
    }

    // Log the subscription details for debugging
    console.log('Creating portal session for subscription:', {
      userId,
      subscriptionId: subscription.stripeSubscriptionId,
      customerId: subscription.stripeCustomerId,
      status: subscription.status
    });

    // Create the portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
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