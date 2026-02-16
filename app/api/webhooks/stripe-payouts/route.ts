/**
 * Stripe webhook handler for payout-related events
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { webhookRateLimiter } from '../../../utils/rateLimiter';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { sendUserNotification } from '../../../utils/notifications';
import { webhookIdempotencyService } from '../../../services/webhookIdempotencyService';
import { getStripe } from '../../../lib/stripe';

const stripe = getStripe();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_PAYOUTS;

/**
 * Handle webhook events from Stripe
 */
async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  console.log(`[Webhook] Processing event: ${event.type}`);

  switch (event.type) {
    case 'transfer.created':
      await handleTransferCreated(event.data.object as Stripe.Transfer);
      break;

    case 'transfer.paid':
      await handleTransferPaid(event.data.object as Stripe.Transfer);
      break;

    case 'transfer.failed':
      await handleTransferFailed(event.data.object as Stripe.Transfer);
      break;

    case 'transfer.reversed':
      await handleTransferReversed(event.data.object as Stripe.Transfer);
      break;

    case 'payout.paid':
      await handlePayoutPaid(event.data.object as Stripe.Payout);
      break;

    case 'payout.failed':
      await handlePayoutFailed(event.data.object as Stripe.Payout);
      break;

    case 'account.updated':
      await handleAccountUpdated(event.data.object as Stripe.Account);
      break;

    default:
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
  }
}

/**
 * Handle transfer.created event - Log transfer initiation
 */
async function handleTransferCreated(transfer: Stripe.Transfer): Promise<void> {
  try {
    console.log(`[Webhook] Transfer created: ${transfer.id}`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[Webhook] Firebase Admin not available');
      return;
    }

    const db = admin.firestore();
    const payoutId = transfer.metadata?.payoutId;

    if (!payoutId) {
      console.warn(`[Webhook] No payoutId in transfer metadata: ${transfer.id}`);
      return;
    }

    // Log transfer initiation to audit trail
    await db.collection(getCollectionName('payoutAuditLogs')).add({
      payoutId,
      eventType: 'transfer_created',
      transferId: transfer.id,
      amount: transfer.amount / 100,
      currency: transfer.currency,
      destination: transfer.destination,
      metadata: transfer.metadata,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      rawEvent: {
        id: transfer.id,
        object: transfer.object,
        created: transfer.created
      }
    });

    console.log(`[Webhook] Transfer created logged for payout: ${payoutId}`);

  } catch (error) {
    console.error('[Webhook] Error handling transfer.created:', error);
    throw error;
  }
}

/**
 * Handle transfer.paid event - Update payout status to completed
 */
