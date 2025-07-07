import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { getTierById, calculateTokensForAmount } from '../../../utils/subscriptionTiers';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

/**
 * Create Setup Intent for Embedded Subscription Checkout
 * 
 * This endpoint creates a Stripe Setup Intent for collecting payment method
 * information without immediately charging the customer. This is used for
 * subscription setup in PWA-compatible embedded checkout flows.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId: requestUserId, tier, amount, tierName, tokens, successUrl, cancelUrl } = await request.json();

    // Validate required fields
    if (!requestUserId || !tier || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, tier, amount' },
        { status: 400 }
      );
    }

    // Validate user matches authenticated user
    if (requestUserId !== userId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Validate tier and amount
    let finalAmount = amount;
    let finalTokens = tokens;
    let finalTierName = tierName;

    if (tier === 'tier3') {
      // Champion tier - custom amount starting at $30
      if (amount < 30 || amount > 1000) {
        return NextResponse.json(
          { error: 'Champion tier amount must be between $30 and $1000' },
          { status: 400 }
        );
      }
      finalTokens = calculateTokensForAmount(amount);
      finalTierName = 'Champion';
    } else if (tier === 'custom') {
      // Legacy custom tier support
      if (amount < 30 || amount > 1000) {
        return NextResponse.json(
          { error: 'Custom amount must be between $30 and $1000' },
          { status: 400 }
        );
      }
      finalTokens = calculateTokensForAmount(amount);
      finalTierName = 'Custom Plan';
    } else {
      // For standard tiers, validate against tier data
      const tierData = getTierById(tier);
      if (!tierData) {
        return NextResponse.json(
          { error: 'Invalid tier selected' },
          { status: 400 }
        );
      }
      finalAmount = tierData.amount;
      finalTokens = tierData.tokens;
      finalTierName = tierData.name;
    }

    // Get or create Stripe customer
    let stripeCustomerId: string;
    
    try {
      // Try to find existing customer by Firebase UID
      const existingCustomers = await stripe.customers.list({
        limit: 100 // Search through more customers to find the right one
      });

      // Filter by metadata since Stripe's list API doesn't support metadata filtering directly
      const matchingCustomers = existingCustomers.data.filter(customer =>
        customer.metadata?.firebaseUID === requestUserId
      );

      if (matchingCustomers.length > 0) {
        stripeCustomerId = matchingCustomers[0].id;
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          metadata: {
            firebaseUID: requestUserId,
          },
          description: `WeWrite user ${requestUserId}`,
        });
        stripeCustomerId = customer.id;
      }
    } catch (error) {
      console.error('Error managing Stripe customer:', error);
      return NextResponse.json(
        { error: 'Failed to setup customer account' },
        { status: 500 }
      );
    }

    // Create Setup Intent for payment method collection
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        usage: 'off_session', // For future subscription payments
        metadata: {
          firebaseUID: requestUserId,
          tier,
          amount: finalAmount.toString(),
          tokens: finalTokens.toString(),
          tierName: finalTierName,
          purpose: 'subscription_setup',
          successUrl: successUrl || '',
          cancelUrl: cancelUrl || ''
        },
        description: `WeWrite subscription setup: ${finalTierName} ($${finalAmount}/month)`
      });

      console.log('✅ Setup Intent created:', {
        setupIntentId: setupIntent.id,
        customerId: stripeCustomerId,
        tier,
        amount: finalAmount,
        tokens: finalTokens
      });

      return NextResponse.json({
        success: true,
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
        customerId: stripeCustomerId,
        subscription: {
          tier,
          amount: finalAmount,
          tokens: finalTokens,
          tierName: finalTierName
        }
      });

    } catch (error) {
      console.error('Error creating Setup Intent:', error);
      return NextResponse.json(
        { error: 'Failed to create payment setup' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Setup Intent creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get Setup Intent status (for polling/verification)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const setupIntentId = searchParams.get('setup_intent_id');

    if (!setupIntentId) {
      return NextResponse.json(
        { error: 'Setup Intent ID required' },
        { status: 400 }
      );
    }

    // Verify authentication
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    // Verify the setup intent belongs to the authenticated user
    if (setupIntent.metadata.firebaseUID !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      status: setupIntent.status,
      paymentMethod: setupIntent.payment_method,
      metadata: setupIntent.metadata
    });

  } catch (error) {
    console.error('Error retrieving Setup Intent:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve setup status' },
      { status: 500 }
    );
  }
}
