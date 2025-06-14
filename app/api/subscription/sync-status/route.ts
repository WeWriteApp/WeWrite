import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../../../firebase/admin';
import Stripe from 'stripe';

// Initialize Firebase Admin
initAdmin();
const db = getFirestore();
const auth = getAuth();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];

    // Verify the Firebase token
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { userId } = await request.json();

    // Verify the user is authorized to sync this subscription
    if (decodedToken.uid !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get the current subscription from Firestore
    const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
    const subscriptionDoc = await getDoc(subscriptionRef);

    if (!subscriptionDoc.exists()) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const subscriptionData = subscriptionDoc.data();
    const stripeSubscriptionId = subscriptionData?.stripeSubscriptionId;

    if (!stripeSubscriptionId) {
      return NextResponse.json({ error: 'No Stripe subscription ID found' }, { status: 404 });
    }

    // Fetch the latest subscription data from Stripe
    let stripeSubscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    } catch (error) {
      console.error('Error fetching Stripe subscription:', error);
      return NextResponse.json({ error: 'Failed to fetch subscription from Stripe' }, { status: 500 });
    }

    // Update the subscription status in Firestore
    const updateData = {
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      updatedAt: serverTimestamp(),
    };

    // Add billing cycle end if available
    if (stripeSubscription.current_period_end) {
      updateData.billingCycleEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();
    }

    await updateDoc(subscriptionRef, updateData);

    console.log(`Subscription status synced for user ${userId}: ${stripeSubscription.status}`);

    return NextResponse.json({ 
      success: true, 
      status: stripeSubscription.status,
      message: 'Subscription status synced successfully'
    });

  } catch (error) {
    console.error('Error syncing subscription status:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
