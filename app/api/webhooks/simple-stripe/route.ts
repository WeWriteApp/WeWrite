/**
 * Simple Stripe Webhook Handler
 * 
 * A straightforward webhook handler that only updates Firebase when Stripe sends
 * subscription events, without complex sync logic or conflict resolution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getStripeSecretKey, getStripeWebhookSecret } from '../../../utils/stripeConfig';
import { db } from '../../../firebase/database/core';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { calculateTokensForAmount, determineTierFromAmount } from '../../../utils/subscriptionTiers';
import { getCollectionName } from "../../../utils/environmentConfig";

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('[SIMPLE WEBHOOK] No Stripe signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        getStripeWebhookSecret() || ''
      );
    } catch (err) {
      console.error('[SIMPLE WEBHOOK] Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`[SIMPLE WEBHOOK] Processing event: ${event.type}`);

    // Handle subscription events
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
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
        console.log(`[SIMPLE WEBHOOK] Unhandled event type: ${event.type}`);
        break;
    }

    return NextResponse.json({ received: true, eventType: event.type });

  } catch (error) {
    console.error('[SIMPLE WEBHOOK] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle subscription created/updated events
 */
async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  try {
    const userId = await getUserIdFromCustomer(subscription.customer as string);
    if (!userId) {
      console.error('[SIMPLE WEBHOOK] No user ID found for customer:', subscription.customer);
      return;
    }

    const price = subscription.items.data[0].price;
    const amount = price.unit_amount ? price.unit_amount / 100 : 0;

    const subscriptionData = {
      id: subscription.id,
      userId,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      tier: determineTierFromAmount(amount),
      amount,
      tokens: calculateTokensForAmount(amount),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: serverTimestamp()
    };

    // Update user's subscription
    await setDoc(
      doc(db, getCollectionName("users"), userId, 'subscriptions', 'current'),
      subscriptionData,
      { merge: true }
    );

    console.log(`[SIMPLE WEBHOOK] Updated subscription for user ${userId}: ${subscription.status}`);

  } catch (error) {
    console.error('[SIMPLE WEBHOOK] Error handling subscription event:', error);
  }
}

/**
 * Handle subscription deleted events
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const userId = await getUserIdFromCustomer(subscription.customer as string);
    if (!userId) {
      console.error('[SIMPLE WEBHOOK] No user ID found for customer:', subscription.customer);
      return;
    }

    // Update subscription status to canceled
    await setDoc(
      doc(db, getCollectionName("users"), userId, 'subscriptions', 'current'),
      {
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    console.log(`[SIMPLE WEBHOOK] Canceled subscription for user ${userId}`);

  } catch (error) {
    console.error('[SIMPLE WEBHOOK] Error handling subscription deletion:', error);
  }
}

/**
 * Handle successful payment events
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) {
      return; // Not a subscription invoice
    }

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = await getUserIdFromCustomer(subscription.customer as string);
    
    if (!userId) {
      console.error('[SIMPLE WEBHOOK] No user ID found for customer:', subscription.customer);
      return;
    }

    // Update subscription with successful payment info
    await setDoc(
      doc(db, getCollectionName("users"), userId, 'subscriptions', 'current'),
      {
        status: 'active',
        lastPaymentAt: new Date(invoice.created * 1000),
        failureCount: 0,
        lastFailedPaymentAt: null,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    console.log(`[SIMPLE WEBHOOK] Payment succeeded for user ${userId}`);

  } catch (error) {
    console.error('[SIMPLE WEBHOOK] Error handling payment success:', error);
  }
}

/**
 * Handle failed payment events
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) {
      return; // Not a subscription invoice
    }

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = await getUserIdFromCustomer(subscription.customer as string);
    
    if (!userId) {
      console.error('[SIMPLE WEBHOOK] No user ID found for customer:', subscription.customer);
      return;
    }

    // Update subscription with failed payment info
    await updateDoc(
      doc(db, getCollectionName("users"), userId, 'subscriptions', 'current'),
      {
        lastFailedPaymentAt: new Date(invoice.created * 1000),
        failureCount: (invoice.attempt_count || 1),
        updatedAt: serverTimestamp()
      }
    );

    console.log(`[SIMPLE WEBHOOK] Payment failed for user ${userId}, attempt ${invoice.attempt_count}`);

  } catch (error) {
    console.error('[SIMPLE WEBHOOK] Error handling payment failure:', error);
  }
}

/**
 * Get user ID from Stripe customer
 */
async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    return customer.metadata?.firebaseUID || null;
  } catch (error) {
    console.error('[SIMPLE WEBHOOK] Error getting customer:', error);
    return null;
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'simple-stripe-webhook',
    timestamp: new Date().toISOString()
  });
}
