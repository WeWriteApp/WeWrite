import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '../../../firebase/admin';
import { getUserIdFromRequest } from '../../auth-helper';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { checkPaymentsFeatureFlag } from '../../feature-flag-helper';
import { getTierById, calculateTokensForAmount, validateCustomAmount } from '../../../utils/subscriptionTiers';

// Initialize Firebase Admin lazily
let db: any;

function initializeFirebase() {
  if (db) return { db }; // Already initialized

  try {
    const app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { db: null };
    }

    db = getFirestore();
  } catch (error) {
    console.error('Error initializing Firebase Admin in preview-change route:', error);
    return { db: null };
  }

  return { db };
}

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2025-04-30.basil' as any,
});

// POST /api/subscription/preview-change - Preview proration for subscription changes
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase lazily
    const { db: firestore } = initializeFirebase();

    if (!firestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Update local reference
    db = firestore;

    // Check if payments feature is enabled
    const featureCheckResponse = await checkPaymentsFeatureFlag();
    if (featureCheckResponse) {
      return featureCheckResponse;
    }

    // Get user ID from request
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId, newTier, newAmount } = body;

    if (!subscriptionId || !newTier) {
      return NextResponse.json({ 
        error: 'Subscription ID and new tier are required' 
      }, { status: 400 });
    }

    // Validate new tier and amount
    let finalAmount: number;
    let finalTokens: number;

    if (newTier === 'custom') {
      if (!newAmount || newAmount <= 0) {
        return NextResponse.json({ 
          error: 'Valid amount is required for custom tier' 
        }, { status: 400 });
      }

      const validation = validateCustomAmount(newAmount);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      finalAmount = newAmount;
      finalTokens = calculateTokensForAmount(newAmount);
    } else {
      const tierData = getTierById(newTier);
      if (!tierData) {
        return NextResponse.json({ error: 'Invalid tier selected' }, { status: 400 });
      }

      finalAmount = tierData.amount;
      finalTokens = tierData.tokens;
    }

    // Get current subscription from Stripe
    const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    if (!currentSubscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Get current price and amount
    const currentPrice = currentSubscription.items.data[0].price;
    const currentAmount = currentPrice.unit_amount ? currentPrice.unit_amount / 100 : 0;

    // Create a temporary price to calculate proration
    const tempPrice = await stripe.prices.create({
      unit_amount: Math.round(finalAmount * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      product_data: {
        name: `WeWrite ${newTier === 'custom' ? 'Custom' : getTierById(newTier)?.name} (Preview)`,
        description: `${finalTokens} tokens per month for supporting WeWrite creators`,
      },
      metadata: {
        tier: newTier,
        tokens: finalTokens.toString(),
        preview: 'true',
      },
    });

    try {
      // Preview the subscription update to get proration details
      const previewInvoice = await stripe.invoices.retrieveUpcoming({
        customer: currentSubscription.customer as string,
        subscription: subscriptionId,
        subscription_items: [
          {
            id: currentSubscription.items.data[0].id,
            price: tempPrice.id,
          },
        ],
        subscription_proration_behavior: 'create_prorations',
      });

      // Calculate proration amount
      let prorationAmount = 0;
      let immediateCharge = 0;

      // Find proration line items
      const prorationLines = previewInvoice.lines.data.filter(line => 
        line.proration === true
      );

      for (const line of prorationLines) {
        prorationAmount += line.amount / 100; // Convert from cents
      }

      // Find the new subscription line item
      const newSubscriptionLine = previewInvoice.lines.data.find(line => 
        line.price?.id === tempPrice.id && line.proration === false
      );

      if (newSubscriptionLine) {
        immediateCharge += newSubscriptionLine.amount / 100; // Convert from cents
      }

      const totalAmount = previewInvoice.amount_due / 100; // Convert from cents
      const isUpgrade = finalAmount > currentAmount;

      // Generate description
      let description: string;
      if (isUpgrade) {
        description = `You'll be charged ${formatCurrency(Math.abs(totalAmount))} now for the upgrade, then ${formatCurrency(finalAmount)} monthly.`;
      } else if (finalAmount < currentAmount) {
        description = `You'll receive a ${formatCurrency(Math.abs(prorationAmount))} credit for the downgrade, then ${formatCurrency(finalAmount)} monthly.`;
      } else {
        description = `Your subscription will be updated to ${formatCurrency(finalAmount)} monthly.`;
      }

      const preview = {
        currentAmount: currentAmount,
        newAmount: finalAmount,
        prorationAmount: totalAmount,
        nextBillingAmount: finalAmount,
        isUpgrade: isUpgrade,
        description: description,
        currentPeriodEnd: new Date(currentSubscription.current_period_end * 1000).toISOString(),
        tokens: finalTokens,
      };

      return NextResponse.json({
        success: true,
        preview: preview,
      });

    } finally {
      // Clean up the temporary price
      try {
        await stripe.prices.update(tempPrice.id, { active: false });
      } catch (cleanupError) {
        console.error('Error cleaning up temporary price:', cleanupError);
        // Don't fail the request for cleanup errors
      }
    }

  } catch (error: any) {
    console.error('Error previewing subscription change:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return NextResponse.json({ 
        error: 'Payment method error: ' + error.message 
      }, { status: 402 });
    } else if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json({ 
        error: 'Invalid request: ' + error.message 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to preview subscription change' 
    }, { status: 500 });
  }
}

// Helper function to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// GET method not allowed
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
