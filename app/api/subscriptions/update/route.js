import Stripe from 'stripe';
import { updateSubscriptionStatus } from '@/firebase/database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { pageId, amount, percentage } = await req.json();
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
    const baseAmount = 1000; // $10 in cents - base subscription amount

    if (subscriptions.data.length > 0) {
      // Update existing subscription - keep the base amount constant
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
              unit_amount: baseAmount, // Always $10 in cents
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
            unit_amount: baseAmount, // $10 in cents
          },
        }],
      });
    }

    // Calculate the actual amount based on percentage
    const allocatedAmount = percentage ? (baseAmount / 100) * percentage : amount * 100;

    // Update subscription status in Firebase
    await updateSubscriptionStatus(subscription.id, {
      pageId,
      amount: allocatedAmount / 100, // Convert back to dollars
      percentage: percentage || (amount / 10) * 100, // Calculate percentage if not provided
      status: subscription.status,
      customerId,
      currentPeriodEnd: subscription.current_period_end,
    });

    return new Response(JSON.stringify({
      subscription: {
        id: subscription.id,
        amount: allocatedAmount / 100,
        percentage: percentage || (amount / 10) * 100,
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
