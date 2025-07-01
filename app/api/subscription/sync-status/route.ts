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
  apiVersion: '2024-12-18.acacia'});

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

    // Get user ID from request using our helper first
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if payments feature is enabled for this specific user
    const featureCheckResponse = await checkPaymentsFeatureFlag(userId);
    if (featureCheckResponse) {
      return featureCheckResponse;
    }

    // Get user's Stripe customer ID
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const stripeCustomerId = userData?.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json({
        error: 'No Stripe customer ID found'
      }, { status: 400 });
    }

    console.log(`[SYNC STATUS] Starting status sync for user ${userId}, customer ${stripeCustomerId}`);

    // Get all subscriptions for this customer from Stripe
    let subscriptions;
    try {
      subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        limit: 10,
        expand: ['data.latest_invoice', 'data.latest_invoice.payment_intent']
      });
      console.log(`[SYNC STATUS] Found ${subscriptions.data.length} subscriptions in Stripe`);
    } catch (error: any) {
      console.error('[SYNC STATUS] Error fetching Stripe subscriptions:', error);
      return NextResponse.json({
        error: 'Failed to fetch subscriptions from Stripe',
        details: error.message
      }, { status: 500 });
    }

    if (subscriptions.data.length === 0) {
      return NextResponse.json({
        error: 'No subscriptions found in Stripe for this customer'
      }, { status: 404 });
    }

    // Find the most recent active or incomplete subscription
    const activeSubscription = subscriptions.data.find(sub =>
      sub.status === 'active' || sub.status === 'trialing'
    );

    const stripeSubscription = activeSubscription || subscriptions.data[0];
    console.log(`[SYNC STATUS] Using subscription ${stripeSubscription.id}, status: ${stripeSubscription.status}`);
    console.log(`[SYNC STATUS] Subscription cancel_at_period_end: ${stripeSubscription.cancel_at_period_end}`);
    console.log(`[SYNC STATUS] Subscription current_period_end: ${new Date(stripeSubscription.current_period_end * 1000).toISOString()}`);

    // Get or create subscription record
    const subscriptionRef = db.collection('users').doc(userId).collection('subscription').doc('current');
    const subscriptionDoc = await subscriptionRef.get();

    const currentStatus = subscriptionDoc.exists ? subscriptionDoc.data()?.status : 'not_found';
    const newStatus = stripeSubscription.status;

    console.log(`[SYNC STATUS] Status transition for user ${userId}: '${currentStatus}' -> '${newStatus}'`);

    // Calculate amount and tokens
    const amount = (stripeSubscription.items.data[0]?.price.unit_amount || 0) / 100;
    const tokens = amount * 10;

    const subscriptionData = {
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: stripeCustomerId,
      status: stripeSubscription.status,
      amount: amount,
      tokens: tokens,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      createdAt: new Date(stripeSubscription.created * 1000), // Use actual Stripe creation time
      updatedAt: FieldValue.serverTimestamp(),
      lastSyncAt: FieldValue.serverTimestamp(),
      syncedFromStripe: true
    };

    // Add billing cycle end if available
    if (stripeSubscription.current_period_end) {
      subscriptionData.billingCycleEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();
    }

    // Use set with merge to create or update the subscription
    await subscriptionRef.set(subscriptionData, { merge: true });

    console.log(`[SYNC STATUS] Subscription status synced successfully for user ${userId}: ${stripeSubscription.status}`);

    return NextResponse.json({
      success: true,
      subscription: {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        amount: amount,
        tokens: tokens,
        currentPeriodStart: subscriptionData.currentPeriodStart,
        currentPeriodEnd: subscriptionData.currentPeriodEnd,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end},
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