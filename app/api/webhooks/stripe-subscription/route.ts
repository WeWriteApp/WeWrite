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

    console.log(`Processing webhook event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
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
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata.firebaseUID;
    if (!userId) {
      console.error('No Firebase UID in subscription metadata');
      return;
    }

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
    const subscriptionData = {
      stripeSubscriptionId: subscription.id,
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
      console.log(`Created subscription document for user ${userId} via webhook`);
    }

    // Update user's token allocation
    if (subscription.status === 'active') {
      await TokenService.updateMonthlyTokenAllocation(userId, amount);
    }

    console.log(`Subscription updated for user ${userId}: ${tier} - $${amount}/mo - ${tokens} tokens`);

  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata.firebaseUID;
    if (!userId) {
      console.error('No Firebase UID in subscription metadata');
      return;
    }

    // Update subscription status in Firestore
    const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
    await updateDoc(subscriptionRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });

    // Reset token allocation to 0
    await TokenService.updateMonthlyTokenAllocation(userId, 0);

    console.log(`Subscription deleted for user ${userId}`);

  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.firebaseUID;
    
    if (!userId) {
      console.error('No Firebase UID in subscription metadata');
      return;
    }

    // Update subscription status to active
    const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
    await updateDoc(subscriptionRef, {
      status: 'active',
      lastPaymentAt: new Date(invoice.created * 1000).toISOString(),
      updatedAt: serverTimestamp(),
    });

    // Ensure token allocation is up to date
    const price = subscription.items.data[0].price;
    const amount = price.unit_amount ? price.unit_amount / 100 : 0;
    await TokenService.updateMonthlyTokenAllocation(userId, amount);

    console.log(`Payment succeeded for user ${userId}: $${amount}`);

  } catch (error) {
    console.error('Error handling payment succeeded:', error);
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

    // Update subscription status
    const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
    await updateDoc(subscriptionRef, {
      status: 'past_due',
      lastFailedPaymentAt: new Date(invoice.created * 1000).toISOString(),
      updatedAt: serverTimestamp(),
    });

    console.log(`Payment failed for user ${userId}`);

  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
