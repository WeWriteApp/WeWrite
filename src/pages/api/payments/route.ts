import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

interface RequestBody {
  amount: number;
  currency: string;
  user: {
    username: string;
    email: string;
    uid: string;
  };
  type: string;
}

const priceEnum: Record<number, { id: string }> = {
  10: { id: "price_1QDXjYIsJOA8IjJR5MPPFfnl" },
  50: { id: "price_1QDXk6IsJOA8IjJR7Hi8w7Lx" },
  100: { id: "price_1QDXkiIsJOA8IjJRuHFAKQKv" },
  300: { id: "price_1QDXlIIsJOA8IjJROZIwroQM" },
};

export async function POST(req: Request) {
  try {
    const requestBody: RequestBody = await req.json();
    const { amount, currency, user, type } = requestBody;

    console.log("Metadata", type, priceEnum[amount]);

    let price;

    if (!priceEnum[amount]) {
      const product = await stripe.products.create({
        name: `Custom Subscription $${amount * 100}`,
      });
      price = await stripe.prices.create({
        unit_amount: amount * 100,
        currency,
        recurring: { interval: 'month' },
        product: product.id,
      });
    } else {
      price = priceEnum[amount];
    }

    const customer = await stripe.customers.create({
      name: user.username,
      email: user.email,
      metadata: {
        id: user.uid,
      },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      customer: customer.id,
      metadata: {
        userId: user.uid,
        type,
      },
      success_url: `http://localhost:3000/profile`,
      cancel_url: `http://localhost:3000/profile`,
    });

    console.log("session", session);
    return NextResponse.json({ sessionId: session.id });
  } catch (err: any) {
    console.log('Error creating payment link:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
