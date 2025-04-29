import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '../../firebase/admin';
import { getStripeSecretKey } from '../../utils/stripeConfig';

// Initialize Firebase Admin
initAdmin();

// Initialize Stripe with the appropriate key based on environment
const stripeSecretKey = getStripeSecretKey();
const stripe = new Stripe(stripeSecretKey);
console.log('Stripe initialized for payment history');

export async function GET(request) {
  try {
    // Get userId from query parameters
    const url = new URL(request.url);
    let userId = url.searchParams.get('userId');

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

// Also support POST method for backward compatibility
export async function POST(request) {
  return GET(request);
}
