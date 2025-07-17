/**
 * Stripe Subscription Webhook Handler
 * 
 * Handles subscription lifecycle events and updates token allocations
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { getStripeSecretKey, getStripeWebhookSecret } from '../../../utils/stripeConfig';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { ServerTokenService } from '../../../services/tokenService.server';
import { calculateTokensForAmount } from '../../../utils/subscriptionTiers';
import { TransactionTrackingService } from '../../../services/transactionTrackingService';
import { PaymentRecoveryService } from '../../../services/paymentRecoveryService';
// Removed SubscriptionSynchronizationService - using simplified approach
import { FinancialUtils, CorrelationId } from '../../../types/financial';

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-06-20'});

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('No Stripe signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        getStripeWebhookSecret() || ''
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        // Silently ignore unhandled event types
        break;
    }
    return NextResponse.json({
      received: true,
      eventType: event.type,
      eventId: event.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[SUBSCRIPTION WEBHOOK] Error processing webhook event ${event?.type || 'unknown'}:`, error);
    return NextResponse.json({
      error: 'Webhook processing failed',
      eventType: event?.type || 'unknown',
      eventId: event?.id || 'unknown',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    // Only handle subscription mode sessions
    if (session.mode !== 'subscription' || !session.subscription) {
      return;
    }

    const userId = session.metadata?.firebaseUID;
    if (!userId) {
      console.error('No Firebase UID in checkout session metadata:', session.id);
      return;
    }

    console.log(`[SUBSCRIPTION WEBHOOK] Checkout session completed for user ${userId}, session ${session.id}`);

    // Retrieve the subscription to get the latest status
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

    // Update subscription with the latest data from Stripe
    await handleSubscriptionUpdated(subscription);

    console.log(`[SUBSCRIPTION WEBHOOK] Processed checkout completion for user ${userId}, subscription status: ${subscription.status}`);

  } catch (error) {
    console.error('[SUBSCRIPTION WEBHOOK] Error handling checkout session completed:', error);
    throw error;
  }
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata.firebaseUID;
    if (!userId) {
      console.error('No Firebase UID in subscription metadata:', subscription.id);
      return;
    }

    console.log(`[SUBSCRIPTION WEBHOOK] Processing subscription update for user ${userId}, subscription ${subscription.id}, status: ${subscription.status}`);

    const price = subscription.items.data[0].price;
    const amount = price.unit_amount ? price.unit_amount / 100 : 0;
    const tokens = calculateTokensForAmount(amount);

    // Determine tier from metadata or amount
    let tier = subscription.metadata.tier || 'custom';
    if (!tier || tier === 'undefined') {
      // Fallback to determining tier by amount
      if (amount === 10) tier = 'tier1';
      else if (amount === 20) tier = 'tier2';
      else if (amount === 50) tier = 'tier3';
      else tier = 'custom';
    }

    // Update subscription in Firestore
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);
    const subscriptionRef = doc(db, parentPath, subCollectionName, 'current');

    // Check if subscription document exists
    const subscriptionDoc = await getDoc(subscriptionRef);
    const existingData = subscriptionDoc.exists() ? subscriptionDoc.data() : {};

    // Prepare subscription data update
    const subscriptionData = {
      stripeSubscriptionId: subscription.id, // This is the key field for sync
      stripePriceId: price.id,
      status: subscription.status,
      tier,
      amount,
      tokens,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: serverTimestamp()};

    // Handle status transitions properly:
    // 1. Always update from 'incomplete' to any Stripe status
    // 2. Don't overwrite 'active' with 'incomplete' (race condition protection)
    // 3. Allow other valid status transitions
    const currentStatus = existingData?.status;
    const newStatus = subscription.status;

    if (currentStatus === 'active' && newStatus === 'incomplete') {
      console.log(`[SUBSCRIPTION WEBHOOK] Preventing status downgrade from 'active' to 'incomplete' for user ${userId}`);
      subscriptionData.status = 'active';
    } else {
      console.log(`[SUBSCRIPTION WEBHOOK] Status transition for user ${userId}: '${currentStatus}' -> '${newStatus}'`);
      subscriptionData.status = newStatus;
    }

    if (subscriptionDoc.exists()) {
      await updateDoc(subscriptionRef, subscriptionData);
    } else {
      // Create the subscription document if it doesn't exist
      await setDoc(subscriptionRef, {
        id: 'current',
        userId,
        ...subscriptionData,
        createdAt: serverTimestamp()});
    }

    // Update user's token allocation
    if (subscription.status === 'active') {
      await ServerTokenService.updateMonthlyTokenAllocation(userId, amount);

      // Convert unfunded tokens to funded tokens
      try {
        console.log(`[SUBSCRIPTION WEBHOOK] Converting unfunded tokens for user ${userId}`);
        const convertResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tokens/convert-unfunded`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId
          })
        });

        if (convertResponse.ok) {
          const convertResult = await convertResponse.json();
          console.log(`[SUBSCRIPTION WEBHOOK] Successfully converted ${convertResult.convertedCount} unfunded token allocations for user ${userId}`);
        } else {
          console.warn(`[SUBSCRIPTION WEBHOOK] Failed to convert unfunded tokens for user ${userId}: ${convertResponse.status}`);
        }
      } catch (convertError) {
        console.warn(`[SUBSCRIPTION WEBHOOK] Error converting unfunded tokens for user ${userId}:`, convertError);
        // Don't fail webhook processing if token conversion fails
      }
    }

    console.log(`[SUBSCRIPTION WEBHOOK] Successfully updated subscription for user ${userId}, final status: ${subscriptionData.status}`);

  } catch (error) {
    console.error('Error handling subscription updated:', error);
    throw error; // Re-throw to ensure webhook returns error status
  }
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata.firebaseUID;
    if (!userId) {
      console.error('[SUBSCRIPTION WEBHOOK] No Firebase UID in subscription metadata for deletion');
      return;
    }

    console.log(`[SUBSCRIPTION WEBHOOK] Processing subscription deletion for user ${userId}, subscription ${subscription.id}`);

    // Update subscription status in Firestore
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);
    const subscriptionRef = doc(db, parentPath, subCollectionName, 'current');
    await updateDoc(subscriptionRef, {
      status: 'cancelled',
      canceledAt: new Date().toISOString(),
      updatedAt: serverTimestamp()});

    // Reset token allocation to 0
    await ServerTokenService.updateMonthlyTokenAllocation(userId, 0);

    console.log(`[SUBSCRIPTION WEBHOOK] Subscription deleted for user ${userId} - Status set to cancelled`);

  } catch (error) {
    console.error('[SUBSCRIPTION WEBHOOK] Error handling subscription deleted:', error);
    throw error;
  }
}

export async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) {
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.firebaseUID;

    if (!userId) {
      console.error('No Firebase UID in subscription metadata for payment succeeded');
      return;
    }

    // Simplified approach - directly update subscription without complex synchronization
    const correlationId = `payment_${invoice.id}_${Date.now()}`;

    const subscriptionData = {
      stripeSubscriptionId: subscription.id,
      status: 'active', // Always set to active on successful payment
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      lastPaymentAt: new Date(invoice.created * 1000),
      failureCount: 0, // Reset failure count on successful payment
      lastFailedPaymentAt: null, // Clear failed payment timestamp
        lastFailedInvoiceId: null, // Clear failed invoice ID
        updatedAt: serverTimestamp()
    };

    // Simplified direct update to Firestore
    try {
      const { parentPath, subCollectionName } = getSubCollectionPath(
        PAYMENT_COLLECTIONS.USERS,
        userId,
        PAYMENT_COLLECTIONS.SUBSCRIPTIONS
      );

      const subscriptionRef = doc(db, parentPath, subCollectionName, 'current');
      await updateDoc(subscriptionRef, subscriptionData);

      console.log(`[SUBSCRIPTION WEBHOOK] Successfully updated subscription for user ${userId}`);
    } catch (error) {
      console.error(`[SUBSCRIPTION WEBHOOK] Failed to update subscription for user ${userId}:`, error);
      throw error;
    }

    // Ensure token allocation is up to date
    const price = subscription.items.data[0].price;
    const amount = price.unit_amount ? price.unit_amount / 100 : 0;
    await ServerTokenService.updateMonthlyTokenAllocation(userId, amount);

    // Track the subscription payment transaction - MANDATORY for audit compliance
    // Reuse the correlationId from the sync operation above
    let trackingAttempts = 0;
    const maxTrackingAttempts = 3;
    let trackingSuccess = false;

    while (trackingAttempts < maxTrackingAttempts && !trackingSuccess) {
      try {
        trackingAttempts++;
        const trackingResult = await TransactionTrackingService.trackSubscriptionPayment(
          invoice.id,
          subscription.id,
          userId,
          amount,
          correlationId
        );

        if (trackingResult.success) {
          trackingSuccess = true;
          console.log(`[SUBSCRIPTION WEBHOOK] Successfully tracked payment transaction [${correlationId}] on attempt ${trackingAttempts}`, {
            invoiceId: invoice.id,
            subscriptionId: subscription.id,
            userId,
            amount,
            transactionId: trackingResult.data?.id
          });
        } else {
          throw new Error(trackingResult.error?.message || 'Transaction tracking failed');
        }
      } catch (trackingError: any) {
        console.error(`[SUBSCRIPTION WEBHOOK] Transaction tracking attempt ${trackingAttempts} failed:`, {
          error: trackingError.message,
          correlationId,
          invoiceId: invoice.id,
          userId
        });

        if (trackingAttempts >= maxTrackingAttempts) {
          // Critical: Transaction tracking failed after all retries
          // Create a fallback tracking record for manual reconciliation
          try {
            await createFallbackTransactionRecord(invoice.id, subscription.id, userId, amount, correlationId, trackingError.message);
            console.error(`[SUBSCRIPTION WEBHOOK] CRITICAL: Created fallback transaction record for manual reconciliation [${correlationId}]`);
          } catch (fallbackError) {
            console.error(`[SUBSCRIPTION WEBHOOK] CRITICAL: Failed to create fallback transaction record [${correlationId}]:`, fallbackError);
          }

          // Log to monitoring system for immediate attention
          await logCriticalTrackingFailure(correlationId, invoice.id, userId, trackingError.message);
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, trackingAttempts) * 1000));
        }
      }
    }

  } catch (error) {
    console.error('Error handling payment succeeded:', error);
    throw error; // Re-throw to ensure webhook returns error status
  }
}

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.firebaseUID;

    if (!userId) {
      console.error('No Firebase UID in subscription metadata');
      return;
    }

    // Use enhanced payment recovery service for intelligent retry scheduling
    const paymentRecoveryService = PaymentRecoveryService.getInstance();
    const correlationId = FinancialUtils.generateCorrelationId();

    // Extract failure reason from invoice
    const failureReason = invoice.last_finalization_error?.message ||
                         invoice.charge?.failure_message ||
                         'Payment failed - reason unknown';

    const amount = invoice.amount_due / 100; // Convert from cents

    // Record failure and schedule intelligent retries
    const failureRecord = await paymentRecoveryService.recordPaymentFailure(
      userId,
      subscription.id,
      invoice.id,
      failureReason,
      amount,
      invoice.currency.toUpperCase(),
      correlationId
    );

    // Create enhanced notification with retry information
    await createFailedPaymentNotification(userId, failureRecord.failureCount, invoice, failureRecord);

    console.log(`[ENHANCED PAYMENT RECOVERY] Payment failed for user ${userId}`, {
      failureCount: failureRecord.failureCount,
      failureType: failureRecord.failureType,
      nextRetryAt: failureRecord.nextRetryAt?.toISOString(),
      correlationId
    });

  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function createFailedPaymentNotification(
  userId: string,
  failureCount: number,
  invoice: Stripe.Invoice,
  failureRecord?: any
) {
  try {
    // Import notification function from API service
    const { createNotification } = await import('../../../services/notificationsApi');

    const amount = invoice.amount_due / 100; // Convert from cents

    let notificationType = 'payment_failed';
    let title = 'Payment Failed';
    let message = `Your subscription payment of $${amount.toFixed(2)} failed. Please update your payment method.`;

    // Escalate messaging based on failure count
    if (failureCount >= 3) {
      notificationType = 'payment_failed_final';
      title = 'Final Payment Attempt Failed';
      message = `Your subscription payment has failed ${failureCount} times. Your account may be suspended soon. Please update your payment method immediately.`;
    } else if (failureCount >= 2) {
      notificationType = 'payment_failed_warning';
      title = 'Payment Failed - Action Required';
      message = `Your subscription payment has failed ${failureCount} times. Please update your payment method to avoid service interruption.`;
    }

    await createNotification({
      userId,
      type: notificationType,
      title,
      message,
      metadata: {
        invoiceId: invoice.id,
        amount: amount,
        failureCount: failureCount,
        dueDate: new Date(invoice.due_date * 1000).toISOString()
      }
    });

    console.log(`Created ${notificationType} notification for user ${userId}`);
  } catch (error) {
    console.error('Error creating failed payment notification:', error);
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'stripe-subscription-webhook',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    webhookSecret: getStripeWebhookSecret() ? 'configured' : 'missing'
  });
}

/**
 * Create a fallback transaction record for manual reconciliation
 * when primary transaction tracking fails
 */
