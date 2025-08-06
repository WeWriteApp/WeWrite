/**
 * Subscription Update API
 * 
 * Modifies existing subscription amount/tier with test subscription detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getSubCollectionPath, PAYMENT_COLLECTIONS, getCollectionName } from '../../../utils/environmentConfig';
import { determineTierFromAmount } from '../../../utils/subscriptionTiers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { ServerUsdService } from '../../../services/usdService.server';

// Initialize Firebase Admin lazily
let admin: any;
let adminDb: any;
let FieldValue: any;

function initializeFirebase() {
  if (admin && adminDb && FieldValue) return { admin, adminDb, FieldValue }; // Already initialized

  try {
    admin = getFirebaseAdmin();
    if (!admin) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { admin: null, adminDb: null, FieldValue: null };
    }

    adminDb = admin.firestore();
    FieldValue = admin.firestore.FieldValue;
    console.log('Firebase Admin initialized successfully in subscription update route');
  } catch (error) {
    console.error('Error initializing Firebase Admin in subscription update route:', error);
    return { admin: null, adminDb: null, FieldValue: null };
  }

  return { admin, adminDb, FieldValue };
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase lazily
    const { admin: firebaseAdmin, adminDb: firestore, FieldValue: FirestoreFieldValue } = initializeFirebase();

    if (!firebaseAdmin || !firestore || !FirestoreFieldValue) {
      console.error('Firebase Admin not initialized properly in subscription update route');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Update local references
    admin = firebaseAdmin;
    adminDb = firestore;
    FieldValue = FirestoreFieldValue;

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId, newTier, newAmount, paymentMethodId } = body;

    if (!subscriptionId || !newAmount) {
      return NextResponse.json({ 
        error: 'subscriptionId and newAmount are required' 
      }, { status: 400 });
    }

    console.log(`[SUBSCRIPTION UPDATE] User ${userId} updating subscription ${subscriptionId} to $${newAmount}`);

    // Check if this is a test subscription or development environment
    const isTestSubscription = subscriptionId.startsWith('sub_test_') ||
                               process.env.NODE_ENV === 'development';
    
    let updatedSubscription;
    
    if (isTestSubscription) {
      // Handle test subscription - skip Stripe API calls
      console.log(`[SUBSCRIPTION UPDATE] Detected test subscription ${subscriptionId}, skipping Stripe API`);
      
      updatedSubscription = {
        id: subscriptionId,
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        items: {
          data: [{
            price: {
              unit_amount: newAmount * 100,
              currency: 'usd'
            }
          }]
        }
      };
    } else {
      // Handle real subscription - call Stripe API
      try {
        // Get current subscription to find the price ID
        const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPriceId = currentSubscription.items.data[0].price.id;
        
        // Create new price for the new amount
        const newPrice = await stripe.prices.create({
          unit_amount: newAmount * 100,
          currency: 'usd',
          recurring: { interval: 'month' },
          product: currentSubscription.items.data[0].price.product,
        });

        // Update subscription with new price
        updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
          items: [{
            id: currentSubscription.items.data[0].id,
            price: newPrice.id,
          }],
          proration_behavior: 'create_prorations',
        });

        // Update payment method if provided
        if (paymentMethodId) {
          try {
            await stripe.subscriptions.update(subscriptionId, {
              default_payment_method: paymentMethodId,
            });
            console.log(`[SUBSCRIPTION UPDATE] Updated payment method to ${paymentMethodId}`);
          } catch (paymentMethodError) {
            console.error('[SUBSCRIPTION UPDATE] Failed to update payment method:', paymentMethodError);
            // Don't fail the entire update if payment method update fails
          }
        }

        console.log(`[SUBSCRIPTION UPDATE] Successfully updated Stripe subscription ${subscriptionId}`);
      } catch (stripeError) {
        console.error('[SUBSCRIPTION UPDATE] Stripe API error:', stripeError);
        return NextResponse.json({ 
          error: 'Failed to update subscription in Stripe' 
        }, { status: 500 });
      }
    }

    // Get current subscription data for audit logging
    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS,
      userId,
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );

    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
    const currentSubscriptionDoc = await subscriptionRef.get();
    const oldSubscriptionData = currentSubscriptionDoc.data();

    // Update subscription in Firestore
    const tier = newTier || determineTierFromAmount(newAmount);

    // Safely handle timestamp conversion
    let currentPeriodEnd;
    try {
      if (updatedSubscription.current_period_end && typeof updatedSubscription.current_period_end === 'number') {
        currentPeriodEnd = new Date(updatedSubscription.current_period_end * 1000);
      } else {
        // Fallback for invalid timestamps - set to 30 days from now
        currentPeriodEnd = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
      }
    } catch (error) {
      console.warn('[SUBSCRIPTION UPDATE] Error converting timestamp, using fallback:', error);
      currentPeriodEnd = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
    }

    const subscriptionData = {
      status: updatedSubscription.status || 'active',
      amount: newAmount,
      tier,
      cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end || false,
      currentPeriodEnd,
      updatedAt: FieldValue.serverTimestamp()
    };

    // Update subscription in Firestore
    await subscriptionRef.update(subscriptionData);

    // Update user's USD allocation to reflect new subscription amount
    console.log(`[SUBSCRIPTION UPDATE] Updating USD allocation for user ${userId}: $${newAmount}`);
    await ServerUsdService.updateMonthlyUsdAllocation(userId, newAmount);

    // Simple logging - just log to console for now to avoid complex dependencies
    console.log(`[SUBSCRIPTION UPDATE] Successfully updated subscription:`, {
      userId,
      subscriptionId,
      oldAmount: oldSubscriptionData?.amount || 0,
      newAmount,
      oldTier: oldSubscriptionData?.tier || 'none',
      newTier: tier,
      isTestSubscription
    });

    console.log(`[SUBSCRIPTION UPDATE] Successfully updated subscription for user ${userId}`);

    return NextResponse.json({
      success: true,
      subscription: subscriptionData
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to update subscription.' },
    { status: 405 }
  );
}
