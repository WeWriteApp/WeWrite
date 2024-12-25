import Stripe from 'stripe';

// Log key presence without exposing the full key
const stripeKey = process.env.STRIPE_SECRET_KEY;
console.log('Active subscriptions - Stripe key status:', {
  exists: !!stripeKey,
  length: stripeKey?.length,
  prefix: stripeKey?.substring(0, 7),
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET(req) {
  try {
    // Get the user's customer ID from the session
    const customerId = req.headers.get('x-customer-id');
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'Customer ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching subscriptions for customer:', {
      customerId,
      hasStripeInstance: !!stripe,
      hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    });

    // Fetch active subscriptions for the customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    console.log('Subscription list response:', {
      hasData: !!subscriptions.data,
      count: subscriptions.data.length,
    });

    if (subscriptions.data.length === 0) {
      return new Response(JSON.stringify({ subscription: null }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const subscription = subscriptions.data[0];
    const amount = subscription.items.data[0].price.unit_amount;

    return new Response(JSON.stringify({
      subscription: {
        id: subscription.id,
        amount: amount / 100, // Convert cents to dollars
        date: new Date(subscription.created * 1000),
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching subscription:', {
      message: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    return new Response(JSON.stringify({
      error: error.message,
      type: error.type,
      code: error.code,
    }), {
      status: error.statusCode || 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