async function createFallbackTransactionRecord(
  invoiceId: string,
  subscriptionId: string,
  userId: string,
  amount: number,
  correlationId: CorrelationId,
  errorMessage: string
): Promise<void> {
  const fallbackRecord = {
    type: 'FALLBACK_TRANSACTION_RECORD',
    originalType: 'SUBSCRIPTION_PAYMENT',
    status: 'REQUIRES_MANUAL_RECONCILIATION',
    invoiceId,
    subscriptionId,
    userId,
    amount,
    currency: 'usd',
    correlationId,
    trackingFailureReason: errorMessage,
    createdAt: serverTimestamp(),
    requiresAttention: true,
    reconciled: false,
    metadata: {
      source: 'webhook_tracking_failure',
      severity: 'critical',
      requiresManualReview: true
    }
  };

  await addDoc(collection(db, 'fallbackTransactionRecords'), fallbackRecord);
}

/**
 * Log critical tracking failures to monitoring system
 */
async function logCriticalTrackingFailure(
  correlationId: CorrelationId,
  invoiceId: string,
  userId: string,
  errorMessage: string
): Promise<void> {
  const criticalAlert = {
    type: 'CRITICAL_TRACKING_FAILURE',
    severity: 'critical',
    correlationId,
    invoiceId,
    userId,
    errorMessage,
    timestamp: serverTimestamp(),
    requiresImmediateAttention: true,
    impact: 'audit_trail_gap',
    resolution: 'manual_reconciliation_required',
    metadata: {
      source: 'stripe_webhook',
      component: 'transaction_tracking',
      alertLevel: 'critical'
    }
  };

  // Log to critical alerts collection for monitoring dashboard
  await addDoc(collection(db, 'criticalAlerts'), criticalAlert);

  // Also log to console for immediate visibility
  console.error('🚨 CRITICAL TRACKING FAILURE LOGGED:', {
    correlationId,
    invoiceId,
    userId,
    errorMessage,
    timestamp: new Date().toISOString()
  });
}