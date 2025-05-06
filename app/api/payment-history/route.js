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

    // Get the user's subscription from Firestore using a simplified approach
    const db = getFirestore();
    let stripeCustomerId = null;
    let subscriptionData = null;

    // Check the API path (subscriptions collection) - this is the most reliable location
    console.log('Checking for subscription data');
    const apiSubscriptionRef = db.collection('subscriptions').doc(userId);
    const apiSubscriptionSnapshot = await apiSubscriptionRef.get();

    if (apiSubscriptionSnapshot.exists) {
      subscriptionData = apiSubscriptionSnapshot.data();
      stripeCustomerId = subscriptionData.stripeCustomerId;
      console.log('Found subscription data:', {
        status: subscriptionData.status,
        stripeCustomerId: stripeCustomerId || 'null'
      });
    }

    // If no stripeCustomerId found, try to generate synthetic payment history
    if (!stripeCustomerId) {
      console.log('No Stripe customer ID found, generating synthetic payment history');

      // If we have subscription data but no customer ID, we can still generate some history
      if (subscriptionData && subscriptionData.amount && subscriptionData.createdAt) {
        const syntheticPayments = generateSyntheticPaymentHistory(subscriptionData);
        return NextResponse.json({
          payments: syntheticPayments,
          synthetic: true,
          message: 'No Stripe customer ID found, showing estimated payment history'
        });
      }

      // No subscription data at all
      return NextResponse.json({
        payments: [],
        message: 'No subscription data found'
      });
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

        // If still no payments found, try to generate synthetic history
        if (paymentIntentPayments.length === 0 && subscriptionData) {
          console.log('No payment intents found, generating synthetic payment history');
          const syntheticPayments = generateSyntheticPaymentHistory(subscriptionData);
          return NextResponse.json({
            payments: syntheticPayments,
            synthetic: true,
            message: 'No payment records found in Stripe, showing estimated payment history'
          });
        }

        return NextResponse.json({ payments: paymentIntentPayments });
      }

      return NextResponse.json({ payments });
    } catch (stripeError) {
      console.error('Error fetching from Stripe:', stripeError);

      // If Stripe error, try to generate synthetic history
      if (subscriptionData) {
        console.log('Stripe error, generating synthetic payment history');
        const syntheticPayments = generateSyntheticPaymentHistory(subscriptionData);
        return NextResponse.json({
          payments: syntheticPayments,
          synthetic: true,
          message: 'Error fetching from Stripe, showing estimated payment history'
        });
      }

      return NextResponse.json({
        payments: [],
        error: stripeError.message
      });
    }
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// Helper function to generate synthetic payment history based on subscription data
function generateSyntheticPaymentHistory(subscriptionData) {
  const payments = [];

  try {
    // Get subscription amount
    const amount = subscriptionData.amount || 0;

    // If no amount, return empty array
    if (amount <= 0) {
      return payments;
    }

    // Get creation date
    let createdAt;
    if (subscriptionData.createdAt) {
      // Handle Firebase Timestamp or ISO string
      createdAt = subscriptionData.createdAt.toDate
        ? subscriptionData.createdAt.toDate()
        : new Date(subscriptionData.createdAt);
    } else {
      // Default to 3 months ago if no creation date
      createdAt = new Date();
      createdAt.setMonth(createdAt.getMonth() - 3);
    }

    // Get current date
    const now = new Date();

    // Generate monthly payments from creation date to now
    let currentDate = new Date(createdAt);

    // Add initial payment
    payments.push({
      id: `synthetic-${Date.now()}-initial`,
      amount: amount,
      status: 'succeeded',
      created: Math.floor(currentDate.getTime() / 1000), // Convert to Unix timestamp
      currency: 'usd',
      description: 'Initial subscription payment',
      synthetic: true
    });

    // Add monthly payments
    currentDate.setMonth(currentDate.getMonth() + 1);
    let counter = 1;

    while (currentDate < now && counter < 12) { // Limit to 12 months
      // Only add if the date is in the past
      if (currentDate <= now) {
        payments.push({
          id: `synthetic-${Date.now()}-${counter}`,
          amount: amount,
          status: 'succeeded',
          created: Math.floor(currentDate.getTime() / 1000), // Convert to Unix timestamp
          currency: 'usd',
          description: 'Monthly subscription payment',
          synthetic: true
        });
      }

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
      counter++;
    }

    // Sort by date (newest first)
    payments.sort((a, b) => b.created - a.created);

    return payments;
  } catch (error) {
    console.error('Error generating synthetic payment history:', error);
    return [];
  }
}

// Also support POST method for backward compatibility
export async function POST(request) {
  return GET(request);
}
