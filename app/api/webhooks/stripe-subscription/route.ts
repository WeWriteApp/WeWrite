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
import { getStripeWebhookSecret } from '../../../utils/stripeConfig';
import { getSubCollectionPath, PAYMENT_COLLECTIONS, getCollectionNameAsync, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { getStripe } from '../../../lib/stripe';
import { UsdService } from '../../../services/usdService';
import { dollarsToCents, formatUsdCents, centsToDollars } from '../../../utils/formatCurrency';
import { TransactionTrackingService } from '../../../services/transactionTrackingService';
import { PaymentRecoveryService } from '../../../services/paymentRecoveryService';
import { sendSubscriptionConfirmation } from '../../../services/emailService';
import { getOrCreateEmailSettingsToken } from '../../../services/emailSettingsTokenService';
import { webhookIdempotencyService } from '../../../services/webhookIdempotencyService';

// Removed SubscriptionSynchronizationService - using simplified approach
import { FinancialUtils, CorrelationId } from '../../../types/financial';
import { parseStripeError, createDetailedErrorLog } from '../../../utils/stripeErrorMessages';

const stripe = getStripe();

export async function POST(request: NextRequest) {
  let event: Stripe.Event | undefined;

  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    try {
      const webhookSecret = getStripeWebhookSecret();
      if (!webhookSecret) {
        console.error('[Webhook] STRIPE_WEBHOOK_SECRET is not configured');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
      }
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
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
      'stripe-subscription',
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

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event.type, event.data.previous_attributes);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event.type, event.data.previous_attributes);
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

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case 'charge.dispute.closed':
        await handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;

      default:
        // Silently ignore unhandled event types
        break;
    }

    // Mark event as completed
    await webhookIdempotencyService.markEventCompleted(event.id, {
      processedEventType: event.type,
      processedAt: new Date().toISOString()
    });

    return NextResponse.json({
      received: true,
      eventType: event.type,
      eventId: event.id,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    // Mark event as failed if we have an event ID
    if (event?.id) {
      await webhookIdempotencyService.markEventFailed(
        event.id,
        error?.message || 'Unknown error'
      );
    }

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
      return;
    }

    // Retrieve the subscription to get the latest status
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

    // Update subscription with the latest data from Stripe
    await handleSubscriptionUpdated(subscription, 'checkout.session.completed');

  } catch (error) {
    throw error;
  }
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  eventType: string = 'customer.subscription.updated',
  previousAttributes?: Record<string, any> | null
) {
  try {
    const userId = subscription.metadata.firebaseUID;
    if (!userId) {
      return;
    }

    const price = subscription.items.data[0].price;
    const amount = price.unit_amount ? price.unit_amount / 100 : 0;

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
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: serverTimestamp()};

    // CRITICAL FIX: Always use Stripe's status as the source of truth
    // Removed problematic race condition protection that was preventing legitimate 'incomplete' statuses
    const currentStatus = existingData?.status;
    const newStatus = subscription.status;

    subscriptionData.status = newStatus; // Always use Stripe's status

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

    // Do NOT allocate funds on subscription status change alone; wait for payment success
    // Token compatibility is handled on payment success; skipped here intentionally

  } catch (error) {
    throw error; // Re-throw to ensure webhook returns error status
  }
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata.firebaseUID;
    if (!userId) {
      return;
    }

    // Get existing subscription data for audit logging
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);
    const subscriptionRef = doc(db, parentPath, subCollectionName, 'current');
    const existingDoc = await getDoc(subscriptionRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : null;

    // Update subscription status in Firestore
    await updateDoc(subscriptionRef, {
      status: 'cancelled',
      canceledAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    // Log subscription cancellation to audit trail
    try {
      const { subscriptionAuditService } = await import('../../../services/subscriptionAuditService');

      await subscriptionAuditService.logSubscriptionCancelled(userId, existingData || {}, {
        source: 'stripe',
        correlationId: `webhook_deletion_${subscription.id}_${Date.now()}`,
        metadata: {
          webhookEventType: 'customer.subscription.deleted',
          stripeSubscriptionId: subscription.id,
          cancelReason: 'Subscription deleted in Stripe'
        }
      });
    } catch (auditError) {
      // Don't fail the webhook if audit logging fails
    }

    // Reset USD allocation to 0
    await UsdService.updateMonthlyUsdAllocation(userId, 0);

  } catch (error) {
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
      return;
    }

    // Simplified approach - directly update subscription without complex synchronization
    const correlationId = `payment_${invoice.id}_${Date.now()}`;

    // Get current subscription to check for previous failures
    let previousFailureCount = 0;
    try {
      const { parentPath, subCollectionName } = getSubCollectionPath(
        PAYMENT_COLLECTIONS.USERS,
        userId,
        PAYMENT_COLLECTIONS.SUBSCRIPTIONS
      );
      const subscriptionRef = doc(db, parentPath, subCollectionName, 'current');
      const currentSub = await getDoc(subscriptionRef);
      if (currentSub.exists()) {
        previousFailureCount = currentSub.data().failureCount || 0;
      }
    } catch (error) {
      // Could not get previous failure count - continue with default 0
    }

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

    // CRITICAL: Log subscription changes to audit trail for proper history
    try {
      const { subscriptionAuditService } = await import('../../../services/subscriptionAuditService');

      const previousAmount = (() => {
        const prevItems = (previousAttributes as any)?.items?.data || [];
        const prevPrice = prevItems[0]?.price;
        if (typeof prevPrice?.unit_amount === 'number') {
          return prevPrice.unit_amount / 100;
        }
        return null;
      })();

      const previousStatus = (previousAttributes as any)?.status;
      const hasExistingDoc = !!existingData && Object.keys(existingData).length > 0;
      const isCreationEvent = eventType === 'customer.subscription.created' || eventType === 'checkout.session.completed';

      if (hasExistingDoc || !isCreationEvent) {
        // Treat as update (upgrade/downgrade/status change)
        const beforeState = {
          amount: existingData?.amount ?? previousAmount ?? amount,
          status: existingData?.status ?? previousStatus ?? currentStatus ?? 'unknown',
          tier: existingData?.tier ?? tier
        };

        await subscriptionAuditService.logSubscriptionUpdated(userId, beforeState, { ...subscriptionData, tier }, {
          source: 'stripe',
          correlationId: `webhook_${subscription.id}_${Date.now()}`,
          metadata: {
            webhookEventType: eventType,
            stripeSubscriptionId: subscription.id,
            statusTransition: `${currentStatus} -> ${newStatus}`,
            amountChange: beforeState.amount !== amount
          }
        });
      } else {
        // This is a creation - log as created
        await subscriptionAuditService.logSubscriptionCreated(userId, subscriptionData, {
          source: 'stripe',
          correlationId: `webhook_${subscription.id}_${Date.now()}`,
          metadata: {
            webhookEventType: eventType,
            stripeSubscriptionId: subscription.id,
            initialStatus: newStatus
          }
        });
      }
    } catch (auditError) {
      // Don't fail the webhook if audit logging fails
    }

    // CRITICAL: Invalidate subscription cache after webhook update
    try {
      // Import and use the cache invalidation function
      const { invalidateCache } = await import('../../../utils/serverCache');
      invalidateCache.user(userId);
    } catch (cacheError) {
      // Cache invalidation failed - non-fatal
    }
    } catch (error) {
      throw error;
    }

    // Log payment recovery to audit trail if there were previous failures
    if (previousFailureCount > 0) {
      try {
        const { subscriptionAuditService } = await import('../../../services/subscriptionAuditService');
        const amount = invoice.amount_paid / 100; // Convert from cents

        await subscriptionAuditService.logPaymentRecovered(userId, {
          amount,
          currency: invoice.currency.toUpperCase(),
          invoiceId: invoice.id,
          subscriptionId: subscription.id,
          previousFailureCount
        }, {
          source: 'stripe',
          correlationId,
          metadata: {
            stripeInvoiceId: invoice.id,
            stripeSubscriptionId: subscription.id,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            paymentMethodId: invoice.default_payment_method,
            recoveredAfterFailures: previousFailureCount
          }
        });
      } catch (auditError) {
        // Don't fail the webhook if audit logging fails
      }
    }

    // Ensure USD allocation is up to date (primary system) - funds stay in platform account
    const price = subscription.items.data[0].price;
    const amount = price.unit_amount ? price.unit_amount / 100 : 0;

    await UsdService.updateMonthlyUsdAllocation(userId, amount);

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
        } else {
          throw new Error(trackingResult.error?.message || 'Transaction tracking failed');
        }
      } catch (trackingError: any) {
        if (trackingAttempts >= maxTrackingAttempts) {
          // Critical: Transaction tracking failed after all retries
          // Create a fallback tracking record for manual reconciliation
          try {
            await createFallbackTransactionRecord(invoice.id, subscription.id, userId, amount, correlationId, trackingError.message);
          } catch (fallbackError) {
            // Failed to create fallback - will be logged in monitoring
          }

          // Log to monitoring system for immediate attention
          await logCriticalTrackingFailure(correlationId, invoice.id, userId, trackingError.message);
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, trackingAttempts) * 1000));
        }
      }
    }

    // Send subscription confirmation email (fire-and-forget)
    try {
      // Get user data for email
      const userRef = doc(db, getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS).parentPath.replace('/subscriptions', ''));
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.exists() ? userDoc.data() : null;
      
      if (userData?.email) {
        const price = subscription.items.data[0].price;
        const amount = price.unit_amount ? price.unit_amount / 100 : 0;
        const nextBillingDate = new Date(subscription.current_period_end * 1000);

        // Get or create email settings token for no-login unsubscribe
        const emailSettingsToken = await getOrCreateEmailSettingsToken(userId);

        sendSubscriptionConfirmation({
          to: userData.email,
          username: userData.username || 'there',
          planName: `$${amount}/month`,
          amount: `$${amount.toFixed(2)}/month`,
          nextBillingDate: nextBillingDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          userId,
          emailSettingsToken
        }).catch(() => {
          // Email send failed - non-fatal
        });
      }
    } catch (emailErr) {
      // Don't fail the webhook if email fails
    }

  } catch (error) {
    throw error; // Re-throw to ensure webhook returns error status
  }
}

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.firebaseUID;

    if (!userId) {
      return;
    }

    // Use enhanced payment recovery service for intelligent retry scheduling
    const paymentRecoveryService = PaymentRecoveryService.getInstance();
    const correlationId = FinancialUtils.generateCorrelationId();

    // Extract detailed failure information from invoice
    const rawError = invoice.last_finalization_error ||
                     invoice.charge?.failure_message ||
                     invoice.charge?.outcome ||
                     { message: 'Payment failed - reason unknown' };

    // Parse the error for detailed user-friendly information
    const detailedError = parseStripeError(rawError);
    const failureReason = detailedError.userMessage;

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

    // Log payment failure to audit trail for maximum visibility
    try {
      const { subscriptionAuditService } = await import('../../../services/subscriptionAuditService');
      await subscriptionAuditService.logPaymentFailed(userId, {
        amount,
        currency: invoice.currency.toUpperCase(),
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
        failureReason,
        failureCount: failureRecord.failureCount,
        failureType: failureRecord.failureType
      }, {
        source: 'stripe',
        correlationId,
        metadata: {
          stripeInvoiceId: invoice.id,
          stripeSubscriptionId: subscription.id,
          nextRetryAt: failureRecord.nextRetryAt?.toISOString(),
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          paymentMethodId: invoice.default_payment_method,
          attemptCount: invoice.attempt_count
        }
      });
    } catch (auditError) {
      // Don't fail the webhook if audit logging fails
    }

    // Create enhanced notification with retry information
    await createFailedPaymentNotification(userId, failureRecord.failureCount, invoice, failureRecord);

    // Revoke allocations until a successful payment occurs
    try {
      await UsdService.updateMonthlyUsdAllocation(userId, 0);
    } catch (allocError) {
      // Failed to clear USD allocation - non-fatal
    }

  } catch (error) {
    // Payment failure handling error - non-fatal
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
    const { createNotification } = await import('../../../services/notificationsService');

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
  } catch (error) {
    // Notification creation failed - non-fatal
  }
}

