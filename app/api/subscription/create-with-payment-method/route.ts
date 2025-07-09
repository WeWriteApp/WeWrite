import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { getTierById, calculateTokensForAmount } from '../../../utils/subscriptionTiers';
import { getOrCreatePriceForTier, createCustomPrice } from '../../../utils/stripeProductManager';
import { db } from '../../../firebase/database/core';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getCollectionName, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

/**
 * Create Subscription with Payment Method
 * 
 * This endpoint creates a Stripe subscription using a payment method
 * that was collected via Setup Intent in the embedded checkout flow.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedUserId = await getUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { 
      userId, 
      paymentMethodId, 
      tier, 
      amount, 
      tierName, 
      tokens 
    } = await request.json();

    // Validate required fields
    if (!userId || !paymentMethodId || !tier || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, paymentMethodId, tier, amount' },
        { status: 400 }
      );
    }

    // Validate user matches authenticated user
    if (userId !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Validate tier and calculate final values
    let finalAmount = amount;
    let finalTokens = tokens;
    let finalTierName = tierName;

    if (tier === 'custom') {
      if (amount < 5 || amount > 1000) {
        return NextResponse.json(
          { error: 'Custom amount must be between $5 and $1000' },
          { status: 400 }
        );
      }
      finalTokens = calculateTokensForAmount(amount);
      finalTierName = 'Custom Plan';
    } else {
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

    // Get customer from payment method
    let stripeCustomerId: string;
    
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      if (!paymentMethod.customer) {
        return NextResponse.json(
          { error: 'Payment method must be attached to a customer' },
          { status: 400 }
        );
      }
      
      stripeCustomerId = paymentMethod.customer as string;
    } catch (error) {
      console.error('Error retrieving payment method:', error);
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    // Get or create Stripe price
    let priceId: string;
    
    try {
      if (tier === 'custom') {
        priceId = await createCustomPrice(finalAmount);
      } else {
        const tierData = getTierById(tier);
        if (!tierData) {
          throw new Error('Invalid tier');
        }
        priceId = await getOrCreatePriceForTier(tierData);
      }
    } catch (error) {
      console.error('Error creating price:', error);
      return NextResponse.json(
        { error: 'Failed to setup pricing' },
        { status: 500 }
      );
    }

    // Create the subscription
    try {
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        default_payment_method: paymentMethodId,
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          firebaseUID: userId,
          tier,
          amount: finalAmount.toString(),
          tokens: finalTokens.toString(),
          tierName: finalTierName,
          source: 'embedded_checkout'
        },
        description: `WeWrite subscription: ${finalTierName}`
      });

      console.log('✅ Subscription created:', {
        subscriptionId: subscription.id,
        customerId: stripeCustomerId,
        tier,
        amount: finalAmount,
        tokens: finalTokens,
        status: subscription.status
      });

      // Save subscription to Firebase
      try {
        const subscriptionData = {
          id: subscription.id,
          userId,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          tier,
          amount: finalAmount,
          tokens: finalTokens,
          tierName: finalTierName,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          metadata: {
            source: 'embedded_checkout',
            paymentMethodId
          }
        };

        // Save to subscriptions collection
        await setDoc(
          doc(db, getCollectionName(PAYMENT_COLLECTIONS.SUBSCRIPTIONS), subscription.id),
          subscriptionData
        );

        // Update user subscription subcollection
        await setDoc(
          doc(db, 'users', userId, 'subscriptions', 'current'),
          {
            id: 'current',
            userId,
            status: subscription.status,
            tier,
            amount: finalAmount,
            tokens: finalTokens,
            tierName: finalTierName,
            stripeCustomerId,
            stripeSubscriptionId: subscription.id,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );

        console.log('✅ Subscription saved to Firebase');

      } catch (firebaseError) {
        console.error('Error saving subscription to Firebase:', firebaseError);
        // Don't fail the request since Stripe subscription was created successfully
        // The webhook will handle Firebase sync as backup
      }

      return NextResponse.json({
        success: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        subscription: {
          id: subscription.id,
          tier,
          amount: finalAmount,
          tokens: finalTokens,
          tierName: finalTierName,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end
        }
      });

    } catch (error) {
      console.error('Error creating subscription:', error);
      
      // Handle specific Stripe errors
      if (error instanceof Stripe.errors.StripeError) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Subscription creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
