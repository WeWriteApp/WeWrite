import Stripe from 'stripe';
import { updateSubscriptionStatus } from '@/firebase/database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { pageId, amount } = await req.json();
    const customerId = req.headers.get('x-customer-id');

    if (!customerId) {
      return new Response('Customer ID is required', { status: 400 });
    }

    // Get customer's current subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    let subscription;
    if (subscriptions.data.length > 0) {
      // Update existing subscription
      subscription = await stripe.subscriptions.update(
        subscriptions.data[0].id,
        {
          items: [{
            id: subscriptions.data[0].items.data[0].id,
            price_data: {
              currency: 'usd',
              product: process.env.STRIPE_PRODUCT_ID,
              recurring: {
                interval: 'month'
              },
              unit_amount: Math.round(amount * 100), // Convert to cents
            },
          }],
        }
      );
    } else {
      // Create new subscription with default $10 amount
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price_data: {
            currency: 'usd',
            product: process.env.STRIPE_PRODUCT_ID,
            recurring: {
              interval: 'month'
            },
            unit_amount: 1000, // $10 in cents
          },
        }],
      });
    }

    // Update subscription status in Firebase
    await updateSubscriptionStatus(subscription.id, {
      pageId,
      amount: amount || 10,
      status: subscription.status,
      customerId,
      currentPeriodEnd: subscription.current_period_end,
    });

    return new Response(JSON.stringify({
      subscription: {
        id: subscription.id,
        amount: amount || 10,
        date: new Date(subscription.created * 1000),
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
      }
    }));
  } catch (error) {
    console.error('Error updating subscription:', error);
    return new Response(error.message, { status: 500 });
  }
}
