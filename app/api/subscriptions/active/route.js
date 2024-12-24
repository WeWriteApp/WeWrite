import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET(req) {
  try {
    // Get the user's customer ID from the session
    const customerId = req.headers.get('x-customer-id');
    if (!customerId) {
      return new Response('Customer ID is required', { status: 400 });
    }

    // Fetch active subscriptions for the customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return new Response(JSON.stringify({ subscription: null }));
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
    }));
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return new Response(error.message, { status: 500 });
  }
}
