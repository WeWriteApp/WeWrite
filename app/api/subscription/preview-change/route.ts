/**
 * Subscription Change Preview API
 * 
 * Provides proration preview for subscription changes without actually modifying the subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { determineTierFromAmount, getTierById } from '../../../utils/subscriptionTiers';

import { getStripe } from '../../../lib/stripe';

const stripe = getStripe();

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId, newTier, newAmount } = body;

    if (!subscriptionId) {
      return NextResponse.json({ 
        error: 'subscriptionId is required' 
      }, { status: 400 });
    }

    console.log(`[SUBSCRIPTION PREVIEW] User ${userId} previewing change for subscription ${subscriptionId}`);

    // Check if this is a test subscription
    const isTestSubscription = subscriptionId.startsWith('sub_test_');
    
    if (isTestSubscription) {
      // For test subscriptions, provide a mock preview
      const currentAmount = 10; // Default test amount
      const finalNewAmount = newAmount || (newTier ? getTierById(newTier)?.amount || 10 : 10);
      
      const preview = {
        currentAmount,
        newAmount: finalNewAmount,
        prorationAmount: finalNewAmount - currentAmount,
        nextBillingAmount: finalNewAmount,
        isUpgrade: finalNewAmount > currentAmount,
        description: finalNewAmount > currentAmount 
          ? `You'll be charged the difference immediately and your next billing will be $${finalNewAmount}.`
          : finalNewAmount < currentAmount
          ? `You'll receive a credit for the difference and your next billing will be $${finalNewAmount}.`
          : 'No change in billing amount.'
      };

      return NextResponse.json({ preview });
    }

    // Handle real subscription - get proration preview from Stripe
    try {
      // Get current subscription
      const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      const currentPrice = currentSubscription.items.data[0].price;
      const currentAmount = currentPrice.unit_amount / 100;

      // Calculate new amount
      let finalNewAmount: number;
      if (newAmount) {
        finalNewAmount = newAmount;
      } else if (newTier) {
        const tier = getTierById(newTier);
        if (!tier) {
          return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
        }
        finalNewAmount = tier.amount;
      } else {
        return NextResponse.json({ 
          error: 'Either newAmount or newTier is required' 
        }, { status: 400 });
      }

      // Create a temporary price for preview calculation
      const tempPrice = await stripe.prices.create({
        unit_amount: finalNewAmount * 100,
        currency: 'usd',
        recurring: { interval: 'month' },
        product: currentPrice.product,
      });

      // Get proration preview using Stripe's upcoming invoice preview
      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: currentSubscription.customer,
        subscription: subscriptionId,
        subscription_items: [{
          id: currentSubscription.items.data[0].id,
          price: tempPrice.id,
        }],
        subscription_proration_behavior: 'create_prorations',
      });

      // Calculate proration amount from the invoice
      let prorationAmount = 0;
      upcomingInvoice.lines.data.forEach((line: any) => {
        if (line.proration) {
          prorationAmount += line.amount / 100;
        }
      });

      const isUpgrade = finalNewAmount > currentAmount;
      
      const preview = {
        currentAmount,
        newAmount: finalNewAmount,
        prorationAmount,
        nextBillingAmount: finalNewAmount,
        isUpgrade,
        description: isUpgrade
          ? prorationAmount > 0 
            ? `You'll be charged $${Math.abs(prorationAmount).toFixed(2)} immediately for the upgrade, and your next billing will be $${finalNewAmount}.`
            : `Your subscription will be upgraded and your next billing will be $${finalNewAmount}.`
          : prorationAmount < 0
            ? `You'll receive a $${Math.abs(prorationAmount).toFixed(2)} credit for the downgrade, and your next billing will be $${finalNewAmount}.`
            : `Your subscription will be downgraded and your next billing will be $${finalNewAmount}.`
      };

      // Clean up the temporary price
      await stripe.prices.update(tempPrice.id, { active: false });

      console.log(`[SUBSCRIPTION PREVIEW] Generated preview for user ${userId}:`, preview);

      return NextResponse.json({ preview });

    } catch (stripeError) {
      console.error('[SUBSCRIPTION PREVIEW] Stripe API error:', stripeError);
      return NextResponse.json({ 
        error: 'Failed to generate preview from Stripe' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error generating subscription preview:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate preview' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to get subscription preview.' },
    { status: 405 }
  );
}
