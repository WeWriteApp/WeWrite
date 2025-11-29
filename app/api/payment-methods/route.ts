import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '../../firebase/admin';
import { getUserIdFromRequest } from '../auth-helper';
import { getCollectionName } from '../../utils/environmentConfig';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../utils/stripeConfig';


// Initialize Firebase Admin lazily
let db: any;
const debugLogging = process.env.PAYMENT_METHODS_DEBUG === 'true';
const debugLog = (...args: unknown[]) => {
  if (debugLogging) console.log(...args);
};

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
    console.error('Error initializing Firebase Admin in payment-methods route:', error);
    return { db: null };
  }

  return { db };
}

// Get the appropriate Stripe key based on environment
const stripeSecretKey = getStripeSecretKey();
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-04-30.basil' as any});

// GET /api/payment-methods - Get all payment methods for the current user (v4)
export async function GET(request: NextRequest) {
  debugLog('🔥 PAYMENT METHODS API CALLED v4');
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

    // Payments feature is now always enabled - no feature flag check needed

    // Get the user's customer ID from Firestore
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    const userData = userDoc.data();

    debugLog('[PAYMENT METHODS] User data:', { userId, hasUserData: !!userData, stripeCustomerId: userData?.stripeCustomerId });

    if (!userData || !userData.stripeCustomerId) {
      debugLog('[PAYMENT METHODS] No Stripe customer ID found, returning empty array');
      return NextResponse.json({ paymentMethods: [] }, { status: 200 });
    }

    // Get the user's payment methods from Stripe
    debugLog('[PAYMENT METHODS] Fetching payment methods from Stripe for customer:', userData.stripeCustomerId);
    const paymentMethods = await stripe.paymentMethods.list({
      customer: userData.stripeCustomerId,
      type: 'card'});

    debugLog('[PAYMENT METHODS] Stripe response:', { count: paymentMethods.data.length, methods: paymentMethods.data.map(pm => ({ id: pm.id, last4: pm.card?.last4, brand: pm.card?.brand })) });

    // Get the user's payment methods metadata from Firestore
    const paymentMethodsDoc = await db.collection(getCollectionName('users')).doc(userId).collection('paymentMethods').doc('metadata').get();
    const paymentMethodsData = paymentMethodsDoc.exists ? paymentMethodsDoc.data() : { primary: null, order: [] };
    debugLog('[PAYMENT METHODS] Firestore metadata:', paymentMethodsData);

    // Format the payment methods
    const formattedPaymentMethods = paymentMethods.data.map(method => {
      const isPrimary = method.id === paymentMethodsData.primary;

      // Handle different payment method types
      if (method.type === 'card' && method.card) {
        return {
          id: method.id,
          type: 'card',
          brand: method.card.brand || 'unknown',
          last4: method.card.last4 || '****',
          expMonth: method.card.exp_month || 0,
          expYear: method.card.exp_year || 0,
          isPrimary
        };
      } else if (method.type === 'us_bank_account' && method.us_bank_account) {
        return {
          id: method.id,
          type: 'us_bank_account',
          bankName: method.us_bank_account.bank_name || 'Bank Account',
          last4: method.us_bank_account.last4 || '****',
          accountType: method.us_bank_account.account_type || 'checking',
          isPrimary
        };
      } else if (method.type === 'sepa_debit' && method.sepa_debit) {
        return {
          id: method.id,
          type: 'sepa_debit',
          bankCode: method.sepa_debit.bank_code || '',
          last4: method.sepa_debit.last4 || '****',
          isPrimary
        };
      } else {
        // Generic fallback for other payment method types
        return {
          id: method.id,
          type: method.type,
          brand: method.type,
          last4: '****',
          isPrimary
        };
      }
    });

    // Sort payment methods: primary first, then by order in metadata
    formattedPaymentMethods.sort((a, b) => {
      if (a.isPrimary) return -1;
      if (b.isPrimary) return 1;

      const aIndex = paymentMethodsData.order.indexOf(a.id);
      const bIndex = paymentMethodsData.order.indexOf(b.id);

      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    });

    debugLog('[PAYMENT METHODS] Returning payment methods:', { count: formattedPaymentMethods.length, methods: formattedPaymentMethods });
    return NextResponse.json({ paymentMethods: formattedPaymentMethods }, { status: 200 });
  } catch (error: any) {
    console.error('[PAYMENT METHODS] Error getting payment methods:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// HEAD handler to avoid 405s from health checks/preflight
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: { 'Allow': 'GET,POST,DELETE,HEAD,OPTIONS' } });
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { status: 200, headers: { 'Allow': 'GET,POST,DELETE,HEAD,OPTIONS' } });
}

// POST /api/payment-methods - Mirror GET for clients that still POST
export async function POST(request: NextRequest) {
  return GET(request);
}

// DELETE /api/payment-methods - Delete a payment method
export async function DELETE(request: NextRequest) {
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

    // Payments feature is now always enabled - no feature flag check needed

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

    // Get the payment methods metadata
    const paymentMethodsDoc = await db.collection('users').doc(userId).collection('paymentMethods').doc('metadata').get();
    const paymentMethodsData = paymentMethodsDoc.exists ? paymentMethodsDoc.data() : { primary: null, order: [] };

    // Check if this is the primary payment method
    const isPrimary = paymentMethodId === paymentMethodsData.primary;

    // Detach the payment method from the customer
    await stripe.paymentMethods.detach(paymentMethodId);

    // Update the payment methods metadata
    const updatedOrder = paymentMethodsData.order.filter((id: string) => id !== paymentMethodId);
    let updatedPrimary = paymentMethodsData.primary;

    if (isPrimary) {
      // If we're deleting the primary payment method, set the next one as primary
      updatedPrimary = updatedOrder.length > 0 ? updatedOrder[0] : null;
    }

    await db.collection('users').doc(userId).collection('paymentMethods').doc('metadata').set({
      primary: updatedPrimary,
      order: updatedOrder}, { merge: true });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting payment method:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
