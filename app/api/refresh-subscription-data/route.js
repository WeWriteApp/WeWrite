import { NextResponse } from 'next/server';
import { auth } from '../../firebase/auth';
import { getUserSubscription } from '../../firebase/subscription';
import { db } from '../../firebase/database';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../utils/stripeConfig';

// Initialize Stripe with the secret key
const stripe = new Stripe(getStripeSecretKey());

export async function POST(request) {
  try {
    // Get the current user
    const user = auth.currentUser;
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }
    
    // Get the user's subscription from Firestore
    const subscription = await getUserSubscription(user.uid);
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }
    
    // If the subscription has a Stripe subscription ID, check its status in Stripe
    if (subscription.stripeSubscriptionId && !subscription.stripeSubscriptionId.startsWith('demo_')) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
        
        // If the Stripe status doesn't match the Firestore status, update Firestore
        if (stripeSubscription.status !== subscription.status) {
          console.log(`Updating subscription status from ${subscription.status} to ${stripeSubscription.status}`);
          
          // Update subscription in Firestore
          const userSubscriptionRef = doc(db, "users", user.uid, "subscription", "current");
          await updateDoc(userSubscriptionRef, {
            status: stripeSubscription.status,
            updatedAt: serverTimestamp(),
          });
          
          // Also update the user document
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            subscriptionStatus: stripeSubscription.status,
            updatedAt: serverTimestamp()
          });
          
          // Also update the API path
          const apiSubscriptionRef = doc(db, "subscriptions", user.uid);
          await updateDoc(apiSubscriptionRef, {
            status: stripeSubscription.status,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error('Error retrieving Stripe subscription:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Subscription data refreshed'
    });
  } catch (error) {
    console.error('Error refreshing subscription data:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while refreshing subscription data' },
      { status: 500 }
    );
  }
}
