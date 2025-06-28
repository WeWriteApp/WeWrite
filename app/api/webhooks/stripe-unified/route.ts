/**
 * Unified Stripe Webhook Handler
 * 
 * This single endpoint handles ALL Stripe webhook events and routes them
 * to appropriate service handlers. This eliminates duplicate processing
 * and provides a single source of truth for webhook event handling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getStripeSecretKey, getStripeWebhookSecret } from '../../../utils/stripeConfig';
import { stripePayoutService } from '../../../services/stripePayoutService';

// Import subscription handlers from existing webhook
// Note: These are dynamically imported to avoid circular dependencies
let subscriptionHandlers: any = null;
let subscriptionStatusHandler: any = null;

async function getSubscriptionHandlers() {
  if (!subscriptionHandlers) {
    subscriptionHandlers = await import('../stripe-subscription/route');
  }
  return subscriptionHandlers;
}

async function getSubscriptionStatusHandler() {
  if (!subscriptionStatusHandler) {
    subscriptionStatusHandler = await import('../subscription-status/route');
  }
  return subscriptionStatusHandler;
}

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia',
});

/**
 * Unified webhook event router
 * Routes events to appropriate service handlers while preventing duplicate processing
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let event: Stripe.Event | undefined;

  try {
    // Parse and verify webhook
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('[UNIFIED WEBHOOK] No Stripe signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        getStripeWebhookSecret() || ''
      );
    } catch (err) {
      console.error('[UNIFIED WEBHOOK] Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`[UNIFIED WEBHOOK] Processing event: ${event.type} (ID: ${event.id})`);

    // Route events to appropriate handlers
    const results = await routeWebhookEvent(event);

    const processingTime = Date.now() - startTime;
    console.log(`[UNIFIED WEBHOOK] Successfully processed ${event.type} in ${processingTime}ms`);

    return NextResponse.json({
      received: true,
      eventType: event.type,
      eventId: event.id,
      processingTime,
      handlersExecuted: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[UNIFIED WEBHOOK] Error processing event ${event?.type || 'unknown'}:`, error);
    
    return NextResponse.json({
      error: 'Webhook processing failed',
      eventType: event?.type || 'unknown',
      eventId: event?.id || 'unknown',
      processingTime,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Route webhook events to appropriate service handlers
 * Each handler is wrapped in try-catch to prevent one failure from breaking others
 */
async function routeWebhookEvent(event: Stripe.Event): Promise<string[]> {
  const executedHandlers: string[] = [];

  // Subscription and Payment Events
  if (isSubscriptionEvent(event.type)) {
    try {
      await handleSubscriptionWebhookEvent(event);
      executedHandlers.push('subscription-handler');
    } catch (error) {
      console.error(`[UNIFIED WEBHOOK] Subscription handler failed for ${event.type}:`, error);
      // Continue processing other handlers
    }

    // Also handle subscription status changes for pledge budget validation
    try {
      const statusHandler = await getSubscriptionStatusHandler();
      await statusHandler.handleSubscriptionEvent(event);
      executedHandlers.push('subscription-status-handler');
    } catch (error) {
      console.error(`[UNIFIED WEBHOOK] Subscription status handler failed for ${event.type}:`, error);
      // Continue processing other handlers
    }
  }

  // Payout Events
  if (isPayoutEvent(event.type)) {
    try {
      await stripePayoutService.handleWebhookEvent(event);
      executedHandlers.push('payout-handler');
    } catch (error) {
      console.error(`[UNIFIED WEBHOOK] Payout handler failed for ${event.type}:`, error);
      // Continue processing other handlers
    }
  }

  // Log if no handlers were executed
  if (executedHandlers.length === 0) {
    console.log(`[UNIFIED WEBHOOK] No handlers configured for event type: ${event.type}`);
  }

  return executedHandlers;
}

/**
 * Handle subscription-related webhook events
 */
async function handleSubscriptionWebhookEvent(event: Stripe.Event): Promise<void> {
  const handlers = await getSubscriptionHandlers();

  switch (event.type) {
    case 'checkout.session.completed':
      await handlers.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handlers.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handlers.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'invoice.payment_succeeded':
      await handlers.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;

    case 'invoice.payment_failed':
      await handlers.handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      console.log(`[UNIFIED WEBHOOK] Unhandled subscription event: ${event.type}`);
  }
}

/**
 * Check if event is subscription-related
 */
function isSubscriptionEvent(eventType: string): boolean {
  const subscriptionEvents = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed'
  ];
  return subscriptionEvents.includes(eventType);
}

/**
 * Check if event is payout-related
 */
function isPayoutEvent(eventType: string): boolean {
  const payoutEvents = [
    'transfer.created',
    'transfer.paid',
    'transfer.failed',
    'account.updated'
  ];
  return payoutEvents.includes(eventType);
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'stripe-unified-webhook',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    webhookSecret: getStripeWebhookSecret() ? 'configured' : 'missing',
    supportedEvents: {
      subscription: [
        'checkout.session.completed',
        'customer.subscription.created',
        'customer.subscription.updated', 
        'customer.subscription.deleted',
        'invoice.payment_succeeded',
        'invoice.payment_failed'
      ],
      payout: [
        'transfer.created',
        'transfer.paid', 
        'transfer.failed',
        'account.updated'
      ]
    }
  });
}
