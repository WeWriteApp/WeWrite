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
    console.log('🚀 [CREATE-SETUP-INTENT] Starting request...');

    // Verify authentication
    const userId = await getUserIdFromRequest(request);
    console.log('🔐 [CREATE-SETUP-INTENT] User ID from auth:', userId);

    if (!userId) {
      console.log('❌ [CREATE-SETUP-INTENT] No user ID found');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    let requestBody;
    try {
      requestBody = await request.json();
      console.log('📋 [CREATE-SETUP-INTENT] Request body:', requestBody);
    } catch (parseError) {
      console.error('❌ [CREATE-SETUP-INTENT] Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { userId: requestUserId, tier, amount, tierName, tokens, successUrl, cancelUrl } = requestBody;

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
    console.log('👤 [CREATE-SETUP-INTENT] Getting or creating Stripe customer...');
    let stripeCustomerId: string;

    try {
      console.log('🔍 [CREATE-SETUP-INTENT] Checking for existing customer ID in Firebase...');
      // First, check if user already has a customer ID in their subscription data
      const { initAdmin } = await import('../../../firebase/admin');
      const adminDb = initAdmin();

      const subscriptionDoc = await adminDb.collection('users').doc(requestUserId).collection('subscriptions').doc('current').get();

      if (subscriptionDoc.exists && subscriptionDoc.data()?.stripeCustomerId) {
        // Use existing customer ID from subscription data
        const existingCustomerId = subscriptionDoc.data()?.stripeCustomerId;

        try {
          // Verify the customer still exists in Stripe
          await stripe.customers.retrieve(existingCustomerId);
          stripeCustomerId = existingCustomerId;
          console.log('✅ Using existing customer ID from subscription:', existingCustomerId);
        } catch (customerError) {
          console.log('⚠️ Existing customer ID not found in Stripe, will create new one');
          throw new Error('Customer not found');
        }
      } else {
        throw new Error('No existing customer ID found');
      }
    } catch (error) {
      console.log('🔍 Creating new customer for user:', requestUserId);

      try {
        // Create new customer
        const customer = await stripe.customers.create({
          metadata: {
            firebaseUID: requestUserId,
          },
          description: `WeWrite user ${requestUserId}`,
        });
        stripeCustomerId = customer.id;
        console.log('✅ Created new customer:', customer.id);
      } catch (createError) {
        console.error('Error creating Stripe customer:', createError);
        return NextResponse.json(
          { error: 'Failed to setup customer account' },
          { status: 500 }
        );
      }
    }

    // Create Setup Intent for payment method collection
    console.log('💳 [CREATE-SETUP-INTENT] Creating Stripe Setup Intent...');
    console.log('💳 [CREATE-SETUP-INTENT] Customer ID:', stripeCustomerId);
    console.log('💳 [CREATE-SETUP-INTENT] Tier:', tier, 'Amount:', finalAmount);

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

  } catch (error: any) {
    console.error('❌ [CREATE-SETUP-INTENT] Unhandled error occurred:');
    console.error('❌ [CREATE-SETUP-INTENT] Error message:', error?.message);
    console.error('❌ [CREATE-SETUP-INTENT] Error type:', error?.type);
    console.error('❌ [CREATE-SETUP-INTENT] Error code:', error?.code);
    console.error('❌ [CREATE-SETUP-INTENT] Error stack:', error?.stack);
    console.error('❌ [CREATE-SETUP-INTENT] Full error object:', JSON.stringify(error, null, 2));

    // Return detailed error for debugging
    return NextResponse.json(
      {
        error: 'Internal server error in create-setup-intent',
        details: error?.message || 'Unknown error',
        type: error?.type || 'unknown',
        code: error?.code || 'unknown'
      },
      { status: 500 }
    );
  }
}
