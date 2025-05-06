import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from '../../firebase/admin';
import { getUserIdFromRequest } from '../auth-helper';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../utils/stripeConfig';

// Initialize Firebase Admin
initAdmin();

// Get auth and firestore instances
const auth = getAuth();
const db = getFirestore();

// Get the appropriate Stripe key based on environment
const stripeSecretKey = getStripeSecretKey();
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
});

// POST /api/setup-intent - Create a setup intent for adding a payment method
export async function POST(request: NextRequest) {
  try {
    // Get user ID from request using our helper
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's customer ID from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    let customerId = userData?.stripeCustomerId;

    // If the user doesn't have a customer ID, create one
    if (!customerId) {
      // Get user email from Firebase Auth
      const userRecord = await auth.getUser(userId);

      const customer = await stripe.customers.create({
        email: userRecord.email,
        metadata: {
          firebaseUID: userId,
        },
      });

      customerId = customer.id;

      // Save the customer ID to Firestore
      await db.collection('users').doc(userId).set({
        stripeCustomerId: customerId,
      }, { merge: true });
    }

    // Check if the user already has 3 payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    if (paymentMethods.data.length >= 3) {
      return NextResponse.json({ error: 'You can only have up to 3 payment methods' }, { status: 400 });
    }

    // Create a setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session', // Allow the payment method to be used for future payments
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error creating setup intent:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
