import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '../../firebase/auth';
import { getUserSubscription, updateSubscription } from '../../firebase/subscription';
import { getStripeSecretKey } from '../../utils/stripeConfig';
import { db } from '../../firebase/database';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';

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
    let user = auth.currentUser;
    console.log('Auth check for subscription cancellation:', {
      currentUser: user ? { uid: user.uid } : 'null',
      requestedSubscriptionId: subscriptionId
    });

    // Skip auth check in development for testing
    if (process.env.NODE_ENV !== 'development') {
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized', details: 'User not authenticated' },
          { status: 401 }
        );
      }
    } else {
      console.log('Skipping auth check in development environment');
      // In development, if user is null, create a mock user for testing
      if (!user) {
        user = {
          uid: 'test-user-id',
          email: 'test@example.com'
        };
        console.log('Created mock user for development:', user);
      }
    }

    // Get the user's subscription from Firestore
    const subscription = await getUserSubscription(user.uid);

    if (!subscription) {
      console.log('No subscription found for user:', user.uid);

      // Even though no subscription was found, update all subscription-related documents to ensure they're clean
      try {
        // 1. Update the subscription in the user path
        const userSubRef = doc(db, 'users', user.uid, 'subscription', 'current');
        await setDoc(userSubRef, {
          status: 'canceled',
          stripeSubscriptionId: null,
          amount: 0,
          tier: null,
          renewalDate: null,
          updatedAt: new Date().toISOString(),
          canceledAt: new Date().toISOString()
        }, { merge: true });

        // 2. Update the subscription in the API path
        const apiSubRef = doc(db, 'subscriptions', user.uid);
        await setDoc(apiSubRef, {
          status: 'canceled',
          stripeSubscriptionId: null,
          amount: 0,
          tier: null,
          renewalDate: null,
          updatedAt: new Date().toISOString(),
          canceledAt: new Date().toISOString()
        }, { merge: true });

        // 3. Update the user document to remove tier information
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          tier: null,
          subscriptionStatus: 'canceled',
          updatedAt: serverTimestamp()
        });

        console.log('All subscription documents updated to ensure consistent canceled state for user:', user.uid);
      } catch (cleanupError) {
        console.error('Error cleaning up user subscription data:', cleanupError);
        // Continue even if cleanup fails - this is just to be thorough
      }

      // Return success since there's nothing to cancel
      return NextResponse.json({
        success: true,
        message: 'No active subscription found',
        noSubscription: true
      });
    }

    // Handle demo subscriptions differently
    if (subscriptionId.startsWith('demo_')) {
      console.log('Canceling demo subscription for user:', user.uid);

      // Update all subscription-related documents to ensure they're consistent
      try {
        // 1. Update the subscription in the user path
        const userSubRef = doc(db, 'users', user.uid, 'subscription', 'current');
        await setDoc(userSubRef, {
          status: 'canceled',
          stripeSubscriptionId: null,
          amount: 0,
          tier: null,
          renewalDate: null,
          updatedAt: new Date().toISOString(),
          canceledAt: new Date().toISOString()
        }, { merge: true });
        console.log('User path subscription document updated for demo cancellation:', user.uid);

        // 2. Update the subscription in the API path
        const apiSubRef = doc(db, 'subscriptions', user.uid);
        await setDoc(apiSubRef, {
          status: 'canceled',
          stripeSubscriptionId: null,
          amount: 0,
          tier: null,
          renewalDate: null,
          updatedAt: new Date().toISOString(),
          canceledAt: new Date().toISOString()
        }, { merge: true });
        console.log('API path subscription document updated for demo cancellation:', user.uid);

        // 3. Update the user document to remove tier information
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          tier: null,
          subscriptionStatus: 'canceled',
          updatedAt: serverTimestamp()
        });
        console.log('User document updated for demo cancellation:', user.uid);
      } catch (updateError) {
        console.error('Error updating subscription documents for demo cancellation:', updateError);
        // Continue even if update fails
      }

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

      // Update all subscription-related documents to ensure they're consistent
      try {
        // 1. Update the subscription in the user path
        const userSubRef = doc(db, 'users', user.uid, 'subscription', 'current');
        await setDoc(userSubRef, {
          status: 'canceled',
          stripeSubscriptionId: null,
          amount: 0,
          tier: null,
          renewalDate: null,
          updatedAt: new Date().toISOString(),
          canceledAt: new Date().toISOString()
        }, { merge: true });
        console.log('User path subscription document updated for user:', user.uid);

        // 2. Update the subscription in the API path
        const apiSubRef = doc(db, 'subscriptions', user.uid);
        await setDoc(apiSubRef, {
          status: 'canceled',
          stripeSubscriptionId: null,
          amount: 0,
          tier: null,
          renewalDate: null,
          updatedAt: new Date().toISOString(),
          canceledAt: new Date().toISOString()
        }, { merge: true });
        console.log('API path subscription document updated for user:', user.uid);

        // 3. Update the user document to remove tier information
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          tier: null,
          subscriptionStatus: 'canceled',
          updatedAt: serverTimestamp()
        });
        console.log('User document updated for user:', user.uid);
      } catch (updateError) {
        console.error('Error updating subscription documents:', updateError);
        // Continue even if update fails - the subscription is already canceled in Stripe
      }
    } catch (stripeError) {
      console.error('Error with Stripe cancellation:', stripeError);
      return NextResponse.json(
        { error: stripeError.message || 'Failed to cancel subscription with Stripe', success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription canceled successfully'
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}