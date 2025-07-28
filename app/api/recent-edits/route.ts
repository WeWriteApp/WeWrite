import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../utils/environmentConfig';
import { getEffectiveTier } from '../../utils/subscriptionTiers';
import { getUserIdFromRequest } from '../auth-helper';

// Initialize Firebase Admin SDK with unique app name for recent edits
let recentEditsApp;
try {
  // Try to get existing app first
  recentEditsApp = getApps().find(app => app.name === 'recent-edits-app');

  if (!recentEditsApp) {
    // Parse the service account JSON from environment (it's base64 encoded)
    const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
    const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedJson);
    console.log('[Recent Edits Admin SDK] Initializing with project:', serviceAccount.project_id);
    console.log('[Recent Edits Admin SDK] Client email:', serviceAccount.client_email);

    recentEditsApp = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')})}, 'recent-edits-app');
    console.log('[Recent Edits Admin SDK] Initialized successfully');
  } else {
    console.log('[Recent Edits Admin SDK] Using existing app');
  }
} catch (error) {
  console.error('[Recent Edits Admin SDK] Initialization failed:', error);
  throw error;
}

const adminDb = getFirestore(recentEditsApp);

// Simple in-memory cache for recent edits to reduce Firebase costs
const recentEditsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 second cache for debugging

/**
 * UNIFIED VERSION SYSTEM: Recent Edits API
 *
 * This API now uses the unified version system instead of activities.
 * It queries versions from pages/{pageId}/versions subcollections to get recent edits.
 */

export async function GET(request: NextRequest) {
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
    const filterToUser = searchParams.get('filterToUser');
    const cursor = searchParams.get('cursor');

    console.log(`🔍 [RECENT_EDITS] User ID: ${userId} (from ${searchParams.get('userId') ? 'query params' : 'auth'}), includeOwn: ${includeOwn}`);

  // Log environment detection for debugging
  const { logEnvironmentConfig } = await import('../../utils/environmentConfig');
  logEnvironmentConfig();

    // Create cache key with version to force cache invalidation
    const cacheKey = `recent-edits-v2:${userId}:${limit}:${includeOwn}:${followingOnly}:${filterToUser}:${cursor}`;

    // TEMPORARILY DISABLE CACHE FOR DEBUGGING
    console.log('🔍 [RECENT_EDITS] Cache disabled for debugging');
    // const cached = recentEditsCache.get(cacheKey);
    // if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    //   console.log('🚀 COST OPTIMIZATION: Returning cached recent edits');
    //   return NextResponse.json(cached.data);
    // }

    // Use the same Firebase Admin instance as my-pages API
    const db = adminDb;

    console.log('🔄 UNIFIED VERSION SYSTEM: Fetching recent edits from pages with versions');

    // UNIFIED VERSION SYSTEM: First get recently modified pages, then get their latest versions
    // This avoids the need for complex collectionGroup indexes
    let pagesQuery;

    // Use the EXACT same query structure as homepage recent edits that works
    if (filterToUser) {
      console.log(`🔍 [RECENT_EDITS] Filtering to user: ${filterToUser}`);
      console.log(`🔍 [RECENT_EDITS] Collection name: ${getCollectionName('pages')}`);
      console.log(`🔍 [RECENT_EDITS] Limit: ${limit * 3}`);

      // EXACT same query as my-pages API that works
      pagesQuery = db.collection(getCollectionName('pages'))
        .where('userId', '==', filterToUser)
        .where('deleted', '!=', true) // Filter out deleted pages (includes pages without deleted field)
        .orderBy('deleted') // Required for != queries
        .orderBy('lastModified', 'desc')
        .limit(limit * 5); // Moderate multiplier for user-specific queries
    } else {
      // SIMPLIFIED: Use the same approach as homepage recent edits that works
      console.log(`🔄 [RECENT_EDITS] Using pages collection approach (same as working homepage)`);

      pagesQuery = db.collection(getCollectionName('pages'))
        .where('isPublic', '==', true)
        .where('deleted', '!=', true) // Filter out deleted pages
        .orderBy('deleted') // Required for != queries
        .orderBy('lastModified', 'desc')
        .limit(limit * 3); // Get more to filter through
    }

    const pagesSnapshot = await pagesQuery.get();
    console.log(`📊 [RECENT_EDITS] Found ${pagesSnapshot.docs.length} pages from Firestore`);

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

      // For user-specific queries, we already filtered in the query
      if (filterToUser) {
        return true;
      }

      // For public queries, ensure page is public
      if (!page.isPublic) {
        return false;
      }

      // Include own pages if requested
      if (includeOwn && page.userId === userId) {
        return true;
      }

      return true;
    });

    console.log(`🔍 [RECENT_EDITS] After filtering: ${filteredPages.length} pages`);

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
        isPublic: page.isPublic || false,
        totalPledged: page.totalPledged || 0,
        pledgeCount: page.pledgeCount || 0,
        lastDiff: page.lastDiff,
        diffPreview: page.diffPreview,
        source: 'pages-collection'
      }));

    console.log(`🔍 [RECENT_EDITS] Final edits: ${edits.length}`);
    if (edits.length > 0) {
      console.log(`🔍 [RECENT_EDITS] Most recent edit:`, {
        title: edits[0].title,
        lastModified: edits[0].lastModified,
        source: edits[0].source
      });
    }

    // Fetch subscription data for all unique user IDs
    const uniqueUserIds = [...new Set(edits.map(edit => edit.userId).filter(Boolean))];
    const batchUserData = await fetchBatchUserData(uniqueUserIds, db);

    // Enhance edits with subscription data
    const enhancedEdits = edits.map(edit => ({
      ...edit,
      hasActiveSubscription: batchUserData[edit.userId]?.hasActiveSubscription || false,
      subscriptionTier: batchUserData[edit.userId]?.subscriptionTier || null
    }));

    return NextResponse.json({
      edits: enhancedEdits,
      hasMore: enhancedEdits.length === limit,
      nextCursor: enhancedEdits.length > 0 ? enhancedEdits[enhancedEdits.length - 1].lastModified : null,
      total: enhancedEdits.length,
      timestamp: new Date().toISOString()
    });






  } catch (error) {
    console.error('Error fetching recent edits:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch recent edits',
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
        // Fetch user profiles from Firestore
        const usersQuery = db.collection('users').where('__name__', 'in', batch);
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

          results[doc.id] = {
            uid: doc.id,
            username: userData.username,
            displayName: userData.displayName,
            email: userData.email,
            tier: String(effectiveTier), // Ensure tier is always a string
            subscriptionStatus: subscription?.status,
            subscriptionAmount: subscription?.amount,
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
