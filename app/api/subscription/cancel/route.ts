/**
 * Subscription Cancel API
 * 
 * Cancels subscriptions with test subscription detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { initAdmin } from '../../../firebase/admin';
import { subscriptionAuditService } from '../../../services/subscriptionAuditService';

// Initialize Firebase Admin
const admin = initAdmin();
const adminDb = admin.firestore();
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
    const { subscriptionId, cancelImmediately = false } = body;

    if (!subscriptionId) {
      return NextResponse.json({ 
        error: 'subscriptionId is required' 
      }, { status: 400 });
    }

    console.log(`[SUBSCRIPTION CANCEL] User ${userId} cancelling subscription ${subscriptionId}, immediate: ${cancelImmediately}`);

    // Check if this is a test subscription
    const isTestSubscription = subscriptionId.startsWith('sub_test_');
    
    let cancelledSubscription;
    
    if (isTestSubscription) {
      // Handle test subscription - skip Stripe API calls
      console.log(`[SUBSCRIPTION CANCEL] Detected test subscription ${subscriptionId}, skipping Stripe API`);
      
      cancelledSubscription = {
        id: subscriptionId,
        status: cancelImmediately ? 'canceled' : 'active',
        cancel_at_period_end: !cancelImmediately,
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        canceled_at: cancelImmediately ? Math.floor(Date.now() / 1000) : null
      };
    } else {
      // Handle real subscription - call Stripe API
      try {
        if (cancelImmediately) {
          // Cancel immediately
          cancelledSubscription = await stripe.subscriptions.cancel(subscriptionId);
        } else {
          // Cancel at period end
          cancelledSubscription = await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true
          });
        }

        console.log(`[SUBSCRIPTION CANCEL] Successfully cancelled Stripe subscription ${subscriptionId}`);
      } catch (stripeError) {
        console.error('[SUBSCRIPTION CANCEL] Stripe API error:', stripeError);
        return NextResponse.json({ 
          error: 'Failed to cancel subscription in Stripe' 
        }, { status: 500 });
      }
    }

    // Update subscription in Firestore
    const subscriptionData = {
      status: cancelledSubscription.status,
      cancelAtPeriodEnd: cancelledSubscription.cancel_at_period_end,
      canceledAt: cancelledSubscription.canceled_at ? new Date(cancelledSubscription.canceled_at * 1000) : null,
      updatedAt: serverTimestamp()
    };

    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS, 
      userId, 
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );
    
    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
    await subscriptionRef.update(subscriptionData);

    console.log(`[SUBSCRIPTION CANCEL] Successfully updated subscription status for user ${userId}`);

    // Log subscription cancellation for audit trail
    try {
      await subscriptionAuditService.logSubscriptionCancelled(
        userId,
        { ...subscriptionData, stripeSubscriptionId: subscriptionId },
        {
          source: 'user',
          correlationId: `cancel_${subscriptionId}`,
          reason: cancelImmediately ? 'immediate_cancellation' : 'cancel_at_period_end',
          metadata: {
            cancelImmediately,
            isTestSubscription,
            stripeSubscriptionId: subscriptionId
          }
        }
      );
    } catch (auditError) {
      console.warn('[SUBSCRIPTION CANCEL] Failed to log audit event:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      subscription: subscriptionData
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to cancel subscription.' },
    { status: 405 }
  );
}
