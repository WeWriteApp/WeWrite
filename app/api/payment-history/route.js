import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';
import { getStripeSecretKey } from '../../utils/stripeConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getUserIdFromRequest } from '../auth-helper';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

// Initialize Stripe with the appropriate key based on environment
const stripeSecretKey = getStripeSecretKey();
const stripe = new Stripe(stripeSecretKey);
console.log('Stripe initialized for payment history');

// Helper function to fetch payment history for a user
async function fetchPaymentHistoryForUser(userId) {
  // Verify the user exists in Firebase
  try {
    await admin.auth().getUser(userId);
  } catch (error) {
    console.error('Error verifying user:', error);
    throw new Error('Unauthorized');
  }

  // Get the user's subscription from Firestore
  const db = getFirestore();

  // Fetch user data from Firestore
  const userDocRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userDocRef);

  if (!userDoc.exists()) {
    throw new Error('User not found');
  }

  const userData = userDoc.data();
  const stripeCustomerId = userData.stripeCustomerId;

  if (!stripeCustomerId) {
    return [];
  }

  // Get payment history from Stripe using invoices (better for subscriptions)
  console.log('Fetching payment history for customer:', stripeCustomerId);

  try {
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 10,
      status: 'paid',
    });

    console.log(`Found ${invoices.data.length} invoices for customer`);

    // Format the payment data
    const payments = invoices.data.map(invoice => ({
      id: invoice.id,
      amount: invoice.amount_paid / 100, // Convert from cents to dollars
      status: invoice.status === 'paid' ? 'succeeded' : invoice.status,
      date: new Date(invoice.created * 1000).toISOString(),
      currency: invoice.currency,
      description: invoice.description || 'Subscription payment'
    }));

    // If no invoices found, try payment intents as fallback
    if (payments.length === 0) {
      console.log('No invoices found, trying payment intents');
      const paymentIntents = await stripe.paymentIntents.list({
        customer: stripeCustomerId,
        limit: 10,
      });

      const paymentIntentPayments = paymentIntents.data.map(payment => ({
        id: payment.id,
        amount: payment.amount / 100, // Convert from cents to dollars
        status: payment.status,
        date: new Date(payment.created * 1000).toISOString(),
        currency: payment.currency,
        description: 'Payment'
      }));

      return paymentIntentPayments;
    }

    return payments;
  } catch (stripeError) {
    console.error('Error fetching from Stripe:', stripeError);
    throw new Error(stripeError.message || 'Failed to fetch payment history');
  }
}

// GET /api/payment-history?userId=xxx - Get payment history for a user
export async function GET(request) {
  try {
    // Get user ID from query parameters or from auth
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get('userId');

    // If no userId in query params, try to get from auth
    if (!userId) {
      userId = await getUserIdFromRequest(request);
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const payments = await fetchPaymentHistoryForUser(userId);
    return NextResponse.json({ payments });

  } catch (error) {
    console.error('Error fetching payment history:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const payments = await fetchPaymentHistoryForUser(userId);
    return NextResponse.json({ payments });

  } catch (error) {
    console.error('Error fetching payment history:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
