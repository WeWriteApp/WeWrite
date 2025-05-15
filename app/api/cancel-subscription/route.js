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
    let { subscriptionId, customerId, forceCleanup } = body;

    // Verify authenticated user
    let user = auth.currentUser;
    console.log('Auth check for subscription cancellation:', {
      currentUser: user ? { uid: user.uid } : 'null',
      requestedSubscriptionId: subscriptionId,
      requestedCustomerId: customerId,
      forceCleanup
    });

    // Always require authentication
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get the user's subscription from Firestore
    const subscription = await getUserSubscription(user.uid);
    console.log('User subscription data:', subscription);

    // If no subscription is found, or if forceCleanup is true, clean up subscription data
    if (!subscription || forceCleanup) {
      console.log('No subscription found for user or force cleanup requested:', user.uid);

      // Clean up all subscription-related documents to ensure they're in a consistent state
      try {
        console.log('Cleaning up subscription data for user:', user.uid);

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
        console.log('Updated user path subscription document');

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
        console.log('Updated API path subscription document');

        // 3. Update the user document to remove tier information
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          tier: null,
          subscriptionStatus: 'canceled',
          updatedAt: serverTimestamp()
        });
        console.log('Updated user document');

        console.log('All subscription documents updated to ensure consistent canceled state for user:', user.uid);
      } catch (cleanupError) {
        console.error('Error cleaning up user subscription data:', cleanupError);
        // Continue even if cleanup fails - this is just to be thorough
      }

      // Return success since we've cleaned up the subscription data
      return NextResponse.json({
        success: true,
        message: 'Subscription data cleaned up successfully',
        noSubscription: true
      });
    }

    // Handle demo subscriptions differently
    if (subscriptionId && subscriptionId.startsWith('demo_')) {
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
    if (!subscription.stripeSubscriptionId) {
      console.log('No Stripe subscription ID found in user subscription data');

      // If we have a customer ID, try to find and cancel all active subscriptions for this customer
      if (subscription.stripeCustomerId || customerId) {
        const customerIdToUse = subscription.stripeCustomerId || customerId;
        console.log(`Attempting to find and cancel subscriptions for customer: ${customerIdToUse}`);

        try {
          // List all active subscriptions for this customer
          const subscriptions = await stripe.subscriptions.list({
            customer: customerIdToUse,
            status: 'active'
          });

          console.log(`Found ${subscriptions.data.length} active subscriptions for customer`);

          if (subscriptions.data.length > 0) {
            // Cancel all active subscriptions
            for (const sub of subscriptions.data) {
              console.log(`Canceling subscription ${sub.id} for customer ${customerIdToUse}`);
              await stripe.subscriptions.cancel(sub.id);
            }

            // Update the subscription data in Firestore
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

            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              tier: null,
              subscriptionStatus: 'canceled',
              updatedAt: serverTimestamp()
            });

            return NextResponse.json({
              success: true,
              message: 'Subscriptions canceled successfully using customer ID'
            });
          }
        } catch (stripeError) {
          console.error('Error finding or canceling subscriptions by customer ID:', stripeError);
        }
      }

      // If we get here, we couldn't find any subscriptions to cancel
      // Instead of returning an error, clean up the subscription data and return success
      console.log('No Stripe subscriptions found to cancel, cleaning up subscription data');

      try {
        // Clean up all subscription-related documents
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

        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          tier: null,
          subscriptionStatus: 'canceled',
          updatedAt: serverTimestamp()
        });

        console.log('Subscription data cleaned up successfully');
      } catch (cleanupError) {
        console.error('Error cleaning up subscription data:', cleanupError);
      }

      return NextResponse.json({
        success: true,
        message: 'No active Stripe subscriptions found, subscription data cleaned up',
        noSubscription: true
      });
    }

    // Check for subscription ID mismatch but allow cancellation to proceed
    if (subscription.stripeSubscriptionId !== subscriptionId) {
      console.log('Subscription ID mismatch, but proceeding with cancellation', {
        storedId: subscription.stripeSubscriptionId,
        requestedId: subscriptionId
      });

      // Use the stored subscription ID instead of the requested one
      subscriptionId = subscription.stripeSubscriptionId;
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