import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from '../../../firebase/admin';
import Stripe from 'stripe';
import { getUserIdFromRequest } from '../../auth-helper';
import { checkPaymentsFeatureFlag } from '../../feature-flag-helper';

// Initialize Firebase Admin lazily
let db: any;
let auth: any;

function initializeFirebase() {
  if (db && auth) return { db, auth }; // Already initialized

  try {
    const app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { db: null, auth: null };
    }

    db = getFirestore();
    auth = getAuth();
  } catch (error) {
    console.error('Error initializing Firebase Admin in sync-status route:', error);
    return { db: null, auth: null };
  }

  return { db, auth };
}

// Initialize Stripe with proper config
import { getStripeSecretKey } from '../../../utils/stripeConfig';
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase lazily
    const { db: firestore, auth: firebaseAuth } = initializeFirebase();

    if (!firestore || !firebaseAuth) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Update local references
    db = firestore;
    auth = firebaseAuth;

    // Check if payments feature is enabled
    const featureCheckResponse = await checkPaymentsFeatureFlag();
    if (featureCheckResponse) {
      return featureCheckResponse;
    }

    // Get user ID from request using our helper
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current subscription from Firestore using Admin SDK
    const subscriptionRef = db.collection('users').doc(userId).collection('subscription').doc('current');
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const subscriptionData = subscriptionDoc.data();
    const stripeSubscriptionId = subscriptionData?.stripeSubscriptionId;

    if (!stripeSubscriptionId) {
      return NextResponse.json({
        error: 'No Stripe subscription ID found'
      }, { status: 404 });
    }

    console.log(`[SYNC STATUS] Starting status sync for user ${userId}, subscription ${stripeSubscriptionId}`);

    // Fetch the latest subscription data from Stripe
    let stripeSubscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      console.log(`[SYNC STATUS] Retrieved Stripe subscription, status: ${stripeSubscription.status}`);
    } catch (error: any) {
      console.error('[SYNC STATUS] Error fetching Stripe subscription:', error);
      return NextResponse.json({
        error: 'Failed to fetch subscription from Stripe',
        details: error.message
      }, { status: 500 });
    }

    // Update the subscription status in Firestore using Admin SDK
    const currentStatus = subscriptionData.status;
    const newStatus = stripeSubscription.status;

    console.log(`[SYNC STATUS] Status transition for user ${userId}: '${currentStatus}' -> '${newStatus}'`);

    const updateData = {
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      updatedAt: FieldValue.serverTimestamp(),
      lastSyncAt: FieldValue.serverTimestamp(),
    };

    // Add billing cycle end if available
    if (stripeSubscription.current_period_end) {
      updateData.billingCycleEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();
    }

    await subscriptionRef.update(updateData);

    console.log(`[SYNC STATUS] Subscription status synced successfully for user ${userId}: ${stripeSubscription.status}`);

    return NextResponse.json({
      success: true,
      subscription: {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        currentPeriodStart: updateData.currentPeriodStart,
        currentPeriodEnd: updateData.currentPeriodEnd,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
      statusChanged: currentStatus !== newStatus,
      previousStatus: currentStatus,
      message: `Subscription status synced successfully. Status: ${stripeSubscription.status}`
    });

  } catch (error) {
    console.error('Error syncing subscription status:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    error: 'Method not allowed. Use POST to sync subscription status.'
  }, { status: 405 });
}
