/**
 * Subscription Reactivate API
 * 
 * Reactivates cancelled subscriptions with test subscription detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { determineTierFromAmount } from '../../../utils/subscriptionTiers';
import { ServerUsdService } from '../../../services/usdService.server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { serverTimestamp } from 'firebase-admin/firestore';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId, newTier, newAmount } = body;

    if (!subscriptionId) {
      return NextResponse.json({ 
        error: 'subscriptionId is required' 
      }, { status: 400 });
    }

    console.log(`[SUBSCRIPTION REACTIVATE] User ${userId} reactivating subscription ${subscriptionId}`);

    // Check if this is a test subscription
    const isTestSubscription = subscriptionId.startsWith('sub_test_');
    
    let reactivatedSubscription;
    
    if (isTestSubscription) {
      // Handle test subscription - skip Stripe API calls
      console.log(`[SUBSCRIPTION REACTIVATE] Detected test subscription ${subscriptionId}, skipping Stripe API`);
      
      // Get current subscription data to determine amount
      const { parentPath, subCollectionName } = getSubCollectionPath(
        PAYMENT_COLLECTIONS.USERS, 
        userId, 
        PAYMENT_COLLECTIONS.SUBSCRIPTIONS
      );
      
      const admin = getFirebaseAdmin();
      const adminDb = admin.firestore();
      const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
      const subscriptionDoc = await subscriptionRef.get();
      const currentData = subscriptionDoc.data();
      
      const amount = newAmount || currentData?.amount || 10; // Default to $10 if no amount specified
      
      reactivatedSubscription = {
        id: subscriptionId,
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        items: {
          data: [{
            price: {
              unit_amount: amount * 100,
              currency: 'usd'
            }
          }]
        }
      };
    } else {
      // Handle real subscription - call Stripe API
      try {
        // First, check if subscription is cancelled at period end
        const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        if (currentSubscription.cancel_at_period_end) {
          // Reactivate by removing cancel_at_period_end
          reactivatedSubscription = await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: false
          });
        } else if (currentSubscription.status === 'canceled') {
          return NextResponse.json({ 
            error: 'Cannot reactivate a fully cancelled subscription. Please create a new subscription.' 
          }, { status: 400 });
        } else {
          // Subscription is already active
          reactivatedSubscription = currentSubscription;
        }

        // If amount change is requested, update the subscription
        if (newAmount && newAmount !== (reactivatedSubscription.items.data[0].price.unit_amount / 100)) {
          // Create new price for the new amount
          const newPrice = await stripe.prices.create({
            unit_amount: newAmount * 100,
            currency: 'usd',
            recurring: { interval: 'month' },
            product: reactivatedSubscription.items.data[0].price.product,
          });

          // Update subscription with new price
          reactivatedSubscription = await stripe.subscriptions.update(subscriptionId, {
            items: [{
              id: reactivatedSubscription.items.data[0].id,
              price: newPrice.id,
            }],
            proration_behavior: 'create_prorations',
          });
        }

        console.log(`[SUBSCRIPTION REACTIVATE] Successfully reactivated Stripe subscription ${subscriptionId}`);
      } catch (stripeError) {
        console.error('[SUBSCRIPTION REACTIVATE] Stripe API error:', stripeError);
        return NextResponse.json({ 
          error: 'Failed to reactivate subscription in Stripe' 
        }, { status: 500 });
      }
    }

    // Update subscription in Firestore
    const amount = newAmount || (reactivatedSubscription.items.data[0].price.unit_amount / 100);
    const tier = newTier || determineTierFromAmount(amount);

    const subscriptionData = {
      status: reactivatedSubscription.status,
      amount,
      tier,
      cancelAtPeriodEnd: reactivatedSubscription.cancel_at_period_end,
      currentPeriodEnd: new Date(reactivatedSubscription.current_period_end * 1000),
      canceledAt: null, // Clear cancelled date
      updatedAt: serverTimestamp()
    };

    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS, 
      userId, 
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );
    
    const admin = getFirebaseAdmin();
    const adminDb = admin.firestore();
    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
    await subscriptionRef.update(subscriptionData);

    // Update user's USD allocation
    await ServerUsdService.updateMonthlyUsdAllocation(userId, amount);

    console.log(`[SUBSCRIPTION REACTIVATE] Successfully reactivated subscription for user ${userId}`);

    return NextResponse.json({ 
      success: true, 
      subscription: subscriptionData 
    });

  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reactivate subscription' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to reactivate subscription.' },
    { status: 405 }
  );
}
