/**
 * Subscription Update API
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initAdmin } from '../../../firebase/admin';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../../api/auth-helper';
import { checkPaymentsFeatureFlag } from '../../feature-flag-helper';
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
    // Get authenticated user first
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if payments feature is enabled for this user
    const featureCheckResponse = await checkPaymentsFeatureFlag(userId);
    if (featureCheckResponse) {
      return featureCheckResponse;
    }

    const body = await request.json();
    const { subscriptionId, newTier, newAmount, skipValidation } = body;

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

      // Skip minimum validation if skipValidation flag is set (for amount additions like +$10)
      if (!skipValidation) {
        const validation = validateCustomAmount(newAmount);
        if (!validation.valid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }
      } else {
        // For skipValidation, only check maximum
        if (newAmount > CUSTOM_TIER_CONFIG.maxAmount) {
          return NextResponse.json({
            error: `Amount cannot exceed $${CUSTOM_TIER_CONFIG.maxAmount}`
          }, { status: 400 });
        }
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
    
    // Create new price
    const newPrice = await stripe.prices.create({
      unit_amount: Math.round(finalAmount * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval: 'month'},
      product_data: {
        name: `WeWrite ${newTier === 'custom' ? 'Custom' : getTierById(newTier)?.name}`},
      metadata: {
        tier: newTier,
        tokens: finalTokens.toString()}});

    // Update subscription with new price
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: currentSubscription.items.data[0].id,
          price: newPrice.id},
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        firebaseUID: userId,
        tier: newTier,
        amount: finalAmount.toString(),
        tokens: finalTokens.toString()}});

    // Update subscription in Firestore
    const subscriptionRef = adminDb.collection('users').doc(userId).collection('subscription').doc('current');
    await subscriptionRef.update({
      stripePriceId: newPrice.id,
      tier: newTier,
      amount: finalAmount,
      tokens: finalTokens,
      updatedAt: new Date()});

    // Update user's monthly token allocation
    const userRef = adminDb.collection('users').doc(userId);
    await userRef.update({
      monthlyTokenAllocation: finalAmount, // $1 = 1 token allocation
      updatedAt: new Date()});

    console.log(`Subscription updated for user ${userId}: ${newTier} - $${finalAmount}/mo - ${finalTokens} tokens`);

    return NextResponse.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: {
        tier: newTier,
        amount: finalAmount,
        tokens: finalTokens,
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        previousAmount: currentSubscription.items.data[0].price.unit_amount / 100, // Previous amount for comparison
      }});

  } catch (error: any) {
    console.error('Error updating subscription:', error);

    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return NextResponse.json({
        error: 'Payment method error: ' + error.message
      }, { status: 402 });
    } else if (error.type === 'StripeInvalidRequestError') {
      // Check for specific customer-related errors
      if (error.message.includes('No such customer') || error.message.includes('customer')) {
        return NextResponse.json({
          error: 'Customer account error. Please try creating a new subscription.',
          code: 'INVALID_CUSTOMER'
        }, { status: 400 });
      }
      return NextResponse.json({
        error: 'Invalid request: ' + error.message
      }, { status: 400 });
    } else if (error.type === 'StripePermissionError') {
      return NextResponse.json({
        error: 'Permission denied: ' + error.message
      }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update subscription' },
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