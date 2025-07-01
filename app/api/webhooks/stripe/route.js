import { NextResponse } from 'next/server';
import { getStripeSecretKey, getStripeWebhookSecret } from '../../../utils/stripeConfig';

/**
 * LEGACY WEBHOOK HANDLER - DEPRECATED
 *
 * This webhook handler has been deprecated in favor of the comprehensive
 * handler at /api/webhooks/stripe-subscription/route.ts
 *
 * This handler is now disabled to prevent duplicate processing and data corruption.
 * All webhook events should be processed by the new handler.
 */

// Check if this handler has been explicitly disabled
const fs = require('fs');
const path = require('path');

function checkIfDisabled() {
  try {
    const flagPath = path.join(process.cwd(), 'app/api/webhooks/stripe/.disabled');
    if (fs.existsSync(flagPath)) {
      const flagData = JSON.parse(fs.readFileSync(flagPath, 'utf8'));
      return {
        disabled: true,
        ...flagData
      };
    }
  } catch (error) {
    console.warn('Error checking disable flag:', error);
  }
  return { disabled: false };
}

export async function POST(request) {
  // Check if this handler is disabled
  const disableStatus = checkIfDisabled();

  if (disableStatus.disabled) {
    console.log('🚫 Legacy webhook handler is disabled, redirecting to new handler');

    // Log the attempt for monitoring
    console.log('Legacy webhook received request but is disabled:', {
      timestamp: new Date().toISOString(),
      disabledAt: disableStatus.disabledAt,
      reason: disableStatus.reason,
      userAgent: request.headers.get('user-agent'),
      stripeSignature: request.headers.get('stripe-signature') ? 'present' : 'missing'
    });

    return NextResponse.json({
      error: 'This webhook endpoint has been deprecated',
      message: 'Please use /api/webhooks/stripe-subscription for all webhook events',
      disabledAt: disableStatus.disabledAt,
      reason: disableStatus.reason
    }, { status: 410 }); // 410 Gone - resource no longer available
  }

  // If not disabled, show deprecation warning but still process (for safety during transition)
  console.warn('⚠️ DEPRECATION WARNING: Legacy webhook handler is still active. This should be disabled to prevent duplicate processing.');

  // Continue with original logic for safety during transition period
  const Stripe = require('stripe');
  const stripe = new Stripe(getStripeSecretKey());
  const endpointSecret = getStripeWebhookSecret();

  function err(msg) {
    console.error("⚠️ LEGACY WEBHOOK: " + msg);
    return NextResponse.json(
      { error: msg },
      { status: 400 }
    );
  }

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    let event;

    // Verify webhook signature
    try {
      console.log("LEGACY WEBHOOK SECRET ", endpointSecret ? 'present' : 'missing');
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);

      // Log that legacy webhook is processing an event
      console.warn('🚨 LEGACY WEBHOOK PROCESSING EVENT:', {
        type: event.type,
        id: event.id,
        timestamp: new Date().toISOString(),
        warning: 'This should be processed by the new webhook handler'
      });

    } catch (err) {
      return err(`Webhook signature verification failed: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {

      case 'invoice.paid': {
        const invoice = event.data.object;

        // Case 1: Subscription invoice
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

          const valueStr = subscription.metadata?.subscription_value;

          if (!valueStr) {
            return err(`Missing subscription_value in invoice metadata`);
          }

          const value = parseInt(valueStr, 10);
          if (isNaN(value)) {
            return err('Invalid subscription_value in metadata');
          }

          //const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          console.log("subscription paid: ", value/100);
          await stripe.subscriptions.update(subscription.id, {
            metadata: {
              ...subscription.metadata,
              current_credit: value.toString()
            }
          });
        }

        // Case 2: One-time invoice with upgrade tag
        else if (invoice.metadata?.tag === 'upgrade') {
          // Parse custom value from metadata
          const valueStr = invoice.metadata?.subscription_value;
          if (!valueStr) {
            return err(`Missing subscription_value in invoice metadata`);
          }

          const value = parseInt(valueStr, 10);
          if (isNaN(value)) {
            return err('Invalid subscription_value in metadata');
          }

          console.log("upgrade invoice paid: ", value/100);

          const subscriptions = await stripe.subscriptions.list({
            customer: invoice.customer,
            status: 'active',
            limit: 1});

          const activeSub = subscriptions.data[0];
          if (activeSub) {
            const item = activeSub.items.data[0];
            const currentCredit = parseInt(activeSub.metadata.current_credit || '0', 10);
            const newCredit = currentCredit + value;

            console.log("new credit ", newCredit);
            await stripe.subscriptions.update(activeSub.id, {
              items: [{
                id: item.id, // subscription item ID
                price: invoice.metadata.price_id, // new price ID
              }],
              proration_behavior: 'none',

              metadata: {
                ...activeSub.metadata,
                current_credit: newCredit.toString()
              }
            });
          }
          else {
            return err(`Subscription not found`);
          }
        }

        break;
      }
    }

    // Return a response to acknowledge receipt of the event
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}