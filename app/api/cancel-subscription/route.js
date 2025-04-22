import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '../../firebase/auth';
import { getUserSubscription, updateSubscription } from '../../firebase/subscription';
import { getStripeSecretKey } from '../../utils/stripeConfig';

export async function POST(request) {
  try {
    // Initialize Stripe with the appropriate key based on environment
    const stripeSecretKey = getStripeSecretKey();
    const stripe = new Stripe(stripeSecretKey);
    console.log('Stripe initialized for subscription cancellation');

    // Get request body
    const body = await request.json();
    const { subscriptionId } = body;

    // Verify authenticated user
    const user = auth.currentUser;
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the user's subscription from Firestore
    const subscription = await getUserSubscription(user.uid);

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 400 }
      );
    }

    // Handle demo subscriptions differently
    if (subscriptionId.startsWith('demo_')) {
      // Update the subscription in Firestore
      await updateSubscription(user.uid, {
        status: 'inactive',
        stripeSubscriptionId: null,
        amount: 0,
        renewalDate: null
      });

      return NextResponse.json({
        success: true,
        message: 'Demo subscription canceled successfully'
      });
    }

    // For real Stripe subscriptions
    if (!subscription.stripeSubscriptionId || subscription.stripeSubscriptionId !== subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID mismatch' },
        { status: 400 }
      );
    }

    // Log the subscription ID for debugging
    console.log('Canceling Stripe subscription:', subscriptionId);

    try {
      // Cancel the subscription with Stripe
      const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);
      console.log('Stripe subscription canceled successfully:', canceledSubscription.id);

      // Update the subscription in Firestore
      await updateSubscription(user.uid, {
        status: 'canceled',
        canceledAt: new Date().toISOString()
      });
      console.log('Firestore subscription updated for user:', user.uid);
    } catch (stripeError) {
      console.error('Error with Stripe cancellation:', stripeError);
      return NextResponse.json(
        { error: stripeError.message || 'Failed to cancel subscription with Stripe', success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription canceled successfully',
      subscription: canceledSubscription
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}