async function handleTransferPaid(transfer: Stripe.Transfer): Promise<void> {
  try {
    console.log(`[Webhook] Transfer paid: ${transfer.id}`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[Webhook] Firebase Admin not available');
      return;
    }

    const db = admin.firestore();
    const payoutId = transfer.metadata?.payoutId;
    const userId = transfer.metadata?.userId;

    if (!payoutId) {
      console.warn(`[Webhook] No payoutId in transfer metadata: ${transfer.id}`);
      return;
    }

    // Update payout status
    const payoutRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).doc(payoutId);
    const payoutDoc = await payoutRef.get();

    if (!payoutDoc.exists) {
      console.warn(`[Webhook] Payout not found: ${payoutId}`);
      return;
    }

    await payoutRef.update({
      status: 'completed',
      stripePayoutId: transfer.id,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log to audit trail
    await db.collection(getCollectionName('payoutAuditLogs')).add({
      payoutId,
      eventType: 'transfer_paid',
      transferId: transfer.id,
      amount: transfer.amount / 100,
      currency: transfer.currency,
      destination: transfer.destination,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      statusChange: {
        from: payoutDoc.data()?.status,
        to: 'completed'
      }
    });

    // Send user notification
    if (userId) {
      await sendUserNotification(userId, {
        type: 'payout_completed',
        title: 'Payout completed',
        body: `Your payout of $${(transfer.amount / 100).toFixed(2)} has been sent to your bank account.`,
        metadata: { payoutId, transferId: transfer.id, amount: transfer.amount }
      });
    }

    console.log(`[Webhook] Transfer paid processed for payout: ${payoutId}`);

  } catch (error) {
    console.error('[Webhook] Error handling transfer.paid:', error);
    throw error;
  }
}

/**
 * Handle transfer.failed event - Update payout status and trigger retry
 */
async function handleTransferFailed(transfer: Stripe.Transfer): Promise<void> {
  try {
    console.log(`[Webhook] Transfer failed: ${transfer.id}`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[Webhook] Firebase Admin not available');
      return;
    }

    const db = admin.firestore();
    const payoutId = transfer.metadata?.payoutId;
    const userId = transfer.metadata?.userId;

    if (!payoutId) {
      console.warn(`[Webhook] No payoutId in transfer metadata: ${transfer.id}`);
      return;
    }

    const failureMessage = transfer.failure_message || 'Transfer failed';
    const failureCode = transfer.failure_code || 'unknown';

    // Update payout status
    const payoutRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).doc(payoutId);
    const payoutDoc = await payoutRef.get();

    if (!payoutDoc.exists) {
      console.warn(`[Webhook] Payout not found: ${payoutId}`);
      return;
    }

    const currentRetryCount = payoutDoc.data()?.retryCount || 0;
    const maxRetries = 3;

    // Determine if retryable
    const retryableFailureCodes = [
      'account_closed',
      'insufficient_funds',
      'debit_not_authorized',
      'generic_decline',
      'processing_error',
      'rate_limit'
    ];
    const isRetryable = retryableFailureCodes.includes(failureCode) && currentRetryCount < maxRetries;

    if (isRetryable) {
      // Schedule retry with exponential backoff
      const retryDelayMinutes = Math.pow(2, currentRetryCount) * 5; // 5, 10, 20 minutes
      const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

      await payoutRef.update({
        status: 'pending',
        failureReason: failureMessage,
        failureCode: failureCode,
        retryCount: admin.firestore.FieldValue.increment(1),
        nextRetryAt: admin.firestore.Timestamp.fromDate(nextRetryAt),
        lastFailedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[Webhook] Retry scheduled for payout ${payoutId} at ${nextRetryAt.toISOString()}`);

      // Notify user of retry
      if (userId) {
        await sendUserNotification(userId, {
          type: 'payout_retry_scheduled',
          title: 'Payout will be retried',
          body: `Your payout encountered a temporary issue and will be retried automatically.`,
          metadata: { payoutId, failureReason: failureMessage, nextRetryAt: nextRetryAt.toISOString() }
        });
      }
    } else {
      // Mark as permanently failed
      await payoutRef.update({
        status: 'failed',
        failureReason: failureMessage,
        failureCode: failureCode,
        retryCount: admin.firestore.FieldValue.increment(1),
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[Webhook] Payout ${payoutId} marked as permanently failed`);

      // Notify user of failure
      if (userId) {
        await sendUserNotification(userId, {
          type: 'payout_failed',
          title: 'Payout failed',
          body: `Your payout could not be completed: ${failureMessage}. Please check your bank account details.`,
          metadata: { payoutId, failureReason: failureMessage }
        });
      }
    }

    // Log to audit trail
    await db.collection(getCollectionName('payoutAuditLogs')).add({
      payoutId,
      eventType: 'transfer_failed',
      transferId: transfer.id,
      failureMessage,
      failureCode,
      isRetryable,
      retryCount: currentRetryCount + 1,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[Webhook] Transfer failed processed for payout: ${payoutId}`);

  } catch (error) {
    console.error('[Webhook] Error handling transfer.failed:', error);
    throw error;
  }
}

/**
 * Handle transfer.reversed event - Handle reversed transfers
 */
async function handleTransferReversed(transfer: Stripe.Transfer): Promise<void> {
  try {
    console.log(`[Webhook] Transfer reversed: ${transfer.id}`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[Webhook] Firebase Admin not available');
      return;
    }

    const db = admin.firestore();
    const payoutId = transfer.metadata?.payoutId;
    const userId = transfer.metadata?.userId;

    if (!payoutId) {
      console.warn(`[Webhook] No payoutId in transfer metadata: ${transfer.id}`);
      return;
    }

    // Update payout status to failed due to reversal
    const payoutRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).doc(payoutId);
    await payoutRef.update({
      status: 'failed',
      failureReason: 'Transfer was reversed',
      reversedAt: admin.firestore.FieldValue.serverTimestamp(),
      stripeReversalId: transfer.reversal || null
    });

    // Log to audit trail
    await db.collection(getCollectionName('payoutAuditLogs')).add({
      payoutId,
      eventType: 'transfer_reversed',
      transferId: transfer.id,
      reversalId: transfer.reversal,
      amount: transfer.amount / 100,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Notify user
    if (userId) {
      await sendUserNotification(userId, {
        type: 'payout_reversed',
        title: 'Payout reversed',
        body: `Your payout was reversed. The funds have been returned to your available balance.`,
        metadata: { payoutId, transferId: transfer.id }
      });
    }

    console.log(`[Webhook] Transfer reversed processed for payout: ${payoutId}`);

  } catch (error) {
    console.error('[Webhook] Error handling transfer.reversed:', error);
    throw error;
  }
}

/**
 * Handle payout.paid event - Track when funds arrive in bank
 */
async function handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
  try {
    console.log(`[Webhook] Payout paid: ${payout.id}`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[Webhook] Firebase Admin not available');
      return;
    }

    const db = admin.firestore();

    // Log bank-level payout completion to audit trail
    await db.collection(getCollectionName('payoutAuditLogs')).add({
      eventType: 'payout_paid',
      stripePayoutId: payout.id,
      amount: payout.amount / 100,
      currency: payout.currency,
      arrivalDate: payout.arrival_date,
      destination: payout.destination,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      rawEvent: {
        id: payout.id,
        object: payout.object,
        status: payout.status,
        created: payout.created
      }
    });

    console.log(`[Webhook] Bank payout logged: ${payout.id}`);

  } catch (error) {
    console.error('[Webhook] Error handling payout.paid:', error);
    throw error;
  }
}

/**
 * Handle payout.failed event - Handle bank-level failures
 */
async function handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
  try {
    console.log(`[Webhook] Payout failed: ${payout.id}`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[Webhook] Firebase Admin not available');
      return;
    }

    const db = admin.firestore();

    // Log bank-level payout failure to audit trail
    await db.collection(getCollectionName('payoutAuditLogs')).add({
      eventType: 'payout_failed',
      stripePayoutId: payout.id,
      amount: payout.amount / 100,
      currency: payout.currency,
      failureMessage: payout.failure_message || 'Unknown bank failure',
      failureCode: payout.failure_code || 'unknown',
      destination: payout.destination,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[Webhook] Bank payout failure logged: ${payout.id}`);

  } catch (error) {
    console.error('[Webhook] Error handling payout.failed:', error);
    throw error;
  }
}

/**
 * Handle account.updated event - Track Connect account status changes
 */
async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  try {
    console.log(`[Webhook] Account updated: ${account.id}`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[Webhook] Firebase Admin not available');
      return;
    }

    const db = admin.firestore();

    // Find user with this Stripe account
    const usersSnapshot = await db
      .collection(getCollectionName('users'))
      .where('stripeConnectedAccountId', '==', account.id)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.warn(`[Webhook] No user found for Stripe account: ${account.id}`);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;

    // Update user's account status
    await userDoc.ref.update({
      stripeAccountStatus: {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirementsCurrentlyDue: account.requirements?.currently_due || [],
        requirementsEventuallyDue: account.requirements?.eventually_due || [],
        requirementsPastDue: account.requirements?.past_due || [],
        disabledReason: account.requirements?.disabled_reason || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });

    // Log account status change to audit trail
    await db.collection(getCollectionName('payoutAuditLogs')).add({
      userId,
      eventType: 'account_updated',
      stripeAccountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirementsCurrentlyDue: account.requirements?.currently_due || [],
      disabledReason: account.requirements?.disabled_reason || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Notify user if payouts were disabled
    if (!account.payouts_enabled && account.requirements?.disabled_reason) {
      await sendUserNotification(userId, {
        type: 'payout_account_disabled',
        title: 'Bank account verification needed',
        body: `Your bank account requires attention. Please complete the verification process to continue receiving payouts.`,
        metadata: {
          stripeAccountId: account.id,
          disabledReason: account.requirements.disabled_reason
        }
      });
    }

    console.log(`[Webhook] Account updated processed for user: ${userId}`);

  } catch (error) {
    console.error('[Webhook] Error handling account.updated:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  let event: Stripe.Event | undefined;

  try {
    // Apply webhook rate limiting (by source IP or Stripe)
    const sourceIdentifier = request.headers.get('x-forwarded-for') || 'stripe';
    const rateLimitResult = await webhookRateLimiter.checkLimit(sourceIdentifier);

    if (!rateLimitResult.allowed) {
      console.warn('Webhook rate limit exceeded:', sourceIdentifier);
      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: 'Too many webhook requests'
      }, { status: 429 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !endpointSecret) {
      console.error('Missing Stripe signature or webhook secret');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }


    // Check idempotency - prevent duplicate processing
    const isProcessed = await webhookIdempotencyService.isEventProcessed(event.id);
    if (isProcessed) {
      console.log(`[Webhook] Duplicate event detected: ${event.id} (${event.type})`);
      return NextResponse.json({
        received: true,
        duplicate: true,
        eventId: event.id,
        eventType: event.type
      });
    }

    // Mark event as processing atomically
    const marked = await webhookIdempotencyService.markEventProcessing(
      event.id,
      event.type,
      'stripe-payouts',
      {
        apiVersion: event.api_version,
        created: event.created
      }
    );

    if (!marked) {
      console.log(`[Webhook] Event ${event.id} is already being processed`);
      return NextResponse.json({
        received: true,
        duplicate: true,
        eventId: event.id
      });
    }

    // Handle the event
    try {
      await handleWebhookEvent(event);

      // Mark event as completed
      await webhookIdempotencyService.markEventCompleted(event.id, {
        processedEventType: event.type,
        processedAt: new Date().toISOString()
      });

      return NextResponse.json({
        received: true,
        eventType: event.type,
        eventId: event.id
      });

    } catch (error: any) {
      console.error('Error handling webhook event:', error);

      // Mark event as failed
      if (event?.id) {
        await webhookIdempotencyService.markEventFailed(
          event.id,
          error?.message || 'Unknown error'
        );
      }

      return NextResponse.json({
        error: 'Webhook handler failed'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Webhook processing error:', error);

    // Mark event as failed if we have an event ID
    if (event?.id) {
      await webhookIdempotencyService.markEventFailed(
        event.id,
        error?.message || 'Unknown error'
      );
    }

    return NextResponse.json({
      error: 'Webhook processing failed'
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    service: 'stripe-payouts-webhook',
    timestamp: new Date().toISOString()
  });
}