/**
 * Handle charge refund events
 * Processes full and partial refunds by reducing USD allocations proportionally
 */
export async function handleChargeRefunded(charge: Stripe.Charge) {
  try {
    const correlationId = `refund_${charge.id}_${Date.now()}`;

    // Get the invoice associated with this charge
    if (!charge.invoice) {
      console.warn(`[REFUND] Charge ${charge.id} has no associated invoice - skipping`);
      return;
    }

    const invoice = await stripe.invoices.retrieve(charge.invoice as string);
    if (!invoice.subscription) {
      console.warn(`[REFUND] Invoice ${invoice.id} has no associated subscription - skipping`);
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.firebaseUID;

    if (!userId) {
      console.warn(`[REFUND] Subscription ${subscription.id} has no firebaseUID metadata`);
      return;
    }

    // Calculate refund details
    const originalAmount = charge.amount / 100; // Convert from cents
    const refundedAmount = charge.amount_refunded / 100; // Convert from cents
    const refundPercentage = refundedAmount / originalAmount;
    const isFullRefund = refundPercentage >= 0.99; // Allow for rounding

    // Get current USD allocation
    const currentBalance = await UsdService.getUserUsdBalance(userId);
    if (!currentBalance) {
      console.warn(`[REFUND] No USD balance found for user ${userId}`);
      return;
    }

    // Calculate the amount to reduce from allocations
    const currentAllocatedCents = currentBalance.allocatedUsdCents;
    const refundReductionCents = Math.round(currentAllocatedCents * refundPercentage);

    // Get all active allocations for this month
    const allocations = await UsdService.getUserUsdAllocations(userId);

    // Mark allocations as refunded/at_risk and reduce amounts proportionally
    const allocationsCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS);

    const batch = db.batch();
    let totalReduced = 0;

    for (const allocation of allocations) {
      const allocationRef = doc(db, allocationsCollectionName, allocation.id);
      const reductionCents = Math.round(allocation.usdCents * refundPercentage);
      const newAmount = Math.max(0, allocation.usdCents - reductionCents);

      batch.update(allocationRef, {
        usdCents: newAmount,
        status: isFullRefund ? 'refunded' : 'at_risk',
        refundedAt: new Date().toISOString(),
        refundAmount: reductionCents,
        refundPercentage,
        originalAmount: allocation.usdCents,
        chargeId: charge.id,
        updatedAt: serverTimestamp()
      });

      totalReduced += reductionCents;
    }

    // Update the USD balance to reflect the refund
    if (isFullRefund) {
      await UsdService.updateMonthlyUsdAllocation(userId, 0);
    } else {
      const newMonthlyAllocation = Math.max(0, (currentBalance.monthlyAllocationCents - dollarsToCents(refundedAmount)) / 100);
      await UsdService.updateMonthlyUsdAllocation(userId, newMonthlyAllocation);
    }

    await batch.commit();

    // Log refund to audit trail
    try {
      const { subscriptionAuditService } = await import('../../../services/subscriptionAuditService');
      await subscriptionAuditService.logEvent({
        userId,
        eventType: 'payment_failed' as any, // Using closest match
        description: `Charge refunded: ${isFullRefund ? 'Full' : 'Partial'} refund of $${refundedAmount.toFixed(2)}`,
        entityType: 'subscription',
        entityId: subscription.id,
        beforeState: {
          allocatedCents: currentAllocatedCents,
          monthlyAllocationCents: currentBalance.monthlyAllocationCents
        },
        afterState: {
          allocatedCents: currentAllocatedCents - totalReduced,
          refundedAmount,
          refundPercentage
        },
        metadata: {
          chargeId: charge.id,
          invoiceId: invoice.id,
          subscriptionId: subscription.id,
          isFullRefund,
          refundedAmount,
          refundPercentage,
          allocationsAffected: allocations.length
        },
        source: 'stripe',
        correlationId,
        severity: isFullRefund ? 'warning' : 'info'
      });
    } catch (auditError) {
      console.error('[REFUND] Failed to log audit event:', auditError);
    }

    // Create critical notification for admin
    await createCriticalAlert({
      type: 'charge_refunded',
      title: `${isFullRefund ? 'Full' : 'Partial'} Charge Refund`,
      message: `User ${userId} received a ${isFullRefund ? 'full' : 'partial'} refund of $${refundedAmount.toFixed(2)}. ${allocations.length} allocations affected.`,
      userId: 'admin',
      metadata: {
        affectedUserId: userId,
        chargeId: charge.id,
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
        refundedAmount,
        refundPercentage,
        allocationsAffected: allocations.length,
        totalReduced: centsToDollars(totalReduced)
      }
    });

    // Notify the affected user
    const { createNotification } = await import('../../../services/notificationsService');
    await createNotification({
      userId,
      type: 'refund_processed',
      title: 'Refund Processed',
      message: `A ${isFullRefund ? 'full' : 'partial'} refund of $${refundedAmount.toFixed(2)} has been processed for your subscription. Your allocations have been adjusted accordingly.`,
      metadata: {
        chargeId: charge.id,
        refundedAmount,
        isFullRefund
      }
    });

  } catch (error) {
    console.error('[REFUND] Error handling charge refund:', error);
    // Don't throw - we don't want to fail the webhook
  }
}

