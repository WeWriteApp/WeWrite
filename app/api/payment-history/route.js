import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';
import { getStripeSecretKey } from '../../utils/stripeConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

// Initialize Stripe with the appropriate key based on environment
const stripeSecretKey = getStripeSecretKey();
const stripe = new Stripe(stripeSecretKey);
console.log('Stripe initialized for payment history');

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify the user exists in Firebase
    try {
      await admin.auth().getUser(userId);
    } catch (error) {
      console.error('Error verifying user:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's subscription from Firestore
    const db = getFirestore();

    if (subscriptionSnapshot.empty) {
      return NextResponse.json({ payments: [] });
    }

    // Fetch user data from Firestore
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return new NextResponse(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userData = userDoc.data();
    const stripeCustomerId = userData.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json({ payments: [] });
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
        status: invoice.status,
        created: invoice.created,
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
          created: payment.created,
          currency: payment.currency,
          description: 'Payment'
        }));

        return NextResponse.json({ payments: paymentIntentPayments });
      }

      return NextResponse.json({ payments });
    } catch (stripeError) {
      console.error('Error fetching from Stripe:', stripeError);
      return NextResponse.json({ payments: [], error: stripeError.message });
    }

  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
