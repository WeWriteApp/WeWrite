/**
 * Force Subscription Synchronization API
 * 
 * Manually synchronizes subscription status with Stripe when there are discrepancies
 * between the local Firestore data and Stripe's actual subscription status.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUserIdFromRequest } from '../../auth-helper';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserSubscriptionServer, updateSubscriptionServer } from '../../../firebase/subscription-server';
import { calculateTokensForAmount } from '../../../utils/subscriptionTiers';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        error: 'Authentication required. Please log in and try again.'
      }, { status: 401 });
    }

    console.log(`[FORCE SYNC] Starting subscription sync for user ${userId}`);

    // Get current subscription from Firestore
    const currentSubscription = await getUserSubscriptionServer(userId, { verbose: true });
    
    if (!currentSubscription) {
      return NextResponse.json({
        error: 'No subscription found in local database'
      }, { status: 404 });
    }

    // If we don't have a Stripe subscription ID, we can't sync
    if (!currentSubscription.stripeSubscriptionId) {
      console.log(`[FORCE SYNC] No Stripe subscription ID found for user ${userId}`);
      
      // Check if this is a recent subscription that might not have been processed yet
      const createdAt = currentSubscription.createdAt?.toDate?.() || currentSubscription.createdAt;
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      if (createdAt && createdAt > fiveMinutesAgo) {
        return NextResponse.json({
          message: 'Subscription is recent and may still be processing. Please wait a few minutes.',
          status: currentSubscription.status,
          needsWait: true
        });
      } else {
        // Old subscription without Stripe ID should be cancelled
        await updateSubscriptionServer(userId, {
          status: 'canceled',
          canceledAt: new Date().toISOString()
        });
        
        return NextResponse.json({
          message: 'Local subscription was stale and has been cancelled.',
          status: 'canceled',
          wasStale: true
        });
      }
    }

    // Fetch the subscription from Stripe
    let stripeSubscription: Stripe.Subscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(currentSubscription.stripeSubscriptionId);
    } catch (error: any) {
      console.error(`[FORCE SYNC] Failed to retrieve Stripe subscription ${currentSubscription.stripeSubscriptionId}:`, error);
      
      if (error.code === 'resource_missing') {
        // Subscription doesn't exist in Stripe, cancel it locally
        await updateSubscriptionServer(userId, {
          status: 'canceled',
          canceledAt: new Date().toISOString()
        });
        
        return NextResponse.json({
          message: 'Subscription not found in Stripe and has been cancelled locally.',
          status: 'canceled',
          wasNotFound: true
        });
      }
      
      return NextResponse.json({
        error: 'Failed to retrieve subscription from Stripe'
      }, { status: 500 });
    }

    // Compare and update if necessary
    const stripeStatus = stripeSubscription.status;
    const localStatus = currentSubscription.status;
    
    console.log(`[FORCE SYNC] Comparing statuses - Stripe: ${stripeStatus}, Local: ${localStatus}`);

    // Calculate amount and tokens from Stripe data
    const price = stripeSubscription.items.data[0]?.price;
    const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
    const tokens = calculateTokensForAmount(amount);

    // Prepare update data
    const updateData = {
      status: stripeStatus,
      amount: amount,
      tokens: tokens,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      updatedAt: new Date()
    };

    // Update local subscription
    await updateSubscriptionServer(userId, updateData);

    console.log(`[FORCE SYNC] Successfully synced subscription for user ${userId}: ${localStatus} -> ${stripeStatus}`);

    return NextResponse.json({
      success: true,
      message: 'Subscription status synchronized successfully',
      previousStatus: localStatus,
      currentStatus: stripeStatus,
      subscription: {
        id: stripeSubscription.id,
        status: stripeStatus,
        amount: amount,
        tokens: tokens,
        currentPeriodStart: updateData.currentPeriodStart,
        currentPeriodEnd: updateData.currentPeriodEnd,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
      },
      statusChanged: localStatus !== stripeStatus
    });

  } catch (error) {
    console.error('[FORCE SYNC] Error synchronizing subscription:', error);

    let errorMessage = 'Failed to synchronize subscription status';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
        errorMessage = 'Authentication failed. Please log in and try again.';
        statusCode = 401;
      } else if (error.message.includes('stripe') || error.message.includes('Stripe')) {
        errorMessage = 'Payment processing error. Please try again.';
        statusCode = 500;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
