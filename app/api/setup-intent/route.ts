import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from '../../firebase/admin';
import { getUserIdFromRequest } from '../auth-helper';
import { sanitizeUsername } from '../../utils/usernameSecurity';
import { getStripe } from '../../lib/stripe';

// Initialize Firebase Admin lazily
let auth: any;
let db: any;

function initializeFirebase() {
  if (auth && db) return { auth, db }; // Already initialized

  try {
    const app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { auth: null, db: null };
    }

    auth = getAuth();
    db = getFirestore();
  } catch (error) {
    console.error('Error initializing Firebase Admin in setup-intent route:', error);
    return { auth: null, db: null };
  }

  return { auth, db };
}

const stripe = getStripe();

// POST /api/setup-intent - Create a setup intent for adding a payment method
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase lazily
    const { auth: firebaseAuth, db: firestore } = initializeFirebase();

    if (!firebaseAuth || !firestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Update local references
    auth = firebaseAuth;
    db = firestore;

    // Get user ID from request using our helper
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's customer ID from Firestore
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    const userData = userDoc.data();

    let customerId = userData?.stripeCustomerId;

    // If the user doesn't have a customer ID, create one
    if (!customerId) {
      // Get user email from Firebase Auth
      const userRecord = await auth.getUser(userId);

      // Get username from Firestore (never expose email local part)
      let username = 'Unknown User';
      try {
        const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
        const userData = userDoc.exists() ? userDoc.data() : null;
        const emailLocalPart = userRecord.email ? userRecord.email.split('@')[0] : null;
        // Only use username field - displayName is fully deprecated
        username = sanitizeUsername(
          userData?.username || null,
          'User',
          'User'
        );
        if (!username || username === 'User') {
          username = `user_${userId.substring(0, 8)}`;
        }
        // Keep email local part only for backend metadata clarity, never surface as username
        const email_local_part = emailLocalPart || undefined;
        if (email_local_part) {
        }
      } catch (error) {
        console.warn('Could not fetch username for Stripe customer:', error);
      }

      const customer = await stripe.customers.create({
        email: userRecord.email,
        description: `WeWrite user ${username} (${userId})`,
        metadata: {
          firebaseUID: userId,
          username: username}});

      customerId = customer.id;

      // Save the customer ID to Firestore
      await db.collection(getCollectionName('users')).doc(userId).set({
        stripeCustomerId: customerId}, { merge: true });
    }

    // Check if the user already has 3 payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'});

    if (paymentMethods.data.length >= 3) {
      return NextResponse.json({ error: 'You can only have up to 3 payment methods' }, { status: 400 });
    }

    // Create a setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      // STRIPE LINK: Add Link support along with card payments
      payment_method_types: ['card', 'link'],
      usage: 'off_session', // Allow the payment method to be used for future payments
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret}, { status: 200 });
  } catch (error: any) {
    console.error('Error creating setup intent:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
