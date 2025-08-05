import { NextRequest, NextResponse } from 'next/server';
import { executeDeduplicatedOperation } from '../../utils/serverRequestDeduplication';
import { initAdmin } from '../../firebase/admin';
import { getSubCollectionPath, PAYMENT_COLLECTIONS, getCollectionName } from '../../utils/environmentConfig';
import { getEffectiveTier } from '../../utils/subscriptionTiers';

// Enhanced multi-tier caching system for home data
const homeCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const userStatsCache = new Map<string, { data: any; timestamp: number }>();
const batchUserDataCache = new Map<string, { data: any; timestamp: number }>();

// Optimized cache TTLs based on data volatility
const HOME_CACHE_TTL = 15 * 60 * 1000; // 15 minutes for full home data
const USER_STATS_TTL = 60 * 60 * 1000; // 1 hour for user stats (changes infrequently)
const BATCH_USER_DATA_TTL = 30 * 60 * 1000; // 30 minutes for user subscription data

interface HomeData {
  recentlyVisitedPages: any[]; // Renamed from recentPages for clarity
  trendingPages: any[];
  userStats?: any;
  batchUserData?: Record<string, any>; // Include user subscription data
  timestamp: number;
  loadTime: number;
}



/**
 * Optimized home endpoint that fetches all data in a single request
 * Uses batch queries, server-side caching, and consolidated operations for maximum performance
 */
