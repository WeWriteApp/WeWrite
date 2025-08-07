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
import { earningsCalculationEngine } from '../../../services/earningsCalculationEngine';
import { earningsHistoryService } from '../../../services/earningsHistoryService';
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
    const { getFirebaseAdmin } = await import('../../../firebase/firebaseAdmin');
    const { getCollectionName, USD_COLLECTIONS } = await import('../../../utils/environmentConfig');
    const { getCurrentMonth } = await import('../../../utils/usdConstants');
    const { centsToDollars } = await import('../../../utils/formatCurrency');

    const firebaseAdmin = getFirebaseAdmin();
    if (!firebaseAdmin) {
      console.warn('[EARNINGS] Firebase Admin not available in getIncomingAllocationsForUser');
      return {
        totalUsdCents: 0,
        totalUsdValue: 0,
        allocations: []
      };
    }
    const db = firebaseAdmin.firestore();
    const currentMonth = getCurrentMonth();

    console.log(`[EARNINGS] Getting incoming allocations for user ${userId.substring(0, 8)}... in ${currentMonth}`);

    // Get all allocations where this user is the recipient
    const allocationsCollectionName = getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS);
    console.log(`[EARNINGS] Querying collection: ${allocationsCollectionName}`);

    const allocationsRef = db.collection(allocationsCollectionName);
    const allocationsQuery = allocationsRef
      .where('recipientUserId', '==', userId)
      .where('month', '==', currentMonth)
      .where('status', '==', 'active');

    const snapshot = await allocationsQuery.get();
    console.log(`[EARNINGS] Found ${snapshot.size} allocations for user ${userId.substring(0, 8)}... in ${currentMonth}`);

    let totalUsdCents = 0;
    const allocations = [];

    // Process allocations and enrich with page titles and usernames
    const allocationPromises = snapshot.docs.map(async (doc) => {
      const allocation = doc.data();
      const usdCents = allocation.usdCents || 0;
      totalUsdCents += usdCents;

      // Get page title if it's a page allocation
      let pageTitle = 'Unknown Resource';
      if (allocation.resourceType === 'page') {
        try {
          const pageDoc = await db.collection(getCollectionName('pages')).doc(allocation.resourceId).get();
          if (pageDoc.exists) {
            const pageData = pageDoc.data();
            pageTitle = pageData?.title || 'Untitled Page';
          }
        } catch (error) {
          console.warn(`[EARNINGS] Error fetching page title for ${allocation.resourceId}:`, error);
        }
      } else if (allocation.resourceType === 'user') {
        pageTitle = 'User Support';
      }

      // Get username of the person who made the allocation
      let fromUsername = 'Anonymous';
      try {
        const userDoc = await db.collection(getCollectionName('users')).doc(allocation.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          fromUsername = userData?.username || userData?.displayName || 'Anonymous';
        }
      } catch (error) {
        console.warn(`[EARNINGS] Error fetching username for ${allocation.userId}:`, error);
      }

      return {
        id: doc.id,
        resourceType: allocation.resourceType,
        resourceId: allocation.resourceId,
        pageTitle,
        resourceTitle: pageTitle, // Alias for compatibility
        usdCents,
        usdValue: centsToDollars(usdCents),
        fromUserId: allocation.userId,
        fromUsername,
        username: fromUsername, // Alias for compatibility
        month: allocation.month,
        createdAt: allocation.createdAt
      };
    });

    const enrichedAllocations = await Promise.all(allocationPromises);

    console.log(`[EARNINGS] Total incoming allocations: ${centsToDollars(totalUsdCents)} USD (${totalUsdCents} cents)`);
    console.log(`[EARNINGS] Enriched ${enrichedAllocations.length} allocations with page titles and usernames`);

    return {
      totalUsdCents,
      totalUsdValue: centsToDollars(totalUsdCents),
      allocations: enrichedAllocations
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
    // Add version to cache key to bust cache after earnings fix
    const cacheKey = `earnings:${userId}:v2025080602`;
    const cached = earningsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < EARNINGS_CACHE_TTL) {
      console.log(`🚀 COST OPTIMIZATION: Returning cached earnings for ${userId}`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
    }

    console.log(`[EARNINGS API] Starting earnings calculation for user ${userId.substring(0, 8)}...`);

    // SIMPLIFIED APPROACH: Get current month allocations as primary source of truth
    const incomingAllocations = await getIncomingAllocationsForUser(userId);
    console.log(`[EARNINGS API] Incoming allocations result:`, {
      totalUsdValue: incomingAllocations.totalUsdValue,
      totalUsdCents: incomingAllocations.totalUsdCents,
      allocationsCount: incomingAllocations.allocations.length
    });

    // Get processed balance data for historical earnings
    let usdBalance = null;
    try {
      usdBalance = await ServerUsdService.getUserUsdBalance(userId);
      console.log(`[EARNINGS API] USD balance result:`, {
        hasBalance: !!usdBalance,
        totalEarned: usdBalance?.totalUsdCentsEarned || 0,
        available: usdBalance?.availableUsdCents || 0
      });
    } catch (error) {
      console.warn(`[EARNINGS API] Failed to get USD balance for user ${userId.substring(0, 8)}...:`, error.message);
    }

    // Get unfunded earnings (from logged-out users)
    let unfundedEarnings = null;
    try {
      unfundedEarnings = await getUnfundedEarningsForUser(userId);
      console.log(`[EARNINGS API] Unfunded earnings:`, {
        totalUnfunded: unfundedEarnings?.totalUnfundedUsdValue || 0
      });
    } catch (error) {
      console.warn(`[EARNINGS API] Failed to get unfunded earnings:`, error.message);
      unfundedEarnings = { totalUnfundedUsdValue: 0, totalUnfundedUsdCents: 0 };
    }

    // NEW: Try to get earnings from the new earnings calculation engine
    let newSystemEarnings = null;
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const userEarnings = await earningsCalculationEngine.getUserEarnings(userId, currentMonth);
      const userHistory = await earningsHistoryService.getUserEarningsHistory(userId);

      if (userEarnings || userHistory) {
        newSystemEarnings = {
          currentMonth: userEarnings,
          history: userHistory
        };
        console.log(`[EARNINGS API] New system earnings found for user ${userId.substring(0, 8)}...`);
      }
    } catch (error) {
      console.warn(`[EARNINGS API] New earnings system not available yet:`, error.message);
    }

    // CALCULATION: Use new system if available, fallback to current system
    let pendingBalance, availableBalance, totalEarnings;

    if (newSystemEarnings?.currentMonth) {
      // Use new earnings calculation engine
      pendingBalance = newSystemEarnings.currentMonth.netEarnings || 0;
      availableBalance = newSystemEarnings.history?.outstandingEarnings || 0;
      totalEarnings = newSystemEarnings.history?.totalLifetimeEarnings || pendingBalance;
      console.log(`[EARNINGS API] Using NEW earnings system data`);
    } else {
      // Fallback to current system
      pendingBalance = incomingAllocations.totalUsdValue || 0; // Current month allocations
      availableBalance = usdBalance ? (usdBalance.availableUsdCents || 0) / 100 : 0; // Available for payout
      totalEarnings = usdBalance ? (usdBalance.totalUsdCentsEarned || 0) / 100 : pendingBalance; // Lifetime total
      console.log(`[EARNINGS API] Using LEGACY earnings system data`);
    }

    console.log(`[EARNINGS API] Final earnings calculation for user ${userId.substring(0, 8)}...:`, {
      pendingBalance: `$${pendingBalance.toFixed(2)} (from ${incomingAllocations.allocations.length} current allocations)`,
      availableBalance: `$${availableBalance.toFixed(2)} (from balance record)`,
      totalEarnings: `$${totalEarnings.toFixed(2)} (lifetime)`,
      unfundedEarnings: `$${(unfundedEarnings?.totalUnfundedUsdValue || 0).toFixed(2)}`
    });

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
