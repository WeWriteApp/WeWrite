import { NextRequest, NextResponse } from 'next/server';
import { admin } from '../../firebase/admin';
import Stripe from 'stripe';

// Initialize Firebase Admin
const auth = admin.auth();
const db = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// POST /api/subscription-success - Handle subscription success and cleanup
export async function POST(request: NextRequest) {
  try {
    // Get the session cookie
    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the session cookie
    const decodedClaims = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedClaims.uid;

    // Get the subscription ID from the request body
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Get the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get the subscription from the session
    const subscription = session.subscription as Stripe.Subscription;

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found in session' }, { status: 404 });
    }

    // Get the subscription data from Firestore
    const subscriptionDoc = await db.collection('users').doc(userId).collection('subscriptions').doc('current').get();

    if (!subscriptionDoc.exists) {
      return NextResponse.json({ error: 'Subscription not found in Firestore' }, { status: 404 });
    }

    const subscriptionData = subscriptionDoc.data();

    // Get the subscription price from Stripe
    const price = subscription.items.data[0].price;
    const amount = price.unit_amount ? price.unit_amount / 100 : 0;

    // Determine the tier based on the amount
    let tier = 'tier1';
    if (amount >= 50) {
      tier = 'tier3';
    } else if (amount >= 20) {
      tier = 'tier2';
    }

    // Update the subscription data in Firestore
    await db.collection('users').doc(userId).collection('subscriptions').doc('current').update({
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      amount: amount,
      tier: tier,
      billingCycleStart: new Date(subscription.current_period_start * 1000).toISOString(),
      billingCycleEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update the user's subscription tier in Firestore
    await db.collection('users').doc(userId).update({
      subscriptionTier: tier,
      subscriptionStatus: subscription.status,
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        amount: amount,
        tier: tier,
      },
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error handling subscription success:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
