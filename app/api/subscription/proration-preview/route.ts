import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Proration Preview API
 * 
 * Calculates the proration amount for a subscription change
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId, newAmount } = body;

    if (!subscriptionId || !newAmount) {
      return NextResponse.json({ 
        error: 'subscriptionId and newAmount are required' 
      }, { status: 400 });
    }

    console.log(`[PRORATION PREVIEW] User ${userId} requesting preview for subscription ${subscriptionId} to $${newAmount}`);

    // Check if this is a test subscription
    const isTestSubscription = subscriptionId.startsWith('sub_test_') ||
                               process.env.NODE_ENV === 'development';
    
    if (isTestSubscription) {
      // Return mock proration for test subscriptions
      console.log(`[PRORATION PREVIEW] Detected test subscription ${subscriptionId}, returning mock data`);
      
      return NextResponse.json({
        immediateCharge: Math.max(0, newAmount * 100 * 0.7), // Mock 70% proration
        nextBillingDate: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
        currency: 'usd'
      });
    }

    try {
      // Get current subscription
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (!subscription) {
        return NextResponse.json({ 
          error: 'Subscription not found' 
        }, { status: 404 });
      }

      // Create a new price for the new amount
      const newPrice = await stripe.prices.create({
        unit_amount: newAmount * 100, // Convert to cents
        currency: 'usd',
        recurring: { interval: 'month' },
        product: subscription.items.data[0].price.product,
      });

      // Get proration preview
      const invoice = await stripe.invoices.retrieveUpcoming({
        customer: subscription.customer,
        subscription: subscriptionId,
        subscription_items: [{
          id: subscription.items.data[0].id,
          price: newPrice.id,
        }],
        subscription_proration_behavior: 'create_prorations',
      });

      // Calculate the immediate charge (proration amount)
      const immediateCharge = invoice.amount_due;
      const nextBillingDate = subscription.current_period_end;

      console.log(`[PRORATION PREVIEW] Preview calculated:`, {
        immediateCharge,
        nextBillingDate,
        currency: invoice.currency
      });

      return NextResponse.json({
        immediateCharge,
        nextBillingDate,
        currency: invoice.currency
      });

    } catch (stripeError: any) {
      console.error('[PRORATION PREVIEW] Stripe API error:', stripeError);
      
      // Return a fallback calculation if Stripe preview fails
      const fallbackCharge = Math.max(0, newAmount * 100 * 0.7); // Estimate 70% proration
      const fallbackNextBilling = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
      
      return NextResponse.json({
        immediateCharge: fallbackCharge,
        nextBillingDate: fallbackNextBilling,
        currency: 'usd',
        isEstimate: true
      });
    }

  } catch (error) {
    console.error('[PRORATION PREVIEW] Error:', error);
    
    return NextResponse.json({
      error: 'Failed to calculate proration preview',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
