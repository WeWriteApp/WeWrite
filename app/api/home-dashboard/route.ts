import { NextRequest, NextResponse } from 'next/server';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { rtdb } from '../../firebase/rtdb';
import { ref, get } from 'firebase/database';
import { executeDeduplicatedOperation } from '../../utils/serverRequestDeduplication';

// Server-side cache for dashboard data
const dashboardCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const DASHBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes server-side cache

interface DashboardData {
  recentPages: any[];
  trendingPages: any[];
  userStats?: any;
  batchUserData?: Record<string, any>; // Include user subscription data
  timestamp: number;
  loadTime: number;
}



/**
 * Optimized home dashboard endpoint that fetches all data in a single request
 * Uses batch queries, server-side caching, and consolidated operations for maximum performance
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Check server-side cache first
    const cacheKey = `dashboard:${userId || 'anonymous'}`;
    const cached = dashboardCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log('Home dashboard: Returning cached data');
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
    }

    console.log('Home dashboard: Fetching fresh data');
    
    // Fetch all data in a single batched operation with deduplication
    const [
      allRecentPages,
      userStats
    ] = await Promise.all([
      executeDeduplicatedOperation(
        'getRecentPages',
        { limit: 40, userId },
        () => getRecentPagesOptimized(40, userId),
        { cacheTTL: 2 * 60 * 1000 } // 2 minutes cache for recent pages
      ),
      userId ? executeDeduplicatedOperation(
        'getUserStats',
        { userId },
        () => getUserStatsOptimized(userId),
        { cacheTTL: 5 * 60 * 1000 } // 5 minutes cache for user stats
      ) : Promise.resolve(null)
    ]);

    // Derive trending pages from recent pages to avoid duplicate queries
    const recentPages = allRecentPages.slice(0, 20);
    const trendingPages = allRecentPages
      .filter(page => {
        const lastModified = new Date(page.lastModified);
        const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceModified <= 7; // Only pages modified in last 7 days
      })
      .slice(0, 5);

    // Batch fetch user subscription data with deduplication
    const uniqueUserIds = [...new Set(recentPages.map(page => page.userId).filter(Boolean))];
    let batchUserData = {};

    if (uniqueUserIds.length > 0) {
      try {
        batchUserData = await executeDeduplicatedOperation(
          'getBatchUserData',
          { userIds: uniqueUserIds.sort() }, // Sort for consistent cache keys
          () => getBatchUserDataOptimized(uniqueUserIds),
          { cacheTTL: 3 * 60 * 1000 } // 3 minutes cache for user data
        );
      } catch (error) {
        console.warn('Error fetching batch user data:', error);
        // Continue without user data rather than failing the entire request
      }
    }
    
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    const dashboardData: DashboardData = {
      recentPages,
      trendingPages,
      userStats,
      batchUserData,
      timestamp: Date.now(),
      loadTime
    };

    // Cache the result for future requests
    dashboardCache.set(cacheKey, {
      data: dashboardData,
      timestamp: Date.now(),
      ttl: DASHBOARD_CACHE_TTL
    });

    // Clean up old cache entries periodically
    if (Math.random() < 0.1) { // 10% chance to clean up
      const now = Date.now();
      for (const [key, value] of dashboardCache.entries()) {
        if (now - value.timestamp > value.ttl) {
          dashboardCache.delete(key);
        }
      }
    }

    console.log(`Home dashboard: Data fetched in ${loadTime.toFixed(2)}ms (${recentPages.length} recent, ${trendingPages.length} trending)`);

    return NextResponse.json(dashboardData);
    
  } catch (error) {
    console.error('Error fetching home dashboard data:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get recent pages with optimized queries and user data
 */
async function getRecentPagesOptimized(limitCount: number, userId?: string | null): Promise<any[]> {
  try {
    // Define dashboard page fields to reduce document size by 60-70%
    const dashboardPageFields = [
      'title', 'isPublic', 'userId', 'username', 'displayName',
      'lastModified', 'createdAt', 'totalPledged', 'pledgeCount', 'deleted'
    ];

    let pagesQuery;

    if (userId) {
      // For logged-in users, get recent pages and filter deleted ones in code
      // This avoids the composite index requirement
      pagesQuery = query(
        collection(db, 'pages'),
        orderBy('lastModified', 'desc'),
        limit(limitCount * 3) // Get more to account for filtering deleted pages
      );
    } else {
      // For anonymous users, only public pages
      pagesQuery = query(
        collection(db, 'pages'),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        limit(limitCount * 2) // Get more to account for filtering deleted pages
      );
    }

    const snapshot = await getDocs(pagesQuery);
    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter out deleted pages in application code to avoid composite index requirement
    const filteredPages = pages
      .filter(page => page.deleted !== true) // Filter deleted pages in code
      .filter(page => {
        if (!userId) return page.isPublic;
        return page.isPublic || page.userId === userId;
      })
      .slice(0, limitCount);

    // Return pages without subscription data - client will fetch this using getBatchUserData
    const pagesWithCompleteInfo = filteredPages;

    return pagesWithCompleteInfo;

  } catch (error) {
    console.error('Error fetching recent pages:', error);
    return [];
  }
}

/**
 * Groups functionality removed
 */

/**
 * Trending pages logic is now consolidated into the main dashboard function
 * to avoid duplicate queries and reduce Firebase reads
 */

/**
 * Get user statistics (server-side version)
 */
async function getUserStatsOptimized(userId: string): Promise<any> {
  try {
    // Fetch user data directly from RTDB (server-safe)
    const userSnapshot = await get(ref(rtdb, `users/${userId}`));
    const userData = userSnapshot.exists() ? userSnapshot.val() : {};

    return {
      userId,
      pageCount: userData.pageCount || 0,
      totalViews: userData.totalViews || 0,
      followerCount: userData.followerCount || 0,
      lastActive: userData.lastActive,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return null;
  }
}

/**
 * Batch fetch user subscription data (server-side optimized version)
 */
async function getBatchUserDataOptimized(userIds: string[]): Promise<Record<string, any>> {
  try {
    if (!userIds || userIds.length === 0) {
      return {};
    }

    const results: Record<string, any> = {};
    const batchSize = 10; // Process in batches to avoid overwhelming the database

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      // Fetch user data from RTDB in parallel
      const userPromises = batch.map(async (userId) => {
        try {
          const userSnapshot = await get(ref(rtdb, `users/${userId}`));

          if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            return {
              userId,
              data: {
                uid: userId,
                username: userData.username || userData.displayName ||
                         (userData.email ? userData.email.split('@')[0] : undefined),
                displayName: userData.displayName,
                tier: userData.tier || 0,
                subscriptionStatus: userData.subscriptionStatus || 'inactive',
                subscriptionAmount: userData.subscriptionAmount || 0,
                pageCount: userData.pageCount || 0,
                followerCount: userData.followerCount || 0
              }
            };
          }

          return { userId, data: null };
        } catch (error) {
          console.warn(`Error fetching user ${userId}:`, error);
          return { userId, data: null };
        }
      });

      const batchResults = await Promise.all(userPromises);

      batchResults.forEach(({ userId, data }) => {
        if (data) {
          results[userId] = data;
        }
      });
    }

    return results;
  } catch (error) {
    console.error('Error fetching batch user data:', error);
    return {};
  }
}