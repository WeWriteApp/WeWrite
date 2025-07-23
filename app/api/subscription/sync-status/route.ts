import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[SUBSCRIPTION SYNC] Syncing subscription status for user ${userId}`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[SUBSCRIPTION SYNC] Firebase Admin not available');
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    const adminDb = admin.firestore();
    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS,
      userId,
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );

    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      return NextResponse.json({ 
        error: 'No subscription found',
        synced: false 
      }, { status: 404 });
    }

    const subscriptionData = subscriptionDoc.data();
    const stripeSubscriptionId = subscriptionData?.stripeSubscriptionId;

    // If no Stripe subscription ID, mark as cancelled
    if (!stripeSubscriptionId) {
      console.log(`[SUBSCRIPTION SYNC] No Stripe subscription ID found, marking as cancelled`);
      
      await subscriptionRef.update({
        status: 'cancelled',
        canceledAt: new Date().toISOString(),
        syncedAt: FieldValue.serverTimestamp(),
        syncReason: 'missing_stripe_id',
        updatedAt: FieldValue.serverTimestamp()
      });

      return NextResponse.json({
        synced: true,
        changes: {
          status: 'cancelled',
          reason: 'No Stripe subscription ID found'
        }
      });
    }

    // Check subscription status in Stripe
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      
      console.log(`[SUBSCRIPTION SYNC] Stripe subscription status: ${stripeSubscription.status}`);
      
      const updates: any = {
        syncedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      let changes: any = {};

      // Update status if different
      if (subscriptionData.status !== stripeSubscription.status) {
        updates.status = stripeSubscription.status;
        changes.status = {
          from: subscriptionData.status,
          to: stripeSubscription.status
        };

        // If cancelled in Stripe, add cancellation timestamp
        if (stripeSubscription.status === 'canceled') {
          updates.canceledAt = new Date().toISOString();
          updates.syncReason = 'cancelled_in_stripe';
          changes.canceledAt = new Date().toISOString();
        }
      }

      // Update cancel_at_period_end if different
      if (subscriptionData.cancelAtPeriodEnd !== stripeSubscription.cancel_at_period_end) {
        updates.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
        changes.cancelAtPeriodEnd = {
          from: subscriptionData.cancelAtPeriodEnd,
          to: stripeSubscription.cancel_at_period_end
        };
      }

      // Update current period end
      const newPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
      if (!subscriptionData.currentPeriodEnd || 
          new Date(subscriptionData.currentPeriodEnd).getTime() !== newPeriodEnd.getTime()) {
        updates.currentPeriodEnd = newPeriodEnd;
        changes.currentPeriodEnd = {
          from: subscriptionData.currentPeriodEnd,
          to: newPeriodEnd.toISOString()
        };
      }

      // Apply updates if any changes detected
      if (Object.keys(changes).length > 0) {
        await subscriptionRef.update(updates);
        console.log(`[SUBSCRIPTION SYNC] Updated subscription with changes:`, changes);
      } else {
        console.log(`[SUBSCRIPTION SYNC] No changes needed, subscription is in sync`);
      }

      return NextResponse.json({
        synced: true,
        changes: Object.keys(changes).length > 0 ? changes : null,
        stripeStatus: stripeSubscription.status,
        localStatus: subscriptionData.status
      });

    } catch (stripeError: any) {
      console.error(`[SUBSCRIPTION SYNC] Error fetching from Stripe:`, stripeError);
      
      // If subscription not found in Stripe, mark as cancelled
      if (stripeError.code === 'resource_missing') {
        await subscriptionRef.update({
          status: 'cancelled',
          canceledAt: new Date().toISOString(),
          syncedAt: FieldValue.serverTimestamp(),
          syncReason: 'not_found_in_stripe',
          updatedAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
          synced: true,
          changes: {
            status: 'cancelled',
            reason: 'Subscription not found in Stripe'
          }
        });
      }

      throw stripeError;
    }

  } catch (error) {
    console.error('[SUBSCRIPTION SYNC] Error syncing subscription status:', error);
    return NextResponse.json({ 
      error: 'Failed to sync subscription status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
