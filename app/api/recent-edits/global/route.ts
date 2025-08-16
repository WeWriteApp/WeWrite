import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { getEffectiveTier } from '../../../utils/subscriptionTiers';
import { getUserIdFromRequest } from '../../auth-helper';
import { trackQuery } from '../../../utils/costOptimizationMonitor';

// EMERGENCY COST OPTIMIZATION: Global cache for recent edits
const globalRecentEditsCache = new Map<string, { data: any; timestamp: number }>();

// Initialize Firebase Admin SDK with unique app name for global recent edits
let globalRecentEditsApp;
try {
  // Try to get existing app first
  globalRecentEditsApp = getApps().find(app => app.name === 'global-recent-edits-app');

  if (!globalRecentEditsApp) {
    // Parse the service account JSON from environment (it's base64 encoded)
    const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
    const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedJson);
    console.log('[Global Recent Edits Admin SDK] Initializing with project:', serviceAccount.project_id);
    console.log('[Global Recent Edits Admin SDK] Client email:', serviceAccount.client_email);

    globalRecentEditsApp = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')})}, 'global-recent-edits-app');
    console.log('[Global Recent Edits Admin SDK] Initialized successfully');
  } else {
    console.log('[Global Recent Edits Admin SDK] Using existing app');
  }
} catch (error) {
  console.error('[Global Recent Edits Admin SDK] Initialization failed:', error);
  throw error;
}

const adminDb = getFirestore(globalRecentEditsApp);

/**
 * GLOBAL RECENT EDITS API
 *
 * This API provides global recent edits for the homepage.
 * It queries pages collection directly by lastModified using the simplified activity system.
 * 
 * This is the CLEAR, RENAMED version of the old /api/recent-edits endpoint.
 */

