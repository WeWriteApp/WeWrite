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

// 🚨 CRITICAL COST OPTIMIZATION: Aggressive caching for earnings data
const earningsCache = new Map<string, { data: any; timestamp: number }>();
const EARNINGS_CACHE_TTL = 15 * 60 * 1000; // 🚨 EMERGENCY: 15 minutes cache to stop read spike

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
      ? `You have $${totalUnfundedUsdValue.toFixed(2)} unfunded earnings from ${sources.join(' and ')}. These will become funded when those users sign up and subscribe.`
      : 'No unfunded earnings found.';

    return {
      totalUnfundedUsdCents,
      totalUnfundedUsdValue,
      loggedOutUsdCents,
      loggedOutUsdValue,
      noSubscriptionUsdCents,
      noSubscriptionUsdValue,
      allocations: loggedOutAllocations.map(allocation => ({
        resourceType: 'page',
        resourceId: allocation.pageId,
        resourceTitle: allocation.pageTitle,
        usdCents: allocation.usdCents,
        usdValue: allocation.usdCents / 100,
        source: 'logged_out',
        timestamp: allocation.timestamp
      })),
      message
    };
  } catch (error) {
    console.error('Error getting unfunded earnings:', error);
    return {
      totalUnfundedUsdCents: 0,
      totalUnfundedUsdValue: 0,
      loggedOutUsdCents: 0,
      loggedOutUsdValue: 0,
      noSubscriptionUsdCents: 0,
      noSubscriptionUsdValue: 0,
      allocations: [],
      message: 'Error loading unfunded earnings'
    };
  }
}

/**
 * Get incoming USD allocations for a user (their earnings)
 */
async function getIncomingAllocationsForUser(userId: string) {
  try {
    const admin = await import('../../../firebase/firebaseAdmin');
    const { getCollectionName, USD_COLLECTIONS } = await import('../../../utils/environmentConfig');
    const { getCurrentMonth } = await import('../../../utils/usdConstants');
    const { centsToDollars } = await import('../../../utils/formatCurrency');

    const firebaseAdmin = admin.getFirebaseAdmin();
    const db = firebaseAdmin.firestore();
    const currentMonth = getCurrentMonth();

    // Get all allocations where this user is the recipient
    const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
    const allocationsQuery = allocationsRef
      .where('recipientUserId', '==', userId)
      .where('month', '==', currentMonth)
      .where('status', '==', 'active');

    const snapshot = await allocationsQuery.get();

    let totalUsdCents = 0;
    const allocations = [];

    snapshot.forEach(doc => {
      const allocation = doc.data();
      totalUsdCents += allocation.usdCents || 0;

      allocations.push({
        id: doc.id,
        resourceType: allocation.resourceType,
        resourceId: allocation.resourceId,
        usdCents: allocation.usdCents,
        usdValue: centsToDollars(allocation.usdCents),
        fromUserId: allocation.userId,
        month: allocation.month,
        createdAt: allocation.createdAt
      });
    });

    return {
      totalUsdCents,
      totalUsdValue: centsToDollars(totalUsdCents),
      allocations
    };
  } catch (error) {
    console.error('Error getting incoming allocations:', error);
    return {
      totalUsdCents: 0,
      totalUsdValue: 0,
      allocations: []
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

    // 🚨 CRITICAL: Check cache first to prevent massive read costs
    const cacheKey = `earnings:${userId}`;
    const cached = earningsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < EARNINGS_CACHE_TTL) {
      console.log(`🚀 COST OPTIMIZATION: Returning cached earnings for ${userId}`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
    }

    // Get USD earnings data (new system) - USE THE PROCESSED BALANCE DATA
    const usdBalance = await ServerUsdService.getUserUsdBalance(userId);

    // Get incoming allocations (earnings) to this user - for detailed breakdown only
    const incomingAllocations = await getIncomingAllocationsForUser(userId);

    // Get unfunded USD allocations
    const unfundedEarnings = await getUnfundedEarningsForUser(userId);

    // CRITICAL FIX: Use the processed balance data instead of raw allocations
    let pendingBalance = 0;
    let availableBalance = 0;
    let totalEarnings = 0;

    if (usdBalance) {
      // Use the processed earnings balance (this includes our fixed data)
      totalEarnings = (usdBalance.totalUsdCentsEarned || 0) / 100; // Convert cents to dollars
      pendingBalance = (usdBalance.pendingUsdCents || 0) / 100; // Convert cents to dollars
      availableBalance = (usdBalance.availableUsdCents || 0) / 100; // Convert cents to dollars
    } else {
      // Fallback to raw allocations only if no balance record exists
      pendingBalance = incomingAllocations.totalUsdValue || 0;
      availableBalance = 0;
      totalEarnings = pendingBalance;
    }

    const earnings = {
      totalEarnings,
      availableBalance,
      pendingBalance,
      hasEarnings: totalEarnings > 0 || availableBalance > 0 || pendingBalance > 0 || unfundedEarnings.totalUnfundedUsdValue > 0,
      pendingAllocations: incomingAllocations.allocations || [],
      unfundedEarnings
    };

    const responseData = {
      success: true,
      earnings: earnings, // Frontend expects 'earnings' field, not 'data'
      data: earnings // Keep both for backward compatibility
    };

    // 🚨 CRITICAL: Cache the response to prevent future reads
    earningsCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    // Clean cache periodically
    if (Math.random() < 0.01) {
      const now = Date.now();
      for (const [key, value] of earningsCache.entries()) {
        if (now - value.timestamp > EARNINGS_CACHE_TTL * 2) {
          earningsCache.delete(key);
        }
      }
    }

    return NextResponse.json(responseData);

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
