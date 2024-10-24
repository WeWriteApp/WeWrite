import { NextResponse } from 'next/server';
const stripe = require('stripe')(process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY);

export async function POST(req) {
  const request = await req.json()
  const { amount, currency, userId, type } = request

  const priceEnum = {
    10: {
      id: "price_1QDWsjDvb2vcGPvNWIu2Jczh"
    },
    50: {
      id: "price_1QDWoSDvb2vcGPvNablWmjcH"
    },
    100: {
      id: "price_1QDWnzDvb2vcGPvNw0gRI1uc"
    },
    300: {
      id: "price_1QD1axDvb2vcGPvNQCypFWfA"
    }
  }
  console.log("Metadata", userId, type, priceEnum[amount])
  if (req.method === 'POST') {
    try {
      // const { amount, currency, customerEmail } = req.body; // Assume these come from frontend
      // Create a new payment link
      let price;
      if (!priceEnum[amount]) {
        const product = await stripe.products.create({
          name: `Custom Subscription $${amount * 100}`,
        });
        price = await stripe.prices.create({
          unit_amount: amount * 100,  // The custom amount (in cents, e.g., $20 = 2000)
          currency: 'usd',
          recurring: { interval: 'month' },  // Define billing interval (monthly, yearly, etc.)
          product: product.id,
        });
      }
      else {
        price = priceEnum[amount]
      }
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: price.id, // Replace with your actual recurring Price ID
            quantity: 1,  // Number of items to purchase
          },
        ],
        mode: 'subscription',
        metadata: {
          id: userId,         // Custom data (example)
          type: type,       // Any additional custom field
        },
        success_url: `http://localhost:3000/profile`,
        cancel_url: `http://localhost:3000/profile`,
      });

      console.log("session", session)
      return NextResponse.json(session.id);
    } catch (err) {
      console.log('Error creating payment link:', err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: " error.message" }, { status: 500 });
  }
}