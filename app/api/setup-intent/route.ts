import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getUserIdFromRequest } from '../auth-helper';
import { getStripe } from '../../lib/stripe';
import { getOrCreateStripeCustomer } from '../../lib/stripeCustomer';

// Initialize Firebase Admin lazily
let auth: any;
let db: any;

function initializeFirebase() {
  if (auth && db) return { auth, db }; // Already initialized

  try {
    const app = getFirebaseAdmin();
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

    // Get or create a Stripe customer (with deduplication)
    const userRecord = await auth.getUser(userId);
    const { customerId } = await getOrCreateStripeCustomer({
      userId,
      email: userRecord.email,
      db,
    });

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
