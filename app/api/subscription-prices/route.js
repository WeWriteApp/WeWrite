import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function GET() {
  try {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Fetch all active subscription prices
    const prices = await stripe.prices.list({
      active: true,
      type: 'recurring',
      limit: 5,
      expand: ['data.product']
    });
    
    // Format the response
    const formattedPrices = prices.data.map(price => {
      return {
        id: price.id,
        productId: price.product.id,
        productName: price.product.name,
        unitAmount: price.unit_amount / 100,
        currency: price.currency,
        interval: price.recurring.interval,
        intervalCount: price.recurring.interval_count,
        metadata: price.metadata
      };
    });
    
    // Sort by amount
    formattedPrices.sort((a, b) => a.unitAmount - b.unitAmount);
    
    return NextResponse.json(formattedPrices);
  } catch (error) {
    console.error('Error fetching subscription prices:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 