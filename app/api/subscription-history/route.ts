/**
 * Subscription History API
 * 
 * Provides comprehensive subscription history including:
 * - Subscription changes (upgrades, downgrades, cancellations)
 * - Payment history
 * - Audit trail of subscription events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { getCollectionName } from '../../utils/environmentConfig';
import { initAdmin } from '../../firebase/admin';
import Stripe from 'stripe';

// Initialize Firebase Admin
const admin = initAdmin();
const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

interface SubscriptionHistoryEvent {
  id: string;
  type: 'subscription_created' | 'subscription_updated' | 'subscription_cancelled' | 'subscription_reactivated' | 'payment_succeeded' | 'payment_failed' | 'payment_recovered' | 'plan_changed' | 'refund_issued';
  timestamp: Date;
  description: string;
  details: {
    oldValue?: any;
    newValue?: any;
    amount?: number;
    currency?: string;
    stripeEventId?: string;
    failureReason?: string;
    failureCount?: number;
    failureType?: string;
    previousFailureCount?: number;
    refundReason?: string;
    refundStatus?: string;
    metadata?: Record<string, any>;
  };
  source: 'stripe' | 'system' | 'user';
}

async function getSubscriptionHistory(userId: string): Promise<SubscriptionHistoryEvent[]> {
  const events: SubscriptionHistoryEvent[] = [];

  try {
    console.log(`[SUBSCRIPTION HISTORY] Getting history for user: ${userId}`);

    // 1. Get audit trail events for this user
    try {
      // Try the full query first, but fall back to simpler queries if index doesn't exist
      let auditSnapshot;

      try {
        const auditQuery = db.collection(getCollectionName('auditTrail'))
          .where('userId', '==', userId)
          .where('entityType', '==', 'subscription')
          .orderBy('timestamp', 'desc')
          .limit(50);

        auditSnapshot = await auditQuery.get();
      } catch (indexError) {
        console.warn('[SUBSCRIPTION HISTORY] Composite index not available, trying simpler query:', indexError.message);

        // Fall back to simpler query without orderBy
        const simpleQuery = db.collection(getCollectionName('auditTrail'))
          .where('userId', '==', userId)
          .where('entityType', '==', 'subscription')
          .limit(50);

        auditSnapshot = await simpleQuery.get();
      }

      auditSnapshot.forEach((doc) => {
        const auditEvent = doc.data();

        // Convert audit events to subscription history events
        const historyEvent: SubscriptionHistoryEvent = {
          id: doc.id,
          type: auditEvent.eventType as any,
          timestamp: auditEvent.timestamp?.toDate() || new Date(),
          description: auditEvent.description || 'Subscription event',
          details: {
            amount: auditEvent.metadata?.amount,
            currency: auditEvent.metadata?.currency,
            stripeEventId: auditEvent.metadata?.stripeSubscriptionId || auditEvent.metadata?.stripeInvoiceId,
            failureReason: auditEvent.metadata?.failureReason,
            failureCount: auditEvent.metadata?.failureCount,
            failureType: auditEvent.metadata?.failureType,
            previousFailureCount: auditEvent.metadata?.previousFailureCount,
            metadata: {
              ...auditEvent.metadata,
              correlationId: auditEvent.correlationId,
              severity: auditEvent.severity,
              hostedInvoiceUrl: auditEvent.metadata?.hostedInvoiceUrl
            }
          },
          source: auditEvent.source || 'system'
        };

        events.push(historyEvent);
      });

      console.log(`[SUBSCRIPTION HISTORY] Found ${events.length} audit events for user ${userId}`);
    } catch (auditError) {
      console.warn('[SUBSCRIPTION HISTORY] Could not fetch audit events:', auditError.message || auditError);
      // Continue with Stripe data even if audit trail fails - this is expected for new installations
    }

    // 2. Get user's Stripe customer ID
    const userDocRef = db.collection(getCollectionName('users')).doc(userId);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      const stripeCustomerId = userData?.stripeCustomerId;

      if (stripeCustomerId) {
        try {
          console.log(`[SUBSCRIPTION HISTORY] Found Stripe customer ID: ${stripeCustomerId}`);

          // 3. Get payment history from Stripe
          const invoices = await stripe.invoices.list({
            customer: stripeCustomerId,
            limit: 20,
            expand: ['data.subscription']
          });

        invoices.data.forEach((invoice) => {
          events.push({
            id: `payment_${invoice.id}`,
            type: invoice.status === 'paid' ? 'payment_succeeded' : 'payment_failed',
            timestamp: new Date(invoice.created * 1000),
            description: `Payment ${invoice.status === 'paid' ? 'succeeded' : 'failed'} for subscription`,
            details: {
              amount: invoice.amount_paid / 100,
              currency: invoice.currency.toUpperCase(),
              stripeEventId: invoice.id,
              metadata: {
                invoiceNumber: invoice.number,
                hostedInvoiceUrl: invoice.hosted_invoice_url
              }
            },
            source: 'stripe'
          });
        });

        // 4. Get subscription events from Stripe
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          limit: 10,
          expand: ['data.items.data.price']
        });

        // Get subscription creation events
        subscriptions.data.forEach((subscription) => {
          events.push({
            id: `sub_created_${subscription.id}`,
            type: 'subscription_created',
            timestamp: new Date(subscription.created * 1000),
            description: `Subscription created`,
            details: {
              amount: subscription.items.data[0]?.price.unit_amount ? subscription.items.data[0].price.unit_amount / 100 : 0,
              currency: subscription.currency.toUpperCase(),
              stripeEventId: subscription.id,
              metadata: {
                status: subscription.status,
                interval: subscription.items.data[0]?.price.recurring?.interval
              }
            },
            source: 'stripe'
          });

          // Add cancellation event if subscription was cancelled
          if (subscription.canceled_at) {
            events.push({
              id: `sub_cancelled_${subscription.id}`,
              type: 'subscription_cancelled',
              timestamp: new Date(subscription.canceled_at * 1000),
              description: `Subscription cancelled`,
              details: {
                stripeEventId: subscription.id,
                metadata: {
                  cancelAtPeriodEnd: subscription.cancel_at_period_end,
                  cancellationReason: subscription.cancellation_details?.reason
                }
              },
              source: 'stripe'
            });
          }
        });

        // 5. Get refunds from Stripe
        try {
          const refunds = await stripe.refunds.list({
            customer: stripeCustomerId,
            limit: 20
          });

          refunds.data.forEach((refund) => {
            events.push({
              id: `refund_${refund.id}`,
              type: 'refund_issued',
              timestamp: new Date(refund.created * 1000),
              description: `Refund issued by WeWrite`,
              details: {
                amount: refund.amount / 100,
                currency: refund.currency.toUpperCase(),
                stripeEventId: refund.id,
                refundReason: refund.reason || 'No reason provided',
                refundStatus: refund.status,
                metadata: {
                  chargeId: refund.charge,
                  receiptNumber: refund.receipt_number
                }
              },
              source: 'stripe'
            });
          });

          console.log(`[SUBSCRIPTION HISTORY] Found ${refunds.data.length} refunds for customer ${stripeCustomerId}`);
        } catch (refundError) {
          console.warn('[SUBSCRIPTION HISTORY] Error fetching refunds from Stripe:', refundError.message || refundError);
          // Continue even if refund fetching fails
        }

        } catch (stripeError) {
          console.warn('[SUBSCRIPTION HISTORY] Error fetching from Stripe:', stripeError.message || stripeError);
          // Continue even if Stripe API fails
        }
      } else {
        console.log(`[SUBSCRIPTION HISTORY] No Stripe customer ID found for user ${userId}`);
      }
    } else {
      console.log(`[SUBSCRIPTION HISTORY] User document not found for user ${userId}`);
    }

    // 5. Sort all events by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return events;

  } catch (error) {
    console.error('Error fetching subscription history:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[SUBSCRIPTION HISTORY API] Starting request');

    // Get authenticated user ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.log('[SUBSCRIPTION HISTORY API] No user ID found - unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[SUBSCRIPTION HISTORY API] Processing request for user: ${userId}`);

    // Check if a specific userId is requested via query parameter (for admin access)
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get('userId');
    const targetUserId = requestedUserId || userId;

    // For now, only allow users to access their own history
    // TODO: Add admin access control
    if (targetUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const history = await getSubscriptionHistory(targetUserId);

    console.log(`[SUBSCRIPTION HISTORY API] Successfully fetched ${history.length} events for user ${targetUserId}`);

    return NextResponse.json({
      success: true,
      history,
      count: history.length
    });

  } catch (error) {
    console.error('[SUBSCRIPTION HISTORY API] Error:', error);
    console.error('[SUBSCRIPTION HISTORY API] Error stack:', error.stack);

    return NextResponse.json(
      {
        error: 'Failed to fetch subscription history',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
