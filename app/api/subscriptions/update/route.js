import Stripe from 'stripe';
import { updateSubscriptionStatus } from '@/firebase/database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { pageId, amount, percentage } = await req.json();
    const customerId = req.headers.get('x-customer-id');

    console.log('Subscription update request:', { pageId, amount, percentage, customerId });

    if (!customerId) {
      console.error('Missing customer ID in request headers');
      return new Response('Customer ID is required', { status: 400 });
    }

    if (!pageId) {
      console.error('Missing pageId in request body');
      return new Response('Page ID is required', { status: 400 });
    }

    if (amount === undefined && percentage === undefined) {
      console.error('Missing amount or percentage in request body');
      return new Response('Amount or percentage is required', { status: 400 });
    }

    // Get customer's current subscription
    console.log('Fetching subscriptions for customer:', customerId);
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    console.log('Current subscriptions:', subscriptions.data);

    let subscription;
    const baseAmount = 1000; // $10 in cents - base subscription amount

    try {
      if (subscriptions.data.length > 0) {
        console.log('Updating existing subscription:', subscriptions.data[0].id);
        // Update existing subscription - keep the base amount constant
        subscription = await stripe.subscriptions.update(
          subscriptions.data[0].id,
          {
            items: [{
              id: subscriptions.data[0].items.data[0].id,
              price: process.env.STRIPE_PRICE_ID, // Use existing price ID
            }],
          }
        );
      } else {
        console.log('Creating new subscription for customer:', customerId);
        // Create new subscription with default $10 amount using existing price
        subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{
            price: process.env.STRIPE_PRICE_ID, // Use existing price ID
          }],
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
        });
      }

      // Calculate the actual amount based on percentage
      const allocatedAmount = percentage ? (baseAmount / 100) * percentage : amount * 100;

      console.log('Updating subscription status in Firebase:', {
        subscriptionId: subscription.id,
        pageId,
        amount: allocatedAmount / 100,
        percentage: percentage || (amount / 10) * 100,
      });

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
          clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
        }
      }));
    } catch (stripeError) {
      console.error('Stripe API error:', {
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message,
        param: stripeError.param,
      });
      return new Response(JSON.stringify({
        error: stripeError.message,
        code: stripeError.code,
      }), { status: 400 });
    }
  } catch (error) {
    console.error('Error in subscription update route:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }), { status: 500 });
  }
}
