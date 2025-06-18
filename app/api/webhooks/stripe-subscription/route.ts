/**
 * Stripe Subscription Webhook Handler
 * 
 * Handles subscription lifecycle events and updates token allocations
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { getStripeSecretKey, getStripeWebhookSecret } from '../../../utils/stripeConfig';
import { TokenService } from '../../../services/tokenService';
import { calculateTokensForAmount } from '../../../utils/subscriptionTiers';

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-06-20',
});

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

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
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

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
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
    const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');

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
      updatedAt: serverTimestamp(),
    };

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
        createdAt: serverTimestamp(),
      });
    }

    // Update user's token allocation
    if (subscription.status === 'active') {
      await TokenService.updateMonthlyTokenAllocation(userId, amount);
    }

    console.log(`[SUBSCRIPTION WEBHOOK] Successfully updated subscription for user ${userId}, final status: ${subscriptionData.status}`);

  } catch (error) {
    console.error('Error handling subscription updated:', error);
    throw error; // Re-throw to ensure webhook returns error status
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata.firebaseUID;
    if (!userId) {
      console.error('[SUBSCRIPTION WEBHOOK] No Firebase UID in subscription metadata for deletion');
      return;
    }

    console.log(`[SUBSCRIPTION WEBHOOK] Processing subscription deletion for user ${userId}, subscription ${subscription.id}`);

    // Update subscription status in Firestore
    const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
    await updateDoc(subscriptionRef, {
      status: 'cancelled',
      canceledAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    // Reset token allocation to 0
    await TokenService.updateMonthlyTokenAllocation(userId, 0);

    console.log(`[SUBSCRIPTION WEBHOOK] Subscription deleted for user ${userId} - Status set to cancelled`);

  } catch (error) {
    console.error('[SUBSCRIPTION WEBHOOK] Error handling subscription deleted:', error);
    throw error;
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
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

    // Update subscription status to active and reset failure tracking
    const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');

    // Get current subscription data to preserve existing fields
    const currentDoc = await getDoc(subscriptionRef);
    const currentData = currentDoc.exists() ? currentDoc.data() : {};

    const updateData = {
      ...currentData, // Preserve existing subscription data first
      status: 'active', // Always set to active on successful payment
      lastPaymentAt: new Date(invoice.created * 1000).toISOString(),
      failureCount: 0, // Reset failure count on successful payment
      lastFailedPaymentAt: null, // Clear failed payment timestamp
      lastFailedInvoiceId: null, // Clear failed invoice ID
      updatedAt: serverTimestamp(),
    };

    await updateDoc(subscriptionRef, updateData);

    // Ensure token allocation is up to date
    const price = subscription.items.data[0].price;
    const amount = price.unit_amount ? price.unit_amount / 100 : 0;
    await TokenService.updateMonthlyTokenAllocation(userId, amount);

  } catch (error) {
    console.error('Error handling payment succeeded:', error);
    throw error; // Re-throw to ensure webhook returns error status
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.firebaseUID;

    if (!userId) {
      console.error('No Firebase UID in subscription metadata');
      return;
    }

    // Get current failure count
    const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
    const subscriptionDoc = await getDoc(subscriptionRef);
    const currentData = subscriptionDoc.data();
    const failureCount = (currentData?.failureCount || 0) + 1;

    // Update subscription status with failure tracking
    await updateDoc(subscriptionRef, {
      status: 'past_due',
      lastFailedPaymentAt: new Date(invoice.created * 1000).toISOString(),
      failureCount: failureCount,
      lastFailedInvoiceId: invoice.id,
      updatedAt: serverTimestamp(),
    });

    // Create notification for failed payment
    await createFailedPaymentNotification(userId, failureCount, invoice);

    console.log(`Payment failed for user ${userId}, failure count: ${failureCount}`);

  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function createFailedPaymentNotification(userId: string, failureCount: number, invoice: Stripe.Invoice) {
  try {
    // Import notification function
    const { createNotification } = await import('../../../firebase/notifications');

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
