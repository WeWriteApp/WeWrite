import { NextRequest, NextResponse } from 'next/server';
import { admin, initAdmin } from '../../firebase/admin';
import Stripe from 'stripe';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../utils/environmentConfig';

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

// Initialize Firebase Admin lazily
let auth;
let db;

function initializeFirebase() {
  if (auth && db) return { auth, db }; // Already initialized

  try {
    const app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { auth: null, db: null };
    }

    auth = admin.auth();
    db = admin.firestore();
    console.log('Firebase Admin initialized successfully in subscription-success route');
  } catch (error) {
    console.error('Error initializing Firebase Admin in subscription-success route:', error);
    return { auth: null, db: null };
  }

  return { auth, db };
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil' as any});

// POST /api/subscription-success - Handle subscription success and cleanup
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase lazily
    const { auth: firebaseAuth, db: firestore } = initializeFirebase();

    if (!firebaseAuth || !firestore) {
      console.error('Firebase Admin not initialized properly in subscription-success route');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Update local references
    auth = firebaseAuth;
    db = firestore;
    // Get the session cookie
    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the session cookie
    const decodedClaims = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedClaims.uid;

    // Get the subscription ID from the request body
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Get the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']});

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get the subscription from the session
    const subscription = session.subscription as Stripe.Subscription;

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found in session' }, { status: 404 });
    }

    // Use the environment-aware Firestore path
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);
    const subscriptionRef = db.doc(parentPath).collection(subCollectionName).doc('current');
    const subscriptionDoc = await subscriptionRef.get();

    // Get the subscription price from Stripe
    const price = subscription.items.data[0].price;
    const amount = price.unit_amount ? price.unit_amount / 100 : 0;

    // Import the centralized tier determination function
    const { determineTierFromAmount } = await import('../../utils/subscriptionTiers');

    // Determine the tier based on the amount using centralized logic
    let tier = subscription.metadata.tier || determineTierFromAmount(amount);

    console.log(`Processing subscription success for user ${userId}: ${tier} - $${amount}/mo - Status: ${subscription.status}`);

    // Prepare subscription data update
    const subscriptionUpdate = {
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      amount: amount,
      tier: tier,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      updatedAt: new Date().toISOString()};

    // Create or update the subscription document
    if (subscriptionDoc.exists) {
      await subscriptionRef.update(subscriptionUpdate);
      console.log(`Updated existing subscription for user ${userId}`);
    } else {
      // Create new subscription document if it doesn't exist
      await subscriptionRef.set({
        id: 'current',
        userId,
        ...subscriptionUpdate,
        createdAt: new Date().toISOString()});
      console.log(`Created new subscription document for user ${userId}`);
    }

    // Update the user's subscription tier in Firestore
    await db.collection('users').doc(userId).update({
      subscriptionTier: tier,
      subscriptionStatus: subscription.status});

    console.log(`Subscription success processing completed for user ${userId}`);

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        amount: amount,
        tier: tier}}, { status: 200 });
  } catch (error: any) {
    console.error('Error handling subscription success:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}