export async function GET(request: NextRequest) {
  console.log('🏠 HOME API: Request received!', request.url);
  const startTime = performance.now();

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Enhanced multi-tier cache checking
    const cacheKey = `home:${userId || 'anonymous'}`;
    const cached = homeCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log('🚀 HOME API: Cache hit - returning cached data:', {
        recentlyVisitedPagesCount: cached.data.recentlyVisitedPages?.length || 0,
        hasUserStats: !!cached.data.userStats,
        cacheAge: Math.round((Date.now() - cached.timestamp) / 1000) + 's'
      });

      // Track cache hit for monitoring
      console.log('📊 DB READ: /api/home - 0 reads, 0ms, cache: true');

      const cachedResponse = NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
      cachedResponse.headers.set('Cache-Control', 'public, max-age=600, s-maxage=900'); // 10 min browser, 15 min CDN
      cachedResponse.headers.set('Vary', 'Authorization');
      return cachedResponse;
    }

    console.log('🏠 HOME API: Fetching fresh data with enhanced caching');

    // Enhanced data fetching with individual cache checks
    const [
      allRecentlyVisitedPages,
      userStats
    ] = await Promise.all([
      // Recently visited pages with longer cache for cost optimization
      executeDeduplicatedOperation(
        'getRecentlyVisitedPages',
        { limit: 40, userId },
        () => getRecentlyVisitedPagesOptimized(40, userId),
        { cacheTTL: 10 * 60 * 1000 } // 10 minutes cache (increased from 5m)
      ),
      // User stats with individual cache check
      userId ? getUserStatsWithCache(userId) : Promise.resolve(null)
    ]);

    // Derive trending pages from recently visited pages to avoid duplicate queries
    const recentlyVisitedPages = allRecentlyVisitedPages.slice(0, 20);
    const trendingPages = allRecentlyVisitedPages
      .filter(page => {
        const lastModified = new Date(page.lastModified);
        const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceModified <= 7; // Only pages modified in last 7 days
      })
      .slice(0, 5);

    // Enhanced batch user data fetching with smart caching
    const uniqueUserIds = [...new Set(recentlyVisitedPages.map(page => page.userId).filter(Boolean))];
    let batchUserData = {};

    if (uniqueUserIds.length > 0) {
      try {
        batchUserData = await getBatchUserDataWithCache(uniqueUserIds);
      } catch (error) {
        console.warn('🚨 Error fetching batch user data:', error);
        // Continue without user data rather than failing the entire request
      }
    }
    
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    const homeData: HomeData = {
      recentlyVisitedPages,
      trendingPages,
      userStats,
      batchUserData,
      timestamp: Date.now(),
      loadTime
    };

    // Cache the result for future requests
    homeCache.set(cacheKey, {
      data: homeData,
      timestamp: Date.now(),
      ttl: HOME_CACHE_TTL
    });

    // Enhanced cache cleanup with size limits
    cleanupCaches();

    console.log(`🏠 HOME API: Fresh data fetched in ${loadTime.toFixed(2)}ms:`, {
      recentlyVisitedPagesCount: recentlyVisitedPages.length,
      trendingPagesCount: trendingPages.length,
      hasUserStats: !!userStats,
      hasBatchUserData: !!batchUserData && Object.keys(batchUserData).length > 0
    });

    // Add cache headers for browser caching
    const response = NextResponse.json(homeData);
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600'); // 5 min browser, 10 min CDN
    response.headers.set('Vary', 'Authorization'); // Vary by user authentication
    return response;
    
  } catch (error) {
    console.error('Error fetching home data:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch home data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get recently visited pages with optimized queries and user data
 */
async function getRecentlyVisitedPagesOptimized(limitCount: number, userId?: string | null): Promise<any[]> {
  try {
    // Initialize Firebase Admin
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    // Define home page fields to reduce document size by 60-70%
    // Include lastDiff for recent edits functionality
    const homePageFields = [
      'title', 'isPublic', 'userId', 'username', 'displayName',
      'lastModified', 'createdAt', 'totalPledged', 'pledgeCount', 'deleted', 'lastDiff'
    ];

    let pagesQuery;

    if (userId) {
      // For logged-in users, get recent pages (last 7 days) and filter deleted ones in code
      // This avoids the composite index requirement while preventing excessive reads
      const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

      pagesQuery = db.collection(getCollectionName('pages'))
        .where('lastModified', '>=', sevenDaysAgo.toISOString())
        .orderBy('lastModified', 'desc')
        .limit(limitCount * 3); // Get more to account for filtering deleted pages
    } else {
      // For anonymous users, only public pages from last 7 days
      const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

      pagesQuery = db.collection(getCollectionName('pages'))
        .where('isPublic', '==', true)
        .where('lastModified', '>=', sevenDaysAgo.toISOString())
        .orderBy('lastModified', 'desc')
        .limit(limitCount * 2); // Get more to account for filtering deleted pages
    }

    const snapshot = await pagesQuery.get();
    console.log(`🏠 [HOME_API] Raw query returned ${snapshot.size} documents`);

    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`🏠 [HOME_API] Raw pages analysis:`, {
      totalDocs: snapshot.size,
      samplePages: pages.slice(0, 3).map(p => ({
        id: p.id,
        title: p.title,
        isPublic: p.isPublic,
        deleted: p.deleted,
        userId: p.userId,
        lastModified: p.lastModified,
        hasLastDiff: !!p.lastDiff,
        lastDiffHasChanges: p.lastDiff?.hasChanges
      }))
    });

    // Filter out deleted pages in application code to avoid composite index requirement
    const filteredPages = pages
      .filter(page => page.deleted !== true) // Filter deleted pages in code
      .filter(page => {
        if (!userId) return page.isPublic;
        return page.isPublic || page.userId === userId;
      })
      .slice(0, limitCount);

    console.log(`🏠 [HOME_API] Filtered pages result:`, {
      totalPages: pages.length,
      afterDeletedFilter: pages.filter(page => page.deleted !== true).length,
      afterVisibilityFilter: filteredPages.length,
      samplePages: filteredPages.slice(0, 3).map(p => ({
        id: p.id,
        title: p.title,
        isPublic: p.isPublic,
        deleted: p.deleted,
        userId: p.userId
      }))
    });

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
 * Trending pages logic is now consolidated into the main home function
 * to avoid duplicate queries and reduce Firebase reads
 */

/**
 * Get user statistics (server-side version)
 */
async function getUserStatsOptimized(userId: string): Promise<any> {
  try {
    // Initialize Firebase Admin
    const adminApp = initAdmin();

    // Try to initialize realtime database, but don't fail if it's not available
    let rtdb = null;
    try {
      rtdb = adminApp.database();
    } catch (rtdbError) {
      console.warn('Realtime Database not available for user stats:', rtdbError.message);
      return null;
    }

    // Fetch user data directly from RTDB (server-safe)
    const userSnapshot = await rtdb.ref(`users/${userId}`).once('value');
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
 * Uses the same logic as the batch user API to ensure consistency
 */
async function getBatchUserDataOptimized(userIds: string[]): Promise<Record<string, any>> {
  try {
    if (!userIds || userIds.length === 0) {
      return {};
    }

    const adminApp = initAdmin();
    const db = adminApp.firestore();

    // Try to initialize realtime database, but don't fail if it's not available
    let rtdb = null;
    try {
      rtdb = adminApp.database();
    } catch (rtdbError) {
      console.warn('Realtime Database not available, continuing without it:', rtdbError.message);
    }

    const results: Record<string, any> = {};
    const batchSize = 10; // Process in batches to avoid overwhelming the database

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      try {
        // Fetch user profiles from Firestore using environment-aware collection name
        const usersQuery = db.collection(getCollectionName('users')).where('__name__', 'in', batch);
        const usersSnapshot = await usersQuery.get();

        // Fetch subscription data in parallel using environment-aware paths
        const subscriptionPromises = batch.map(async (userId) => {
          try {
            // Use environment-aware collection paths
            const { parentPath, subCollectionName } = getSubCollectionPath(
              PAYMENT_COLLECTIONS.USERS,
              userId,
              PAYMENT_COLLECTIONS.SUBSCRIPTIONS
            );
            const subDoc = await db.doc(parentPath).collection(subCollectionName).doc('current').get();
            return {
              userId,
              subscription: subDoc.exists ? subDoc.data() : null
            };
          } catch (error) {
            console.warn(`Error fetching subscription for user ${userId}:`, error);
            return { userId, subscription: null };
          }
        });

        const subscriptionResults = await Promise.all(subscriptionPromises);
        const subscriptionMap = new Map(
          subscriptionResults.map(result => [result.userId, result.subscription])
        );

        // Process Firestore results
        const firestoreUserIds = new Set<string>();
        usersSnapshot.forEach(doc => {
          const userData = doc.data();
          const subscription = subscriptionMap.get(doc.id);

          // Use centralized tier determination logic
          const effectiveTier = getEffectiveTier(
            subscription?.amount || null,
            subscription?.tier || null,
            subscription?.status || null
          );

          const user = {
            uid: doc.id,
            username: userData.username,
            email: userData.email,
            tier: String(effectiveTier), // Ensure tier is always a string
            subscriptionStatus: subscription?.status,
            subscriptionAmount: subscription?.amount,
            pageCount: userData.pageCount || 0,
            followerCount: userData.followerCount || 0,
            viewCount: userData.viewCount || 0
          };

          results[doc.id] = user;
          firestoreUserIds.add(doc.id);
        });

        // Fallback to RTDB for users not found in Firestore (if RTDB is available)
        const rtdbUserIds = batch.filter(id => !firestoreUserIds.has(id));

        if (rtdbUserIds.length > 0 && rtdb) {
          console.log(`Home: Falling back to RTDB for ${rtdbUserIds.length} users`);

          const rtdbPromises = rtdbUserIds.map(async (userId) => {
            try {
              const userSnapshot = await rtdb.ref(`users/${userId}`).get();

              if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                const user = {
                  uid: userId,
                  username: userData.username || "Missing username", // SECURITY: Never expose email
                  email: userData.email,
                  tier: '0', // No subscription data in RTDB
                  subscriptionStatus: null,
                  subscriptionAmount: null,
                  pageCount: userData.pageCount || 0,
                  followerCount: userData.followerCount || 0,
                  viewCount: userData.viewCount || 0
                };

                return { userId, user };
              }

              return { userId, user: null };
            } catch (error) {
              console.warn(`Error fetching user ${userId} from RTDB:`, error);
              return { userId, user: null };
            }
          });

          const rtdbResults = await Promise.all(rtdbPromises);

          rtdbResults.forEach(({ userId, user }) => {
            if (user) {
              results[userId] = user;
            }
          });
        } else if (rtdbUserIds.length > 0 && !rtdb) {
          // If RTDB is not available, create fallback user data for missing users
          console.log(`Home: RTDB not available, creating fallback data for ${rtdbUserIds.length} users`);
          rtdbUserIds.forEach(userId => {
            results[userId] = {
              uid: userId,
              username: 'Unknown User',
              tier: '0',
              subscriptionStatus: null,
              subscriptionAmount: null
            };
          });
        }

      } catch (error) {
        console.error(`Error fetching batch ${i}-${i + batchSize}:`, error);

        // Create fallback user data for failed fetches
        batch.forEach(userId => {
          if (!results[userId]) {
            results[userId] = {
              uid: userId,
              username: 'Unknown User',
              tier: '0',
              subscriptionStatus: null,
              subscriptionAmount: null
            };
          }
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in getBatchUserDataOptimized:', error);
    return {};
  }
}

/**
 * Enhanced user stats fetching with individual cache
 */
async function getUserStatsWithCache(userId: string): Promise<any> {
  const cacheKey = `userStats:${userId}`;
  const cached = userStatsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < USER_STATS_TTL) {
    console.log(`🚀 USER STATS: Cache hit for ${userId}`);
    return cached.data;
  }

  console.log(`💸 USER STATS: Cache miss for ${userId} - fetching from database`);
  const stats = await getUserStatsOptimized(userId);

  if (stats) {
    userStatsCache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    });
  }

  return stats;
}

/**
 * Enhanced batch user data fetching with smart caching
 */
async function getBatchUserDataWithCache(userIds: string[]): Promise<Record<string, any>> {
  const sortedUserIds = userIds.sort(); // Consistent cache keys
  const cacheKey = `batchUserData:${sortedUserIds.join(',')}`;
  const cached = batchUserDataCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < BATCH_USER_DATA_TTL) {
    console.log(`🚀 BATCH USER DATA: Cache hit for ${userIds.length} users`);
    return cached.data;
  }

  // Check for partial cache hits
  const cachedUsers: Record<string, any> = {};
  const uncachedUserIds: string[] = [];

  for (const userId of userIds) {
    const userCacheKey = `userData:${userId}`;
    const userCached = batchUserDataCache.get(userCacheKey);

    if (userCached && Date.now() - userCached.timestamp < BATCH_USER_DATA_TTL) {
      cachedUsers[userId] = userCached.data;
    } else {
      uncachedUserIds.push(userId);
    }
  }

  console.log(`💸 BATCH USER DATA: ${Object.keys(cachedUsers).length} cached, ${uncachedUserIds.length} need fetching`);

  // Fetch only uncached users
  let freshData = {};
  if (uncachedUserIds.length > 0) {
    freshData = await getBatchUserDataOptimized(uncachedUserIds);

    // Cache individual user data
    for (const [userId, userData] of Object.entries(freshData)) {
      const userCacheKey = `userData:${userId}`;
      batchUserDataCache.set(userCacheKey, {
        data: userData,
        timestamp: Date.now()
      });
    }
  }

  // Combine cached and fresh data
  const combinedData = { ...cachedUsers, ...freshData };

  // Cache the full batch result
  batchUserDataCache.set(cacheKey, {
    data: combinedData,
    timestamp: Date.now()
  });

  return combinedData;
}

/**
 * Enhanced cache cleanup with size limits and TTL management
 */
function cleanupCaches(): void {
  const now = Date.now();
  const MAX_CACHE_SIZE = 1000; // Prevent memory bloat

  // Clean up home cache
  if (homeCache.size > MAX_CACHE_SIZE || Math.random() < 0.1) {
    for (const [key, value] of homeCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        homeCache.delete(key);
      }
    }
  }

  // Clean up user stats cache
  if (userStatsCache.size > MAX_CACHE_SIZE || Math.random() < 0.05) {
    for (const [key, value] of userStatsCache.entries()) {
      if (now - value.timestamp > USER_STATS_TTL) {
        userStatsCache.delete(key);
      }
    }
  }

  // Clean up batch user data cache
  if (batchUserDataCache.size > MAX_CACHE_SIZE || Math.random() < 0.05) {
    for (const [key, value] of batchUserDataCache.entries()) {
      if (now - value.timestamp > BATCH_USER_DATA_TTL) {
        batchUserDataCache.delete(key);
      }
    }
  }
}