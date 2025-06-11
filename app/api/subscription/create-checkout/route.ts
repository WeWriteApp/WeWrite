/**
 * Unified Subscription Checkout API
 * 
 * Creates Stripe Checkout sessions for WeWrite subscriptions with token economy integration
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../../api/auth-helper';
import { 
  validateCustomAmount, 
  calculateTokensForAmount,
  getTierById 
} from '../../../utils/subscriptionTiers';

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-06-20',
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists() && userDoc.data().stripeCustomerId) {
      stripeCustomerId = userDoc.data().stripeCustomerId;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        metadata: {
          firebaseUID: userId,
        },
      });
      
      stripeCustomerId = customer.id;
      
      // Update user document with Stripe customer ID
      await setDoc(userRef, {
        stripeCustomerId: customer.id,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // Create Stripe price for this subscription
    const price = await stripe.prices.create({
      unit_amount: Math.round(finalAmount * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      product_data: {
        name: `WeWrite ${finalTierName}`,
        description: `${finalTokens} tokens per month for supporting WeWrite creators`,
        metadata: {
          tier,
          tokens: finalTokens.toString(),
        },
      },
      metadata: {
        tier,
        tokens: finalTokens.toString(),
      },
    });

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.id,
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

    // Create pending subscription record in Firestore
    const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
    await setDoc(subscriptionRef, {
      id: 'current',
      userId,
      stripeCustomerId,
      stripePriceId: price.id,
      stripeSubscriptionId: null, // Will be updated by webhook
      status: 'pending',
      tier,
      amount: finalAmount,
      tokens: finalTokens,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log(`Created checkout session for user ${userId}: ${tier} - $${finalAmount}/mo - ${finalTokens} tokens`);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
