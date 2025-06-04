import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey, getStripeWebhookSecret } from '../../../utils/stripeConfig';

// Initialize Stripe with the appropriate key based on environment
const stripeSecretKey = getStripeSecretKey();
const stripe = new Stripe(stripeSecretKey);
const endpointSecret = getStripeWebhookSecret();
console.log('Stripe initialized for webhook handler');

function err(msg) {
  console.error("⚠️ " + msg);
  return NextResponse.json(
    { error: msg },
    { status: 400 }
  );
}
export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    let event;

    // Verify webhook signature
    try {
      console.log("SECRET ", endpointSecret);
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
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
            limit: 1,
          });

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