/**
 * Test Subscription API
 * 
 * Creates fake subscriptions for development testing (dev environment only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../utils/environmentConfig';
import { determineTierFromAmount, calculateTokensForAmount } from '../../utils/subscriptionTiers';
import { TokenService } from '../../services/tokenService';
import { initAdmin } from '../../firebase/admin';

// Initialize Firebase Admin
const admin = initAdmin();
const adminDb = admin.firestore();
import { serverTimestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ 
        error: 'Test subscriptions not allowed in production' 
      }, { status: 403 });
    }

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tier = 'tier1', amount = 10, customUserId } = body;

    const targetUserId = customUserId || userId;
    const finalAmount = amount || 10;
    const finalTier = tier || determineTierFromAmount(finalAmount);
    const tokens = calculateTokensForAmount(finalAmount);

    console.log(`[TEST SUBSCRIPTION] Creating test subscription for user ${targetUserId}, tier: ${finalTier}, amount: $${finalAmount}`);

    // Generate test subscription ID
    const testSubscriptionId = `sub_test_${Date.now()}`;
    const testCustomerId = `cus_test_${Date.now()}`;

    // Create test subscription data
    const subscriptionData = {
      id: 'current',
      userId: targetUserId,
      stripeSubscriptionId: testSubscriptionId,
      stripeCustomerId: testCustomerId,
      stripePriceId: `price_test_${finalTier}`,
      status: 'active',
      tier: finalTier,
      amount: finalAmount,
      tokens,
      currency: 'usd',
      interval: 'month',
      cancelAtPeriodEnd: false,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Save to Firestore
    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS, 
      targetUserId, 
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );
    
    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
    await subscriptionRef.set(subscriptionData);

    // Initialize token balance
    await TokenService.updateMonthlyTokenAllocation(targetUserId, finalAmount);

    console.log(`[TEST SUBSCRIPTION] Successfully created test subscription ${testSubscriptionId} for user ${targetUserId}`);

    return NextResponse.json({
      success: true,
      subscriptionId: testSubscriptionId,
      subscription: subscriptionData,
      warning: 'This is a test subscription and does not exist in Stripe'
    });

  } catch (error) {
    console.error('Error creating test subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create test subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ 
        error: 'Test subscription deletion not allowed in production' 
      }, { status: 403 });
    }

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customUserId } = body;
    const targetUserId = customUserId || userId;

    console.log(`[TEST SUBSCRIPTION] Deleting test subscription for user ${targetUserId}`);

    // Delete subscription from Firestore
    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS, 
      targetUserId, 
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );
    
    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
    await subscriptionRef.delete();

    console.log(`[TEST SUBSCRIPTION] Successfully deleted test subscription for user ${targetUserId}`);

    return NextResponse.json({
      success: true,
      message: 'Test subscription deleted'
    });

  } catch (error) {
    console.error('Error deleting test subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete test subscription' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to create or DELETE to remove test subscription.' },
    { status: 405 }
  );
}
