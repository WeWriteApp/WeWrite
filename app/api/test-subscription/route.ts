import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../firebase/admin';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../utils/environmentConfig';
import { TokenService } from '../../services/tokenService';

// Initialize Firebase Admin
const adminApp = initAdmin();
const adminDb = adminApp.firestore();

/**
 * Test endpoint to manually create a subscription record in development
 * This simulates what the Stripe webhook would do
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, amount = 10, tier = 'tier1' } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    console.log(`[TEST SUBSCRIPTION] Creating test subscription for user ${userId}, amount: $${amount}, tier: ${tier}`);

    // Create subscription data (similar to what webhook would create)
    const subscriptionData = {
      id: 'current',
      userId,
      stripeSubscriptionId: `sub_test_${Date.now()}`,
      stripeCustomerId: `cus_test_${Date.now()}`,
      status: 'active',
      amount,
      tier,
      tokens: amount * 10, // 10 tokens per dollar
      currency: 'usd',
      interval: 'month',
      cancelAtPeriodEnd: false,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Use environment-aware path (should use dev_ collections in development)
    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS,
      userId,
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );

    console.log(`[TEST SUBSCRIPTION] Saving to path: ${parentPath}/${subCollectionName}/current`);

    // Create the subscription document using admin SDK
    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
    await subscriptionRef.set(subscriptionData);

    // Update user's token allocation
    await TokenService.updateMonthlyTokenAllocation(userId, amount);

    console.log(`[TEST SUBSCRIPTION] Successfully created test subscription for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Test subscription created successfully',
      subscriptionData,
      path: `${parentPath}/${subCollectionName}/current`
    });

  } catch (error) {
    console.error('[TEST SUBSCRIPTION] Error creating test subscription:', error);
    return NextResponse.json({
      error: 'Failed to create test subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Delete test subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    console.log(`[TEST SUBSCRIPTION] Deleting test subscription for user ${userId}`);

    // Use environment-aware path
    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS, 
      userId, 
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );

    // Delete the subscription document
    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
    await subscriptionRef.set({
      status: 'cancelled',
      canceledAt: new Date().toISOString(),
      updatedAt: new Date()
    });

    // Reset token allocation
    await TokenService.updateMonthlyTokenAllocation(userId, 0);

    console.log(`[TEST SUBSCRIPTION] Successfully deleted test subscription for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Test subscription deleted successfully'
    });

  } catch (error) {
    console.error('[TEST SUBSCRIPTION] Error deleting test subscription:', error);
    return NextResponse.json({
      error: 'Failed to delete test subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
