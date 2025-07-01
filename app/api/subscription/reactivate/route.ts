/**
 * Subscription Reactivation API
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
  apiVersion: '2024-06-20'});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if payments feature is enabled for this user
    const { checkPaymentsFeatureFlag } = await import('../../feature-flag-helper');
    const featureCheckResponse = await checkPaymentsFeatureFlag(userId);
    if (featureCheckResponse) {
      return featureCheckResponse;
    }

    const body = await request.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    console.log(`[REACTIVATE SUBSCRIPTION] Starting reactivation for user ${userId}, subscription ${subscriptionId}`);

    // Get current subscription data to check status
    const subscriptionRef = adminDb.collection('users').doc(userId).collection('subscription').doc('current');
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      return NextResponse.json({ error: 'No subscription found for this user' }, { status: 404 });
    }

    const subscriptionData = subscriptionDoc.data();
    if (subscriptionData?.stripeSubscriptionId !== subscriptionId) {
      return NextResponse.json({ error: 'Subscription does not belong to this user' }, { status: 403 });
    }

    // Check if subscription is actually set to cancel
    if (!subscriptionData?.cancelAtPeriodEnd) {
      return NextResponse.json({ error: 'Subscription is not set to cancel' }, { status: 400 });
    }

    try {
      // Reactivate the subscription in Stripe by setting cancel_at_period_end to false
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false});

      // Update subscription status in Firestore
      await subscriptionRef.update({
        status: 'active',
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
        // Remove any cancellation-related fields
        cancelledAt: null,
        cancelReason: null});

      console.log(`[REACTIVATE SUBSCRIPTION] Successfully reactivated subscription ${subscriptionId} for user ${userId}`);

      return NextResponse.json({
        success: true,
        message: 'Subscription has been reactivated successfully',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()}
      });

    } catch (stripeError: any) {
      console.error('[REACTIVATE SUBSCRIPTION] Stripe reactivation failed:', stripeError);
      
      return NextResponse.json({
        success: false,
        error: `Failed to reactivate subscription: ${stripeError.message}`}, { status: 500 });
    }

  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate subscription' },
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