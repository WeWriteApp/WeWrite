import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { db } from '../../../firebase/database/core';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getCollectionName, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { calculateTokensForAmount } from '../../../utils/subscriptionTiers';

/**
 * Initialize Token Balance for New Subscription
 * 
 * This endpoint creates the initial token balance for a newly created subscription,
 * ensuring the user has their monthly token allocation available immediately.
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

    const { userId, subscriptionId } = await request.json();

    // Validate required fields
    if (!userId || !subscriptionId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, subscriptionId' },
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

    // Get subscription details to determine token allocation
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const subscription = userData.subscription;

    if (!subscription || subscription.id !== subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription not found or mismatch' },
        { status: 404 }
      );
    }

    // Calculate monthly token allocation
    const monthlyTokens = subscription.tokens || calculateTokensForAmount(subscription.amount);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Check if balance already exists
    const balanceRef = doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES), userId);
    const existingBalance = await getDoc(balanceRef);

    if (existingBalance.exists()) {
      // Update existing balance with new subscription
      const currentBalance = existingBalance.data();
      const updatedBalance = {
        ...currentBalance,
        totalTokens: monthlyTokens,
        availableTokens: monthlyTokens - (currentBalance.allocatedTokens || 0),
        subscriptionId,
        subscriptionTier: subscription.tier,
        subscriptionAmount: subscription.amount,
        lastUpdated: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(balanceRef, updatedBalance, { merge: true });

      console.log('✅ Token balance updated for existing user:', {
        userId,
        subscriptionId,
        monthlyTokens,
        previousAllocated: currentBalance.allocatedTokens || 0
      });

      return NextResponse.json({
        success: true,
        balance: {
          totalTokens: monthlyTokens,
          allocatedTokens: currentBalance.allocatedTokens || 0,
          availableTokens: monthlyTokens - (currentBalance.allocatedTokens || 0),
          subscriptionId,
          month: currentMonth
        },
        message: 'Token balance updated successfully'
      });
    } else {
      // Create new token balance
      const newBalance = {
        userId,
        totalTokens: monthlyTokens,
        allocatedTokens: 0,
        availableTokens: monthlyTokens,
        subscriptionId,
        subscriptionTier: subscription.tier,
        subscriptionAmount: subscription.amount,
        month: currentMonth,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(balanceRef, newBalance);

      console.log('✅ Token balance initialized for new user:', {
        userId,
        subscriptionId,
        monthlyTokens
      });

      return NextResponse.json({
        success: true,
        balance: {
          totalTokens: monthlyTokens,
          allocatedTokens: 0,
          availableTokens: monthlyTokens,
          subscriptionId,
          month: currentMonth
        },
        message: 'Token balance initialized successfully'
      });
    }

  } catch (error) {
    console.error('Error initializing token balance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
