import { NextRequest, NextResponse } from 'next/server';
import { executeDeduplicatedOperation } from '../../utils/serverRequestDeduplication';
import { initAdmin } from '../../firebase/admin';
import { getSubCollectionPath, PAYMENT_COLLECTIONS, getCollectionName } from '../../utils/environmentConfig';
import { getEffectiveTier } from '../../utils/subscriptionTiers';

// Server-side cache for home data
const homeCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const HOME_CACHE_TTL = 5 * 60 * 1000; // 5 minutes server-side cache

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

    // Check server-side cache first
    const cacheKey = `home:${userId || 'anonymous'}`;
    const cached = homeCache.get(cacheKey);

    if (false && cached && Date.now() - cached.timestamp < cached.ttl) { // Temporarily disable cache
      console.log('🏠 HOME API: Returning cached data:', {
        recentlyVisitedPagesCount: cached.data.recentlyVisitedPages?.length || 0,
        hasUserStats: !!cached.data.userStats,
        cacheAge: Date.now() - cached.timestamp
      });
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
    }

    console.log('Home: Fetching fresh data');
    
    // Fetch all data in a single batched operation with deduplication
    const [
      allRecentlyVisitedPages,
      userStats
    ] = await Promise.all([
      executeDeduplicatedOperation(
        'getRecentlyVisitedPages', // Renamed for clarity
        { limit: 40, userId },
        () => getRecentlyVisitedPagesOptimized(40, userId), // Renamed function
        { cacheTTL: 10 * 1000 } // 10 seconds cache for recently visited pages (faster updates)
      ),
      userId ? executeDeduplicatedOperation(
        'getUserStats',
        { userId },
        () => getUserStatsOptimized(userId),
        { cacheTTL: 5 * 60 * 1000 } // 5 minutes cache for user stats
      ) : Promise.resolve(null)
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

    // Batch fetch user subscription data with deduplication
    const uniqueUserIds = [...new Set(recentlyVisitedPages.map(page => page.userId).filter(Boolean))];
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

    // Clean up old cache entries periodically
    if (Math.random() < 0.1) { // 10% chance to clean up
      const now = Date.now();
      for (const [key, value] of homeCache.entries()) {
        if (now - value.timestamp > value.ttl) {
          homeCache.delete(key);
        }
      }
    }

    console.log(`🏠 HOME API: Fresh data fetched in ${loadTime.toFixed(2)}ms:`, {
      recentlyVisitedPagesCount: recentlyVisitedPages.length,
      trendingPagesCount: trendingPages.length,
      hasUserStats: !!userStats,
      hasBatchUserData: !!batchUserData && Object.keys(batchUserData).length > 0
    });

    return NextResponse.json(homeData);
    
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
    const homePageFields = [
      'title', 'isPublic', 'userId', 'username', 'displayName',
      'lastModified', 'createdAt', 'totalPledged', 'pledgeCount', 'deleted'
    ];

    let pagesQuery;

    if (userId) {
      // For logged-in users, get recent pages and filter deleted ones in code
      // This avoids the composite index requirement
      pagesQuery = db.collection(getCollectionName('pages'))
        .orderBy('lastModified', 'desc')
        .limit(limitCount * 3); // Get more to account for filtering deleted pages
    } else {
      // For anonymous users, only public pages
      pagesQuery = db.collection(getCollectionName('pages'))
        .where('isPublic', '==', true)
        .orderBy('lastModified', 'desc')
        .limit(limitCount * 2); // Get more to account for filtering deleted pages
    }

    const snapshot = await pagesQuery.get();
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
                  username: userData.username ||
                           (userData.email ? userData.email.split('@')[0] : undefined),
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