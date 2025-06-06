import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function GET(request) {
  try {
    const productId = "prod_RqrsHKfbMnaIHX"
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    async function getPricesForProduct(productId) {
      const priceList = await stripe.prices.list({
        product: productId,
        active: true, // only active prices
        limit: 10,    // optional: limit how many prices you fetch
      });
      return priceList.data; // this will be an array of Price objects
    }

    // Fetch all active subscription prices
    const prices = await getPricesForProduct(productId);

    // Format the response
    const formattedPrices = prices.map(price => {
      return {
        id: price.id,
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