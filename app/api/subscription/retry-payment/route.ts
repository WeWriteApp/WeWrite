import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from '../../../firebase/admin';
import { getUserIdFromRequest } from '../../auth-helper';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { checkPaymentsFeatureFlag } from '../../feature-flag-helper';

// Initialize Firebase Admin lazily
let db: any;

function initializeFirebase() {
  if (db) return { db }; // Already initialized

  try {
    const app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { db: null };
    }

    db = getFirestore();
  } catch (error) {
    console.error('Error initializing Firebase Admin in retry-payment route:', error);
    return { db: null };
  }

  return { db };
}

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2025-04-30.basil' as any});

// POST /api/subscription/retry-payment - Retry a failed payment
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase lazily
    const { db: firestore } = initializeFirebase();

    if (!firestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Update local reference
    db = firestore;

    // Check if payments feature is enabled
    const featureCheckResponse = await checkPaymentsFeatureFlag();
    if (featureCheckResponse) {
      return featureCheckResponse;
    }

    // Get user ID from request
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's subscription using Admin SDK
    const subscriptionRef = db.collection('users').doc(userId).collection('subscription').doc('current');
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const subscriptionData = subscriptionDoc.data();

    if (subscriptionData.status !== 'past_due') {
      return NextResponse.json({ 
        error: 'Subscription is not in past_due status' 
      }, { status: 400 });
    }

    if (!subscriptionData.stripeSubscriptionId) {
      return NextResponse.json({ 
        error: 'No Stripe subscription ID found' 
      }, { status: 400 });
    }

    // Get the latest invoice for this subscription
    const invoices = await stripe.invoices.list({
      subscription: subscriptionData.stripeSubscriptionId,
      status: 'open',
      limit: 1});

    if (invoices.data.length === 0) {
      return NextResponse.json({ 
        error: 'No open invoices found for retry' 
      }, { status: 404 });
    }

    const invoice = invoices.data[0];

    // Attempt to pay the invoice
    try {
      const paidInvoice = await stripe.invoices.pay(invoice.id);

      if (paidInvoice.status === 'paid') {
        // Reset failure count and update status using Admin SDK
        await subscriptionRef.update({
          status: 'active',
          failureCount: 0,
          lastPaymentAt: new Date().toISOString(),
          lastFailedPaymentAt: null,
          lastFailedInvoiceId: null,
          updatedAt: FieldValue.serverTimestamp()});

        return NextResponse.json({ 
          success: true,
          message: 'Payment retry successful',
          invoice: {
            id: paidInvoice.id,
            amount: paidInvoice.amount_paid / 100,
            status: paidInvoice.status
          }
        });
      } else {
        // Payment still failed
        const newFailureCount = (subscriptionData.failureCount || 0) + 1;
        
        await subscriptionRef.update({
          failureCount: newFailureCount,
          lastFailedPaymentAt: new Date().toISOString(),
          lastFailedInvoiceId: invoice.id,
          updatedAt: FieldValue.serverTimestamp()});

        return NextResponse.json({ 
          error: 'Payment retry failed',
          details: 'The payment method was declined',
          failureCount: newFailureCount
        }, { status: 402 });
      }
    } catch (stripeError: any) {
      console.error('Stripe payment retry error:', stripeError);
      
      // Update failure count
      const newFailureCount = (subscriptionData.failureCount || 0) + 1;
      
      await updateDoc(subscriptionRef, {
        failureCount: newFailureCount,
        lastFailedPaymentAt: new Date().toISOString(),
        lastFailedInvoiceId: invoice.id,
        updatedAt: serverTimestamp()});

      // Determine error message based on Stripe error
      let errorMessage = 'Payment retry failed';
      if (stripeError.code === 'card_declined') {
        errorMessage = 'Your card was declined. Please try a different payment method.';
      } else if (stripeError.code === 'insufficient_funds') {
        errorMessage = 'Insufficient funds. Please check your account balance.';
      } else if (stripeError.code === 'expired_card') {
        errorMessage = 'Your card has expired. Please update your payment method.';
      }

      return NextResponse.json({ 
        error: errorMessage,
        code: stripeError.code,
        failureCount: newFailureCount
      }, { status: 402 });
    }

  } catch (error: any) {
    console.error('Error retrying payment:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

// GET method not allowed
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}