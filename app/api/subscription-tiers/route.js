import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET() {
  try {
    // Define the subscription tiers
    const tiers = [
      {
        id: 'bronze',
        name: 'Bronze',
        amount: 10,
        description: 'Support your favorite creators with a Bronze subscription',
        features: ['$10/month budget to allocate', 'Bronze supporter badge'],
        stripePriceId: process.env.STRIPE_BRONZE_PRICE_ID
      },
      {
        id: 'silver',
        name: 'Silver',
        amount: 20,
        description: 'Support your favorite creators with a Silver subscription',
        features: ['$20/month budget to allocate', 'Silver supporter badge', 'Early access to new features'],
        stripePriceId: process.env.STRIPE_SILVER_PRICE_ID
      },
      {
        id: 'gold',
        name: 'Gold',
        amount: 50,
        description: 'Support your favorite creators with a Gold subscription',
        features: ['$50/month budget to allocate', 'Gold supporter badge', 'Early access to new features', 'Exclusive content'],
        stripePriceId: process.env.STRIPE_GOLD_PRICE_ID
      },
      {
        id: 'diamond',
        name: 'Diamond',
        amount: 'Custom',
        description: 'Support your favorite creators with a custom amount',
        features: ['Custom monthly budget to allocate', 'Diamond supporter badge', 'All premium features', 'Priority support'],
        isCustom: true
      }
    ];

    return NextResponse.json({ tiers });
  } catch (error) {
    console.error('Error fetching subscription tiers:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
