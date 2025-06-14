/**
 * Subscription Cancellation API
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initAdmin } from '../../../firebase/admin';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../../api/auth-helper';

// Initialize Firebase Admin and Stripe
const adminApp = initAdmin();
const adminDb = adminApp.firestore();
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-06-20',
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    // Cancel the subscription in Stripe
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update subscription status in Firestore
    const subscriptionRef = adminDb.collection('users').doc(userId).collection('subscription').doc('current');
    await subscriptionRef.update({
      status: 'cancelled',
      cancelAtPeriodEnd: true,
      updatedAt: new Date(),
    });

    console.log(`Subscription cancelled for user ${userId}: ${subscriptionId}`);

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully',
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
