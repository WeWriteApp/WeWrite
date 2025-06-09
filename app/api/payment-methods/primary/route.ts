import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '../../../firebase/admin';
import { getUserIdFromRequest } from '../../auth-helper';
import Stripe from 'stripe';

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
    console.error('Error initializing Firebase Admin in payment-methods/primary route:', error);
    return { db: null };
  }

  return { db };
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil' as any,
});

// POST /api/payment-methods/primary - Set a payment method as primary
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase lazily
    const { db: firestore } = initializeFirebase();

    if (!firestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Update local reference
    db = firestore;

    // Get user ID from request using our helper
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the payment method ID from the request body
    const { paymentMethodId } = await request.json();

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
    }

    // Get the user's customer ID from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData || !userData.stripeCustomerId) {
      return NextResponse.json({ error: 'User not found or no Stripe customer ID' }, { status: 404 });
    }

    // Verify that the payment method exists and belongs to the customer
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      if (paymentMethod.customer !== userData.stripeCustomerId) {
        return NextResponse.json({ error: 'Payment method does not belong to this customer' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    // Get the payment methods metadata
    const paymentMethodsDoc = await db.collection('users').doc(userId).collection('paymentMethods').doc('metadata').get();
    const paymentMethodsData = paymentMethodsDoc.exists ? paymentMethodsDoc.data() : { primary: null, order: [] };

    // Update the primary payment method
    await db.collection('users').doc(userId).collection('paymentMethods').doc('metadata').set({
      primary: paymentMethodId,
    }, { merge: true });

    // If the payment method is not in the order array, add it
    if (!paymentMethodsData.order.includes(paymentMethodId)) {
      await db.collection('users').doc(userId).collection('paymentMethods').doc('metadata').update({
        order: [...paymentMethodsData.order, paymentMethodId],
      });
    }

    // Update the default payment method on the Stripe customer
    await stripe.customers.update(userData.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // If the user has an active subscription, update the default payment method
    const subscriptionDoc = await db.collection('users').doc(userId).collection('subscriptions').doc('current').get();

    if (subscriptionDoc.exists) {
      const subscriptionData = subscriptionDoc.data();

      if (subscriptionData && subscriptionData.stripeSubscriptionId &&
          (subscriptionData.status === 'active' || subscriptionData.status === 'trialing')) {

        try {
          await stripe.subscriptions.update(subscriptionData.stripeSubscriptionId, {
            default_payment_method: paymentMethodId,
          });
        } catch (error) {
          console.error('Error updating subscription payment method:', error);
          // Continue even if this fails
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error setting primary payment method:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
