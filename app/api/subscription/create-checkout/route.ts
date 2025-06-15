/**
 * Unified Subscription Checkout API
 * 
 * Creates Stripe Checkout sessions for WeWrite subscriptions with token economy integration
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initAdmin } from '../../../firebase/admin';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../../api/auth-helper';
import {
  validateCustomAmount,
  calculateTokensForAmount,
  getTierById
} from '../../../utils/subscriptionTiers';
import { getOrCreatePriceForTier, createCustomPrice } from '../../../utils/stripeProductManager';

// Initialize Firebase Admin and Stripe
const adminApp = initAdmin();
const adminDb = adminApp.firestore();
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        error: 'Authentication required. Please log in and try again.'
      }, { status: 401 });
    }

    const body = await request.json();
    const { 
      tier, 
      amount, 
      tierName, 
      tokens, 
      successUrl, 
      cancelUrl 
    } = body;

    // Validate input
    if (!tier) {
      return NextResponse.json({ error: 'Tier is required' }, { status: 400 });
    }

    let finalAmount: number;
    let finalTierName: string;
    let finalTokens: number;

    if (tier === 'custom') {
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'Valid amount is required for custom tier' }, { status: 400 });
      }

      const validation = validateCustomAmount(amount);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      finalAmount = amount;
      finalTierName = tierName || `Custom ($${amount}/mo)`;
      finalTokens = calculateTokensForAmount(amount);
    } else {
      const tierData = getTierById(tier);
      if (!tierData) {
        return NextResponse.json({ error: 'Invalid tier selected' }, { status: 400 });
      }

      finalAmount = tierData.amount;
      finalTierName = tierData.name;
      finalTokens = tierData.tokens;
    }

    // Get or create Stripe customer
    let stripeCustomerId: string;

    // Check if user already has a Stripe customer ID
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists && userDoc.data()?.stripeCustomerId) {
      stripeCustomerId = userDoc.data()!.stripeCustomerId;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        metadata: {
          firebaseUID: userId,
        },
      });

      stripeCustomerId = customer.id;

      // Update user document with Stripe customer ID
      await userRef.set({
        stripeCustomerId: customer.id,
        updatedAt: new Date()
      }, { merge: true });
    }

    // Get or create Stripe price using the centralized product manager
    let priceId: string;

    if (tier === 'custom') {
      // For custom amounts, always create a new price
      priceId = await createCustomPrice(finalAmount);
    } else {
      // For standard tiers, use the product manager to get or create price
      const tierData = getTierById(tier);
      if (!tierData) {
        return NextResponse.json({ error: 'Invalid tier selected' }, { status: 400 });
      }

      priceId = await getOrCreatePriceForTier(tierData);
    }

    console.log(`Using price ID for tier ${tier}: ${priceId} ($${finalAmount}/mo, ${finalTokens} tokens)`);

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?cancelled=true`,
      metadata: {
        firebaseUID: userId,
        tier,
        amount: finalAmount.toString(),
        tokens: finalTokens.toString(),
      },
      subscription_data: {
        metadata: {
          firebaseUID: userId,
          tier,
          amount: finalAmount.toString(),
          tokens: finalTokens.toString(),
        },
      },
    });

    // Create initial subscription record in Firestore with incomplete status
    // This matches Stripe's initial subscription status before payment
    const subscriptionRef = adminDb.collection('users').doc(userId).collection('subscription').doc('current');
    await subscriptionRef.set({
      id: 'current',
      userId,
      stripeCustomerId,
      stripePriceId: priceId,
      stripeSubscriptionId: null, // Will be updated by webhook
      status: 'incomplete', // Match Stripe's initial status
      tier,
      amount: finalAmount,
      tokens: finalTokens,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });

    console.log(`Created checkout session for user ${userId}: ${tier} - $${finalAmount}/mo - ${finalTokens} tokens`);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);

    // Provide more specific error messages
    let errorMessage = 'Failed to create checkout session';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('PERMISSION_DENIED') || error.message.includes('Missing or insufficient permissions')) {
        errorMessage = 'Database permission error. Please contact support if this persists.';
        statusCode = 500;
        console.error('Firebase Admin SDK permission error - check service account IAM roles');
      } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
        errorMessage = 'Authentication failed. Please log in and try again.';
        statusCode = 401;
      } else if (error.message.includes('stripe') || error.message.includes('Stripe')) {
        errorMessage = 'Payment processing error. Please try again.';
        statusCode = 500;
      } else if (error.message.includes('Invalid tier') || error.message.includes('amount')) {
        errorMessage = error.message;
        statusCode = 400;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
