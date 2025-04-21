import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '../../firebase/admin';

// Initialize Firebase Admin
initAdmin();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify the user exists in Firebase
    try {
      await getAuth().getUser(userId);
    } catch (error) {
      console.error('Error verifying user:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's subscription from Firestore
    const db = getFirestore();
    const subscriptionRef = db.collection('subscriptions').where('userId', '==', userId);
    const subscriptionSnapshot = await subscriptionRef.get();

    if (subscriptionSnapshot.empty) {
      return NextResponse.json({ payments: [] });
    }

    const subscriptionDoc = subscriptionSnapshot.docs[0].data();
    const stripeCustomerId = subscriptionDoc.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json({ payments: [] });
    }

    // Get payment history from Stripe
    const paymentIntents = await stripe.paymentIntents.list({
      customer: stripeCustomerId,
      limit: 10,
    });

    // Format the payment data
    const payments = paymentIntents.data.map(payment => ({
      id: payment.id,
      amount: payment.amount / 100, // Convert from cents to dollars
      status: payment.status,
      created: payment.created,
      currency: payment.currency
    }));

    // Return the payment history
    return NextResponse.json({ payments });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
