/**
 * User Earnings API Endpoint
 *
 * UPDATED: Now uses USD-based system instead of tokens
 *
 * Provides a unified view of user earnings including:
 * - Pending USD allocations (current month)
 * - Available USD balance (ready for payout)
 * - Historical earnings in USD
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { logEnhancedFirebaseError, createUserFriendlyErrorMessage } from '../../../utils/firebase-error-handler';
import { ServerUsdService } from '../../../services/usdService.server';
import {
  getLoggedOutUsdBalance,
  getUserUsdBalance
} from '../../../utils/simulatedUsd';

/**
 * Get unfunded earnings for a user from logged-out users and users without subscriptions
 * UPDATED: Now uses USD system instead of tokens
 */
async function getUnfundedEarningsForUser(userId: string) {
  try {
    // Get user's pages to check for allocations
    const userPages = await getUserPageIds(userId);

    // Get unfunded allocations from logged-out users (now in USD)
    const loggedOutBalance = getLoggedOutUsdBalance();
    const loggedOutAllocations = loggedOutBalance.allocations.filter(
      allocation => userPages.includes(allocation.pageId)
    );

    // Calculate totals in USD cents
    const loggedOutUsdCents = loggedOutAllocations.reduce((sum, allocation) => sum + allocation.usdCents, 0);
    const loggedOutUsdValue = loggedOutUsdCents / 100; // Convert cents to dollars

    // TODO: Add logic for users without subscriptions when that data is available
    const noSubscriptionUsdCents = 0;
    const noSubscriptionUsdValue = 0;

    const totalUnfundedUsdCents = loggedOutUsdCents + noSubscriptionUsdCents;
    const totalUnfundedUsdValue = loggedOutUsdValue + noSubscriptionUsdValue;

    // Create message
    const sources = [];
    if (loggedOutUsdCents > 0) sources.push('logged-out users');
    if (noSubscriptionUsdCents > 0) sources.push('users without subscriptions');

    const message = sources.length > 0
      ? `You have ${totalUnfundedTokens} unfunded tokens from ${sources.join(' and ')}. These tokens will become funded when those users sign up and subscribe.`
      : 'No unfunded tokens found.';

    return {
      totalUnfundedTokens,
      totalUnfundedUsdValue,
      loggedOutTokens,
      loggedOutUsdValue,
      noSubscriptionTokens,
      noSubscriptionUsdValue,
      allocations: loggedOutAllocations.map(allocation => ({
        resourceType: 'page',
        resourceId: allocation.pageId,
        resourceTitle: allocation.pageTitle,
        tokens: allocation.tokens,
        usdValue: allocation.tokens * 0.1,
        source: 'logged_out',
        timestamp: allocation.timestamp
      })),
      message
    };
  } catch (error) {
    console.error('Error getting unfunded earnings:', error);
    return {
      totalUnfundedTokens: 0,
      totalUnfundedUsdValue: 0,
      loggedOutTokens: 0,
      loggedOutUsdValue: 0,
      noSubscriptionTokens: 0,
      noSubscriptionUsdValue: 0,
      allocations: [],
      message: 'Error loading unfunded earnings'
    };
  }
}

/**
 * Get page IDs owned by a user
 */
async function getUserPageIds(userId: string): Promise<string[]> {
  try {
    const admin = await import('../../../firebase/firebaseAdmin');
    const { getCollectionName } = await import('../../../utils/environmentConfig');

    const firebaseAdmin = admin.getFirebaseAdmin();
    const db = firebaseAdmin.firestore();

    // Query for user's pages (simplified to avoid index requirement)
    const pagesQuery = db.collection(getCollectionName('pages'))
      .where('userId', '==', userId)
      .select(); // Only get document IDs for efficiency

    const snapshot = await pagesQuery.get();

    // Filter out deleted pages in memory instead of in the query
    const pageIds: string[] = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.deleted) {
        pageIds.push(doc.id);
      }
    });

    return pageIds;
  } catch (error) {
    console.error('Error getting user page IDs:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get USD earnings data (new system)
    const usdBalance = await ServerUsdService.getWriterUsdBalance(userId);
    const usdAllocations = await ServerUsdService.getAllocationsToUser(userId);

    // Get unfunded USD allocations
    const unfundedEarnings = await getUnfundedEarningsForUser(userId);

    // Calculate totals from USD system
    const pendingBalance = usdAllocations.totalUsdValue || 0;
    const availableBalance = usdBalance?.availableUsdValue || 0;
    const totalEarnings = (usdBalance?.totalUsdEarned || 0) + pendingBalance;

    const earnings = {
      totalEarnings,
      availableBalance,
      pendingBalance,
      hasEarnings: totalEarnings > 0 || availableBalance > 0 || pendingBalance > 0 || unfundedEarnings.totalUnfundedUsdValue > 0,
      pendingAllocations: usdAllocations.allocations || [],
      unfundedEarnings
    };

    return NextResponse.json({
      success: true,
      data: earnings
    });

  } catch (error) {
    // Use enhanced error handling for better debugging
    logEnhancedFirebaseError(error, 'earnings/user API endpoint');

    // Handle permission errors gracefully - return empty data instead of failing
    if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
      // Permission denied for non-writers - this is expected
      return NextResponse.json({
        success: true,
        data: {
          balance: null,
          earnings: [],
          payouts: []
        }
      });
    }

    const userFriendlyMessage = createUserFriendlyErrorMessage(error, 'earnings data');

    return NextResponse.json({
      error: userFriendlyMessage
    }, { status: 500 });
  }
}
