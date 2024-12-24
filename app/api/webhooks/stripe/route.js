import Stripe from 'stripe';
import { headers } from 'next/headers';
import { updateSubscriptionStatus } from '@/firebase/database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req) {
  const body = await req.text();
  const signature = headers().get('stripe-signature');

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case 'customer.subscription.created':
        await updateSubscriptionStatus(event.data.object.id, {
          status: 'active',
          customerId: event.data.object.customer,
          priceId: event.data.object.items.data[0].price.id,
          amount: event.data.object.items.data[0].price.unit_amount,
          currentPeriodEnd: event.data.object.current_period_end,
        });
        break;

      case 'customer.subscription.updated':
        await updateSubscriptionStatus(event.data.object.id, {
          status: event.data.object.status,
          amount: event.data.object.items.data[0].price.unit_amount,
          currentPeriodEnd: event.data.object.current_period_end,
        });
        break;

      case 'customer.subscription.deleted':
        await updateSubscriptionStatus(event.data.object.id, {
          status: 'canceled',
          canceledAt: event.data.object.canceled_at,
        });
        break;
    }

    return new Response(JSON.stringify({ received: true }));
  } catch (err) {
    console.error('Webhook error:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
}
