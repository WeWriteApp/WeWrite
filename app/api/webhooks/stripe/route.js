import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateSubscription } from '../../../firebase/subscription';
import { getStripeSecretKey, getStripeWebhookSecret } from '../../../utils/stripeConfig';
import { db } from '../../../firebase/database';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Helper function to determine tier based on amount
function determineTierFromAmount(amount) {
  return amount >= 50 ? 'tier3' : amount >= 20 ? 'tier2' : amount >= 10 ? 'tier1' : 'tier0';
}

// Initialize Stripe with the appropriate key based on environment
const stripeSecretKey = getStripeSecretKey();
const stripe = new Stripe(stripeSecretKey);
const endpointSecret = getStripeWebhookSecret();
console.log('Stripe initialized for webhook handler');

export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    let event;

    // Verify webhook signature
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
      console.error(`⚠️ Webhook signature verification failed.`, err.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // Extract the Firebase user ID from metadata
        const userId = session.metadata.firebaseUID;

        if (!userId) {
          console.error('No Firebase user ID found in session metadata');
          break;
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // Get tier information from metadata
        const tier = session.metadata?.tier ||
                    subscription.metadata?.tier ||
                    determineTierFromAmount(subscription.items.data[0].price.unit_amount / 100);

        console.log(`Webhook: Updating subscription for user ${userId} to active status`);

        // Update subscription in Firestore
        await updateSubscription(userId, {
          stripeSubscriptionId: session.subscription,
          status: 'active',
          amount: subscription.items.data[0].price.unit_amount / 100,
          stripePriceId: subscription.items.data[0].price.id,
          tier: tier,
          billingCycleStart: new Date(subscription.current_period_start * 1000).toISOString(),
          billingCycleEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Also update the user document to include tier information for quick access
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          tier: tier,
          subscriptionStatus: 'active',
          updatedAt: serverTimestamp()
        });

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;

        // Only handle subscription invoices
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const customer = await stripe.customers.retrieve(invoice.customer);
          const userId = customer.metadata.firebaseUID;

          if (!userId) {
            console.error('No Firebase user ID found in customer metadata');
            break;
          }

          // Get tier information from metadata
          const tier = customer.metadata?.tier ||
                      subscription.metadata?.tier ||
                      determineTierFromAmount(subscription.items.data[0].price.unit_amount / 100);

          console.log(`Webhook: Updating subscription for user ${userId} to active status (invoice payment)`);

          // Update subscription in Firestore
          await updateSubscription(userId, {
            status: 'active',
            amount: subscription.items.data[0].price.unit_amount / 100,
            stripePriceId: subscription.items.data[0].price.id,
            tier: tier,
            billingCycleStart: new Date(subscription.current_period_start * 1000).toISOString(),
            billingCycleEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Also update the user document to include tier information for quick access
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, {
            tier: tier,
            subscriptionStatus: 'active',
            updatedAt: serverTimestamp()
          });
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;

        // Only handle subscription invoices
        if (invoice.subscription) {
          const customer = await stripe.customers.retrieve(invoice.customer);
          const userId = customer.metadata.firebaseUID;

          if (!userId) {
            console.error('No Firebase user ID found in customer metadata');
            break;
          }

          // Update subscription in Firestore
          await updateSubscription(userId, {
            status: 'past_due',
          });
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        const userId = customer.metadata.firebaseUID;

        if (!userId) {
          console.error('No Firebase user ID found in customer metadata');
          break;
        }

        // Get tier information from metadata
        const tier = customer.metadata?.tier ||
                    subscription.metadata?.tier ||
                    determineTierFromAmount(subscription.items.data[0].price.unit_amount / 100);

        console.log(`Webhook: Updating subscription for user ${userId} to ${subscription.status} status`);

        // Update subscription in Firestore
        await updateSubscription(userId, {
          status: subscription.status,
          amount: subscription.items.data[0].price.unit_amount / 100,
          stripePriceId: subscription.items.data[0].price.id,
          tier: tier,
          billingCycleStart: new Date(subscription.current_period_start * 1000).toISOString(),
          billingCycleEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Also update the user document to include tier information for quick access
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          tier: tier,
          subscriptionStatus: subscription.status,
          updatedAt: serverTimestamp()
        });

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        const userId = customer.metadata.firebaseUID;

        if (!userId) {
          console.error('No Firebase user ID found in customer metadata');
          break;
        }

        console.log(`Webhook: Updating subscription for user ${userId} to canceled status`);

        // Update subscription in Firestore
        await updateSubscription(userId, {
          status: 'canceled',
          updatedAt: new Date().toISOString(),
        });

        // Also update the user document to remove tier information
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          tier: null,
          subscriptionStatus: 'canceled',
          updatedAt: serverTimestamp()
        });

        break;
      }

      default: {
        console.log(`Unhandled event type: ${event.type}`);
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