export async function GET(request: NextRequest) {
  // 🚨 NEVER RETURN MOCK DATA - ALWAYS USE REAL DATA

  try {
    const { searchParams } = new URL(request.url);

    // FIXED: Get userId from query params (as frontend expects) AND try authentication as fallback
    let userId = searchParams.get('userId');

    // If no userId in query params, try to get from authentication
    if (!userId) {
      userId = await getUserIdFromRequest(request);
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 20); // REDUCED LIMIT FOR COST OPTIMIZATION
    const includeOwn = searchParams.get('includeOwn') === 'true';
    const followingOnly = searchParams.get('followingOnly') === 'true';
    const cursor = searchParams.get('cursor');

    console.log(`🌍 [GLOBAL_RECENT_EDITS] User ID: ${userId} (from ${searchParams.get('userId') ? 'query params' : 'auth'}), includeOwn: ${includeOwn}`);

    // Log environment detection for debugging
    const { logEnvironmentConfig } = await import('../../../utils/environmentConfig');
    logEnvironmentConfig();

    // Debug: Log collection names being used
    console.log('🔍 DEBUG: Collection names being used:', {
      users: getCollectionName('users'),
      subscriptions: getCollectionName('subscriptions')
    });

    // 🚨 EMERGENCY COST OPTIMIZATION: ULTRA AGGRESSIVE CACHING
    // Include cursor in cache key to avoid returning cached first page for paginated requests
    const cacheKey = `global-recent-edits:${userId || 'anon'}:${limit}:${includeOwn}:${followingOnly}:${cursor || 'first'}`;
    const CACHE_TTL = process.env.NODE_ENV === 'development' ? 30 * 1000 : 5 * 60 * 1000; // 30 seconds in dev, 5 minutes in prod (reduced for better UX)

    // Check cache first
    const cached = globalRecentEditsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('🚀 EMERGENCY COST OPTIMIZATION: Returning cached global recent edits');
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
    }

    // Use the same Firebase Admin instance as my-pages API
    const db = adminDb;

    console.log('🔄 GLOBAL RECENT EDITS: Fetching recent edits from pages collection (simplified activity system)');

    // SIMPLIFIED: Use the same approach as homepage recent edits that works
    console.log(`🔄 [GLOBAL_RECENT_EDITS] Using pages collection approach (same as working homepage)`);

    let pagesQuery;

    if (userId) {
      // For logged-in users, get recent pages (last 30 days) and filter deleted ones in code
      // Increased from 7 to 30 days to ensure enough content for pagination
      const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

      pagesQuery = db.collection(getCollectionName('pages'))
        .where('lastModified', '>=', thirtyDaysAgo.toISOString())
        .orderBy('lastModified', 'desc');

      // Add cursor support for pagination
      if (cursor) {
        console.log(`🔄 [GLOBAL_RECENT_EDITS] Using cursor: ${cursor}`);
        pagesQuery = pagesQuery.startAfter(cursor);
      }

      // Fetch significantly more documents to account for filtering
      // This ensures we have enough content after filtering out deleted/private/own pages
      pagesQuery = pagesQuery.limit(Math.min(limit * 3, 50)); // Fetch 3x the limit to account for filtering
    } else {
      // For anonymous users, only public pages from last 30 days
      const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

      pagesQuery = db.collection(getCollectionName('pages'))
        .where('isPublic', '==', true)
        .where('lastModified', '>=', thirtyDaysAgo.toISOString())
        .orderBy('lastModified', 'desc');

      // Add cursor support for pagination
      if (cursor) {
        console.log(`🔄 [GLOBAL_RECENT_EDITS] Using cursor: ${cursor}`);
        pagesQuery = pagesQuery.startAfter(cursor);
      }

      // Fetch more documents to account for filtering
      pagesQuery = pagesQuery.limit(Math.min(limit * 2, 30)); // Fetch 2x the limit for anonymous users
    }

    const queryStartTime = Date.now();
    const pagesSnapshot = await pagesQuery.get();
    const queryTime = Date.now() - queryStartTime;

    // Track query for cost optimization monitoring
    trackQuery('global-recent-edits', pagesSnapshot.docs.length, queryTime, true);

    console.log(`📊 [GLOBAL_RECENT_EDITS] Found ${pagesSnapshot.docs.length} pages from Firestore (${queryTime}ms, date-filtered)`);

    if (pagesSnapshot.empty) {
      return NextResponse.json({
        edits: [],
        hasMore: false,
        nextCursor: null,
        total: 0,
        timestamp: new Date().toISOString()
      });
    }

    const pages = pagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter pages based on criteria (same logic as homepage)
    const filteredPages = pages.filter(page => {
      // Skip deleted pages (double check)
      if (page.deleted === true) {
        return false;
      }

      // Filter by visibility (same logic as home API)
      if (!userId) {
        // For anonymous users, only show public pages
        if (!page.isPublic) {
          return false;
        }
      } else {
        // For logged-in users, show public pages OR their own pages
        if (!page.isPublic && page.userId !== userId) {
          return false;
        }
      }

      // FIXED: Hide my edits logic - when includeOwn is false, exclude user's own pages
      if (!includeOwn && page.userId === userId) {
        console.log(`🔍 [GLOBAL_RECENT_EDITS] Hiding own edit: ${page.title} by ${page.username}`);
        return false;
      }

      return true;
    });

    console.log(`🔍 [GLOBAL_RECENT_EDITS] After filtering: ${filteredPages.length} pages`);

    // Convert to edits format
    const edits = filteredPages
      .slice(0, limit)
      .map(page => ({
        id: page.id,
        title: page.title || 'Untitled',
        userId: page.userId,
        username: page.username,
        displayName: page.displayName,
        lastModified: page.lastModified,
        totalPledged: page.totalPledged || 0,
        pledgeCount: page.pledgeCount || 0,
        lastDiff: page.lastDiff,
        source: 'pages-collection'
      }));

    console.log(`🔍 [GLOBAL_RECENT_EDITS] Final edits: ${edits.length}`);
    if (edits.length > 0) {
      console.log(`🔍 [GLOBAL_RECENT_EDITS] Most recent edit:`, {
        title: edits[0].title,
        lastModified: edits[0].lastModified,
        source: edits[0].source
      });
    }

    // Fetch subscription data for all unique user IDs
    const uniqueUserIds = [...new Set(edits.map(edit => edit.userId).filter(Boolean))];
    const batchUserData = await fetchBatchUserData(uniqueUserIds, db);

    // Enhance edits with user and subscription data
    const enhancedEdits = edits.map(edit => {
      const userData = batchUserData[edit.userId];
      return {
        ...edit,
        // Use username from user data if available, fallback to page username
        username: userData?.username || edit.username,
        displayName: userData?.displayName || edit.displayName,
        hasActiveSubscription: userData?.hasActiveSubscription || false,
        subscriptionTier: userData?.tier || null,
        subscriptionAmount: userData?.subscriptionAmount || null
      };
    });

    // Determine if there are more pages available
    // We have more if:
    // 1. We got more filtered pages than we're returning (meaning there are more after slicing)
    // 2. OR we got the maximum number of documents from Firestore (suggesting there might be more)
    const totalFetched = pagesSnapshot.docs.length;
    const maxPossibleFetch = userId ? Math.min(limit * 3, 50) : Math.min(limit * 2, 30);
    const hasMorePages = (filteredPages.length > limit) || (totalFetched >= maxPossibleFetch);

    const nextCursor = hasMorePages && enhancedEdits.length > 0
      ? enhancedEdits[enhancedEdits.length - 1].lastModified
      : null;

    console.log(`🔄 [GLOBAL_RECENT_EDITS] Pagination info: totalFetched=${totalFetched}, filteredPages=${filteredPages.length}, enhancedEdits=${enhancedEdits.length}, hasMore=${hasMorePages}, nextCursor=${nextCursor}`);

    const responseData = {
      edits: enhancedEdits,
      hasMore: hasMorePages,
      nextCursor: nextCursor,
      total: enhancedEdits.length,
      timestamp: new Date().toISOString()
    };

    // EMERGENCY COST OPTIMIZATION: Cache the response
    globalRecentEditsCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching global recent edits:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch global recent edits',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch batch user data including subscription information
 */
async function fetchBatchUserData(userIds: string[], db: any): Promise<Record<string, any>> {
  if (userIds.length === 0) return {};

  const results: Record<string, any> = {};

  try {
    // Batch fetch from Firestore (max 10 per query due to 'in' limitation)
    const batchSize = 10;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      try {
        // FIXED: Use environment-aware collection names
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
            const subscriptionData = subDoc.exists ? subDoc.data() : null;

            return {
              userId,
              subscription: subscriptionData
            };
          } catch (error) {
            console.warn(`Error fetching subscription for user ${userId}:`, error);
            return { userId, subscription: null };
          }
        });

        const subscriptionResults = await Promise.all(subscriptionPromises);
        const subscriptionMap = new Map(subscriptionResults.map(r => [r.userId, r.subscription]));

        // Process Firestore results
        usersSnapshot.forEach(doc => {
          const userData = doc.data();
          const subscription = subscriptionMap.get(doc.id);

          // Use centralized tier determination logic
          const effectiveTier = getEffectiveTier(
            subscription?.amount || null,
            subscription?.tier || null,
            subscription?.status || null
          );

          // Check if subscription is active
          const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';

          results[doc.id] = {
            uid: doc.id,
            username: userData.username,
            displayName: userData.displayName,
            email: userData.email,
            tier: String(effectiveTier), // Ensure tier is always a string
            subscriptionStatus: subscription?.status,
            subscriptionAmount: subscription?.amount,
            hasActiveSubscription: isActive,
            pageCount: userData.pageCount || 0,
            followerCount: userData.followerCount || 0,
            viewCount: userData.viewCount || 0
          };
        });

      } catch (error) {
        console.warn(`Error fetching batch ${i}-${i + batchSize}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in fetchBatchUserData:', error);
  }

  return results;
}
