/**
 * Subscription Reactivation API
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initAdmin } from '../../../firebase/admin';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../../api/auth-helper';
import {
  validateCustomAmount,
  calculateTokensForAmount,
  getTierById,
  CUSTOM_TIER_CONFIG
} from '../../../utils/subscriptionTiers';

// Initialize Firebase Admin and Stripe
const adminApp = initAdmin();
const adminDb = adminApp.firestore();
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-06-20'});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if payments feature is enabled for this user
    const { checkPaymentsFeatureFlag } = await import('../../feature-flag-helper');
    const featureCheckResponse = await checkPaymentsFeatureFlag(userId);
    if (featureCheckResponse) {
      return featureCheckResponse;
    }

    const body = await request.json();
    const { subscriptionId, newTier, newAmount } = body;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    console.log(`[REACTIVATE SUBSCRIPTION] Starting reactivation for user ${userId}, subscription ${subscriptionId}`);

    // Get current subscription data to check status
    const subscriptionRef = adminDb.collection('users').doc(userId).collection('subscription').doc('current');
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      return NextResponse.json({ error: 'No subscription found for this user' }, { status: 404 });
    }

    const subscriptionData = subscriptionDoc.data();
    if (subscriptionData?.stripeSubscriptionId !== subscriptionId) {
      return NextResponse.json({ error: 'Subscription does not belong to this user' }, { status: 403 });
    }

    // Check if subscription is actually set to cancel
    if (!subscriptionData?.cancelAtPeriodEnd) {
      return NextResponse.json({ error: 'Subscription is not set to cancel' }, { status: 400 });
    }

    // Determine if this is a simple reactivation or reactivation with amount change
    const isAmountChange = newTier && newAmount;
    let finalAmount = subscriptionData.amount;
    let finalTokens = subscriptionData.tokens;
    let finalTier = subscriptionData.tier;

    if (isAmountChange) {
      // Validate new tier and amount
      if (newTier === 'tier3') {
        // Champion tier - custom amount starting at $30
        if (newAmount < 30 || newAmount > CUSTOM_TIER_CONFIG.maxAmount) {
          return NextResponse.json({
            error: 'Champion tier amount must be between $30 and $1000'
          }, { status: 400 });
        }
        finalAmount = newAmount;
        finalTokens = calculateTokensForAmount(newAmount);
        finalTier = newTier;
      } else if (newTier === 'custom') {
        // Legacy custom tier support
        const validation = validateCustomAmount(newAmount);
        if (!validation.valid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }
        finalAmount = newAmount;
        finalTokens = calculateTokensForAmount(newAmount);
        finalTier = newTier;
      } else {
        // Standard tiers (tier1, tier2)
        const tierData = getTierById(newTier);
        if (!tierData) {
          return NextResponse.json({ error: 'Invalid tier selected' }, { status: 400 });
        }
        // For standard tiers, use the provided amount (which should match tier data)
        finalAmount = newAmount;
        finalTokens = calculateTokensForAmount(newAmount);
        finalTier = newTier;
      }
    }

    try {
      let subscription;

      if (isAmountChange) {
        // Create new price for the updated amount
        const newPrice = await stripe.prices.create({
          unit_amount: Math.round(finalAmount * 100), // Convert to cents
          currency: 'usd',
          recurring: { interval: 'month' },
          product_data: {
            name: `WeWrite ${finalTier === 'tier3' ? 'Champion' : finalTier === 'custom' ? 'Custom' : getTierById(finalTier)?.name}`
          },
          metadata: {
            tier: finalTier,
            tokens: finalTokens.toString()
          }
        });

        // Update subscription with new price and reactivate
        subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
          items: [
            {
              id: (await stripe.subscriptions.retrieve(subscriptionId)).items.data[0].id,
              price: newPrice.id,
            }
          ],
          proration_behavior: 'create_prorations',
          metadata: {
            firebaseUID: userId,
            tier: finalTier,
            amount: finalAmount.toString(),
            tokens: finalTokens.toString()
          }
        });
      } else {
        // Simple reactivation without amount change
        subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false});
      }

      // Determine token allocation strategy
      const currentAmount = subscriptionData.amount;
      const isUpgrade = finalAmount > currentAmount;
      const isDowngrade = finalAmount < currentAmount;

      // Update subscription status in Firestore
      const updateData: any = {
        status: 'active',
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
        // Remove any cancellation-related fields
        cancelledAt: null,
        cancelReason: null
      };

      if (isAmountChange) {
        updateData.tier = finalTier;
        updateData.amount = finalAmount;
        updateData.tokens = finalTokens;
        if (subscription.items?.data?.[0]?.price?.id) {
          updateData.stripePriceId = subscription.items.data[0].price.id;
        }
      }

      await subscriptionRef.update(updateData);

      // Handle token allocation based on upgrade/downgrade
      if (isUpgrade) {
        // For upgrades, immediately give the user the new token amount
        // This provides instant value for the higher payment
        const tokenDifference = finalTokens - (subscriptionData.tokens || 0);

        // Add the additional tokens to their current balance
        const userRef = adminDb.collection('users').doc(userId);
        await userRef.update({
          monthlyTokenAllocation: finalAmount,
          updatedAt: new Date()
        });

        // Add immediate token bonus for upgrade
        if (tokenDifference > 0) {
          const tokensRef = adminDb.collection('users').doc(userId).collection('tokens').doc('current');
          const tokensDoc = await tokensRef.get();
          const currentTokens = tokensDoc.exists ? (tokensDoc.data()?.available || 0) : 0;

          await tokensRef.set({
            available: currentTokens + tokenDifference,
            total: (tokensDoc.exists ? (tokensDoc.data()?.total || 0) : 0) + tokenDifference,
            updatedAt: new Date()
          }, { merge: true });
        }
      } else if (isDowngrade) {
        // For downgrades, keep current tokens but update future allocation
        // User keeps what they paid for this month, but next month gets fewer tokens
        const userRef = adminDb.collection('users').doc(userId);
        await userRef.update({
          monthlyTokenAllocation: finalAmount,
          updatedAt: new Date()
        });

        // Note: Current tokens remain unchanged - user keeps what they paid for
      } else {
        // Simple reactivation - just update user allocation to match current subscription
        const userRef = adminDb.collection('users').doc(userId);
        await userRef.update({
          monthlyTokenAllocation: finalAmount,
          updatedAt: new Date()
        });
      }

      console.log(`[REACTIVATE SUBSCRIPTION] Successfully reactivated subscription ${subscriptionId} for user ${userId}${isAmountChange ? ` with amount change: $${currentAmount} -> $${finalAmount}` : ''}`);

      return NextResponse.json({
        success: true,
        message: isAmountChange
          ? `Subscription reactivated and updated to $${finalAmount}/month`
          : 'Subscription has been reactivated successfully',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          tier: finalTier,
          amount: finalAmount,
          tokens: finalTokens,
          isUpgrade,
          isDowngrade,
          tokenChange: isAmountChange ? finalTokens - (subscriptionData.tokens || 0) : 0
        }
      });

    } catch (stripeError: any) {
      console.error('[REACTIVATE SUBSCRIPTION] Stripe reactivation failed:', stripeError);
      
      return NextResponse.json({
        success: false,
        error: `Failed to reactivate subscription: ${stripeError.message}`}, { status: 500 });
    }

  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate subscription' },
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