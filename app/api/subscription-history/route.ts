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
  type: 'subscription_created' | 'subscription_updated' | 'subscription_cancelled' | 'subscription_reactivated' | 'payment_succeeded' | 'payment_failed' | 'payment_recovered' | 'plan_changed';
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
      const auditQuery = db.collection(getCollectionName('auditTrail'))
        .where('userId', '==', userId)
        .where('entityType', '==', 'subscription')
        .orderBy('timestamp', 'desc')
        .limit(50);

      const auditSnapshot = await auditQuery.get();

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
      console.warn('[SUBSCRIPTION HISTORY] Could not fetch audit events:', auditError);
      // Continue with Stripe data even if audit trail fails
    }

    // 2. Get user's Stripe customer ID
    const userDocRef = db.collection(getCollectionName('users')).doc(userId);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      const stripeCustomerId = userData.stripeCustomerId;

      if (stripeCustomerId) {
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
      }
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
    // Get authenticated user ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    return NextResponse.json({
      success: true,
      history,
      count: history.length
    });

  } catch (error) {
    console.error('Error fetching subscription history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription history' },
      { status: 500 }
    );
  }
}
