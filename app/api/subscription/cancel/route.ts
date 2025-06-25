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

    // Check if payments feature is enabled for this user
    const { checkPaymentsFeatureFlag } = await import('../../feature-flag-helper');
    const featureCheckResponse = await checkPaymentsFeatureFlag(userId);
    if (featureCheckResponse) {
      return featureCheckResponse;
    }

    const body = await request.json();
    const { subscriptionId, immediate = false } = body;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    console.log(`[CANCEL SUBSCRIPTION] Starting cancellation for user ${userId}, subscription ${subscriptionId}, immediate: ${immediate}`);

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

    // Handle immediate cancellation for stuck/incomplete subscriptions
    if (immediate || ['incomplete', 'pending', 'incomplete_expired'].includes(subscriptionData.status)) {
      console.log(`[CANCEL SUBSCRIPTION] Performing immediate cancellation for stuck subscription`);

      try {
        // Cancel immediately in Stripe
        const cancelledSubscription = await stripe.subscriptions.cancel(subscriptionId);

        // Update Firestore with cancelled status
        await subscriptionRef.update({
          status: 'canceled',
          cancelledAt: new Date(),
          cancelReason: immediate ? 'user_cancelled_stuck_subscription' : 'user_cancelled_incomplete',
          updatedAt: new Date(),
        });

        return NextResponse.json({
          success: true,
          message: 'Subscription cancelled immediately',
          subscription: {
            id: cancelledSubscription.id,
            status: cancelledSubscription.status,
            cancelledAt: new Date(cancelledSubscription.canceled_at * 1000).toISOString(),
          }
        });

      } catch (stripeError: any) {
        console.error('[CANCEL SUBSCRIPTION] Stripe immediate cancellation failed:', stripeError);

        // Still update our records even if Stripe fails
        await subscriptionRef.update({
          status: 'canceled',
          cancelledAt: new Date(),
          cancelReason: 'user_cancelled_stuck_subscription_stripe_failed',
          updatedAt: new Date(),
          stripeError: stripeError.message,
        });

        return NextResponse.json({
          success: true,
          message: 'Subscription marked as cancelled (Stripe cancellation may have failed)',
          warning: 'Please contact support if you see any charges'
        });
      }
    } else {
      // Normal cancellation at period end for active subscriptions
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      // Update subscription status in Firestore
      await subscriptionRef.update({
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription will be cancelled at the end of the current period',
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      });
    }

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