/**
 * Handle dispute creation events
 * Freezes USD allocations and prevents payouts for disputed amounts
 */
export async function handleDisputeCreated(dispute: Stripe.Dispute) {
  try {
    const correlationId = `dispute_created_${dispute.id}_${Date.now()}`;
    const charge = await stripe.charges.retrieve(dispute.charge as string);

    // Get the invoice associated with this charge
    if (!charge.invoice) {
      console.warn(`[DISPUTE] Charge ${charge.id} has no associated invoice - skipping`);
      return;
    }

    const invoice = await stripe.invoices.retrieve(charge.invoice as string);
    if (!invoice.subscription) {
      console.warn(`[DISPUTE] Invoice ${invoice.id} has no associated subscription - skipping`);
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.firebaseUID;

    if (!userId) {
      console.warn(`[DISPUTE] Subscription ${subscription.id} has no firebaseUID metadata`);
      return;
    }

    const disputedAmount = dispute.amount / 100; // Convert from cents

    // Get all active allocations
    const allocations = await UsdService.getUserUsdAllocations(userId);

    // Freeze all allocations by marking them as disputed
    const allocationsCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS);
    const batch = db.batch();

    for (const allocation of allocations) {
      const allocationRef = doc(db, allocationsCollectionName, allocation.id);
      batch.update(allocationRef, {
        status: 'disputed',
        disputedAt: new Date().toISOString(),
        disputeId: dispute.id,
        chargeId: charge.id,
        frozenAmount: allocation.usdCents,
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();

    // Log dispute to audit trail
    try {
      const { subscriptionAuditService } = await import('../../../services/subscriptionAuditService');
      await subscriptionAuditService.logEvent({
        userId,
        eventType: 'payment_failed' as any,
        description: `Payment dispute created for $${disputedAmount.toFixed(2)} - Allocations frozen`,
        entityType: 'subscription',
        entityId: subscription.id,
        beforeState: {
          allocations: allocations.map(a => ({ id: a.id, status: a.status, usdCents: a.usdCents }))
        },
        afterState: {
          disputeStatus: 'frozen',
          allocationsAffected: allocations.length
        },
        metadata: {
          disputeId: dispute.id,
          chargeId: charge.id,
          invoiceId: invoice.id,
          subscriptionId: subscription.id,
          disputedAmount,
          disputeReason: dispute.reason,
          allocationsAffected: allocations.length
        },
        source: 'stripe',
        correlationId,
        severity: 'critical'
      });
    } catch (auditError) {
      console.error('[DISPUTE] Failed to log audit event:', auditError);
    }

    // Create critical alert for admin
    await createCriticalAlert({
      type: 'dispute_created',
      title: 'Payment Dispute Created',
      message: `CRITICAL: Payment dispute filed for user ${userId}. Amount: $${disputedAmount.toFixed(2)}. Reason: ${dispute.reason}. All allocations frozen.`,
      userId: 'admin',
      metadata: {
        affectedUserId: userId,
        disputeId: dispute.id,
        chargeId: charge.id,
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
        disputedAmount,
        disputeReason: dispute.reason,
        allocationsAffected: allocations.length,
        urgency: 'critical'
      }
    });

    // Notify the affected user
    const { createNotification } = await import('../../../services/notificationsService');
    await createNotification({
      userId,
      type: 'dispute_created',
      title: 'Payment Dispute Filed',
      message: `A payment dispute has been filed for your subscription payment of $${disputedAmount.toFixed(2)}. Your allocations have been temporarily frozen pending resolution.`,
      metadata: {
        disputeId: dispute.id,
        disputedAmount,
        disputeReason: dispute.reason
      }
    });

  } catch (error) {
    console.error('[DISPUTE] Error handling dispute creation:', error);
    // Don't throw - we don't want to fail the webhook
  }
}

/**
 * Handle dispute closure events
 * Unfreezes allocations if won, or finalizes refund if lost
 */
export async function handleDisputeClosed(dispute: Stripe.Dispute) {
  try {
    const correlationId = `dispute_closed_${dispute.id}_${Date.now()}`;
    const charge = await stripe.charges.retrieve(dispute.charge as string);

    // Get the invoice associated with this charge
    if (!charge.invoice) {
      console.warn(`[DISPUTE] Charge ${charge.id} has no associated invoice - skipping`);
      return;
    }

    const invoice = await stripe.invoices.retrieve(charge.invoice as string);
    if (!invoice.subscription) {
      console.warn(`[DISPUTE] Invoice ${invoice.id} has no associated subscription - skipping`);
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.firebaseUID;

    if (!userId) {
      console.warn(`[DISPUTE] Subscription ${subscription.id} has no firebaseUID metadata`);
      return;
    }

    const disputedAmount = dispute.amount / 100; // Convert from cents
    const won = dispute.status === 'won';

    // Get all disputed allocations - use Firebase Admin SDK for queries
    const { getFirebaseAdmin } = await import('../../../firebase/firebaseAdmin');
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not available');
    }
    const adminDb = admin.firestore();

    const allocationsCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS);
    const allocationsRef = adminDb.collection(allocationsCollectionName);
    const allocationsQuery = allocationsRef
      .where('userId', '==', userId)
      .where('disputeId', '==', dispute.id)
      .where('status', '==', 'disputed');

    const snapshot = await allocationsQuery.get();
    const batch = adminDb.batch();

    if (won) {
      // Dispute won - unfreeze allocations
      snapshot.forEach(doc => {
        batch.update(doc.ref, {
          status: 'active',
          disputeResolvedAt: new Date().toISOString(),
          disputeOutcome: 'won',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
    } else {
      // Dispute lost - mark allocations as refunded and reduce to 0
      snapshot.forEach(doc => {
        const data = doc.data();
        batch.update(doc.ref, {
          status: 'refunded',
          usdCents: 0,
          disputeResolvedAt: new Date().toISOString(),
          disputeOutcome: 'lost',
          refundedAmount: data.frozenAmount || data.usdCents,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      // Update USD balance to 0 since we lost the dispute
      await UsdService.updateMonthlyUsdAllocation(userId, 0);
    }

    await batch.commit();

    // Log dispute resolution to audit trail
    try {
      const { subscriptionAuditService } = await import('../../../services/subscriptionAuditService');
      await subscriptionAuditService.logEvent({
        userId,
        eventType: won ? 'payment_recovered' : ('payment_failed' as any),
        description: `Payment dispute ${won ? 'won' : 'lost'} for $${disputedAmount.toFixed(2)} - Allocations ${won ? 'unfrozen' : 'refunded'}`,
        entityType: 'subscription',
        entityId: subscription.id,
        beforeState: {
          disputeStatus: 'frozen',
          allocationsAffected: snapshot.size
        },
        afterState: {
          disputeStatus: won ? 'resolved_won' : 'resolved_lost',
          allocationsAffected: snapshot.size
        },
        metadata: {
          disputeId: dispute.id,
          chargeId: charge.id,
          invoiceId: invoice.id,
          subscriptionId: subscription.id,
          disputedAmount,
          disputeOutcome: won ? 'won' : 'lost',
          allocationsAffected: snapshot.size
        },
        source: 'stripe',
        correlationId,
        severity: won ? 'info' : 'warning'
      });
    } catch (auditError) {
      console.error('[DISPUTE] Failed to log audit event:', auditError);
    }

    // Create alert for admin
    await createCriticalAlert({
      type: 'dispute_closed',
      title: `Payment Dispute ${won ? 'Won' : 'Lost'}`,
      message: `Dispute ${dispute.id} for user ${userId} was ${won ? 'won' : 'lost'}. Amount: $${disputedAmount.toFixed(2)}. Allocations ${won ? 'unfrozen' : 'refunded'}.`,
      userId: 'admin',
      metadata: {
        affectedUserId: userId,
        disputeId: dispute.id,
        chargeId: charge.id,
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
        disputedAmount,
        disputeOutcome: won ? 'won' : 'lost',
        allocationsAffected: snapshot.size
      }
    });

    // Notify the affected user
    const { createNotification } = await import('../../../services/notificationsService');
    await createNotification({
      userId,
      type: won ? 'dispute_won' : 'dispute_lost',
      title: `Payment Dispute ${won ? 'Resolved' : 'Lost'}`,
      message: won
        ? `The payment dispute for $${disputedAmount.toFixed(2)} has been resolved in your favor. Your allocations have been unfrozen.`
        : `The payment dispute for $${disputedAmount.toFixed(2)} was not resolved in your favor. Your allocations have been refunded and you may need to update your payment method.`,
      metadata: {
        disputeId: dispute.id,
        disputedAmount,
        disputeOutcome: won ? 'won' : 'lost'
      }
    });

  } catch (error) {
    console.error('[DISPUTE] Error handling dispute closure:', error);
    // Don't throw - we don't want to fail the webhook
  }
}

/**
 * Create a critical alert for admin monitoring
 */
async function createCriticalAlert(alert: {
  type: string;
  title: string;
  message: string;
  userId: string;
  metadata: Record<string, any>;
}): Promise<void> {
  try {
    const criticalAlert = {
      ...alert,
      severity: 'critical',
      timestamp: serverTimestamp(),
      requiresAttention: true,
      resolved: false
    };

    // Log to critical alerts collection for admin dashboard
    await addDoc(collection(db, 'criticalAlerts'), criticalAlert);
  } catch (error) {
    console.error('[CRITICAL ALERT] Failed to create critical alert:', error);
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
}
