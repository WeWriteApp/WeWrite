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

    // Use the EXACT same query structure as my-pages API
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
      // PROPER APPROACH: Use collectionGroup to query all versions across all pages
      // This is the documented approach from VERSION_SYSTEM.md
      console.log(`🔄 [RECENT_EDITS] Using collectionGroup('versions') to find truly recent activity`);

      // Query all versions across all pages using collectionGroup
      // Note: collectionGroup uses the base collection name, not environment-prefixed
      // First try without orderBy to see if collectionGroup works, then sort client-side
      let versionsQuery = db.collectionGroup('versions')
        .limit(limit * 20); // Get many more versions to find truly recent activity

      console.log(`🔍 [RECENT_EDITS] Attempting collectionGroup query without orderBy to avoid index requirements`);

      // Skip cursor for now to simplify the query
      // if (cursor) {
      //   try {
      //     const cursorDate = new Date(cursor);
      //     versionsQuery = versionsQuery.startAfter(cursorDate);
      //   } catch (error) {
      //     console.warn('Invalid cursor provided:', cursor);
      //   }
      // }

      const versionsSnapshot = await versionsQuery.get();
      console.log(`📊 [RECENT_EDITS] Found ${versionsSnapshot.docs.length} recent versions using collectionGroup`);

      if (versionsSnapshot.empty) {
        return NextResponse.json({
          edits: [],
          hasMore: false,
          nextCursor: null,
          total: 0,
          timestamp: new Date().toISOString()
        });
      }

      // Get unique page IDs from the versions and fetch their page data
      const pageIds = [...new Set(versionsSnapshot.docs.map(doc => {
        // Extract pageId from the document path: pages/{pageId}/versions/{versionId}
        const pathParts = doc.ref.path.split('/');
        return pathParts[pathParts.length - 3]; // Get pageId from path
      }))];

      console.log(`📊 [RECENT_EDITS] Found ${pageIds.length} unique pages from recent versions`);

      // Batch fetch page data
      const pagePromises = pageIds.map(pageId =>
        db.collection(getCollectionName('pages')).doc(pageId).get()
      );
      const pageSnapshots = await Promise.all(pagePromises);

      // Create a map of pageId -> pageData for quick lookup
      const pageDataMap = new Map();
      pageSnapshots.forEach(doc => {
        if (doc.exists && !doc.data()?.deleted) {
          pageDataMap.set(doc.id, { id: doc.id, ...doc.data() });
        }
      });

      console.log(`📊 [RECENT_EDITS] Found ${pageDataMap.size} valid pages after filtering deleted`);

      const validEdits: any[] = [];
      const processedPages = new Set(); // Track pages to avoid duplicates

      // Sort versions by createdAt client-side (newest first)
      const sortedVersionDocs = versionsSnapshot.docs.sort((a, b) => {
        const aTime = a.data().createdAt?.toDate?.() || new Date(a.data().createdAt);
        const bTime = b.data().createdAt?.toDate?.() || new Date(b.data().createdAt);
        return bTime.getTime() - aTime.getTime();
      });

      console.log(`🔍 [RECENT_EDITS] Sorted ${sortedVersionDocs.length} versions client-side`);

      // Debug: Show date range of versions
      if (sortedVersionDocs.length > 0) {
        const newestDate = sortedVersionDocs[0].data().createdAt?.toDate?.() || new Date(sortedVersionDocs[0].data().createdAt);
        const oldestDate = sortedVersionDocs[sortedVersionDocs.length - 1].data().createdAt?.toDate?.() || new Date(sortedVersionDocs[sortedVersionDocs.length - 1].data().createdAt);
        console.log(`🔍 [RECENT_EDITS] Version date range: ${newestDate.toISOString()} to ${oldestDate.toISOString()}`);
      }

      // Process versions in chronological order (newest first)
      for (const versionDoc of sortedVersionDocs) {
        const versionData = versionDoc.data();

        // Extract pageId from document path
        const pathParts = versionDoc.ref.path.split('/');
        const pageId = pathParts[pathParts.length - 3];

        // Debug logging for first few versions
        if (validEdits.length < 3) {
          const versionDate = versionData.createdAt?.toDate?.() || new Date(versionData.createdAt);
          console.log(`🔍 [RECENT_EDITS] Processing version from ${versionDate.toISOString()} for page ${pageId}`);
        }

        // Skip if we already processed this page (we want the most recent version per page)
        if (processedPages.has(pageId)) {
          if (validEdits.length < 3) {
            console.log(`🔍 [RECENT_EDITS] Skipping ${pageId} - already processed`);
          }
          continue;
        }

        // Get page data
        const page = pageDataMap.get(pageId);
        if (!page) {
          if (validEdits.length < 3) {
            console.log(`🔍 [RECENT_EDITS] Skipping ${pageId} - page not found or deleted`);
          }
          continue; // Page doesn't exist or is deleted
        }

        // Apply filters with debug logging
        if (!userId && !page.isPublic) {
          if (validEdits.length < 3) {
            console.log(`🔍 [RECENT_EDITS] Skipping ${pageId} - not public and no user`);
          }
          continue;
        }
        if (userId && !page.isPublic && page.userId !== userId) {
          if (validEdits.length < 3) {
            console.log(`🔍 [RECENT_EDITS] Skipping ${pageId} - not public and not user's page`);
          }
          continue;
        }
        if (!includeOwn && userId && page.userId === userId && !filterToUser) {
          if (validEdits.length < 3) {
            console.log(`🔍 [RECENT_EDITS] Skipping ${pageId} - own page excluded`);
          }
          continue;
        }
        if (filterToUser && page.userId !== filterToUser) {
          if (validEdits.length < 3) {
            console.log(`🔍 [RECENT_EDITS] Skipping ${pageId} - not from target user`);
          }
          continue;
        }

        // Mark this page as processed
        processedPages.add(pageId);

        // Use the version's createdAt as the actual last modified time
        const actualLastModified = versionData.createdAt?.toDate ?
          versionData.createdAt.toDate().toISOString() :
          (versionData.createdAt || (page.lastModified?.toDate ? page.lastModified.toDate().toISOString() : page.lastModified));

        validEdits.push({
          id: page.id,
          title: page.title || versionData.title || 'Untitled',
          userId: page.userId || versionData.userId,
          username: page.username || versionData.username || 'Anonymous',
          displayName: page.displayName,
          lastModified: actualLastModified,
          isPublic: page.isPublic || false,
          totalPledged: page.totalPledged || 0,
          pledgeCount: page.pledgeCount || 0,
          lastDiff: page.lastDiff || versionData.diff || {
            added: 0,
            removed: 0,
            hasChanges: false
          },
          diffPreview: versionData.diffPreview || (versionData.isNewPage ? 'New page created' : 'Page edited'),
          versionId: versionDoc.id,
          isNewPage: versionData.isNewPage || false,
          source: 'collectionGroup_versions'
        });

        // Stop when we have enough edits
        if (validEdits.length >= limit) break;
      }

      // Apply following filter
      if (followingOnly && userId) {
        // TODO: Implement following filter when needed
        validEdits.length = 0;
      }

      // Sort by actual version timestamp (should already be sorted, but ensure consistency)
      const sortedEdits = validEdits
        .sort((a, b) => {
          const aTime = new Date(a.lastModified).getTime();
          const bTime = new Date(b.lastModified).getTime();
          return bTime - aTime;
        })
        .slice(0, limit);

      console.log(`🔍 [RECENT_EDITS] CollectionGroup approach found ${sortedEdits.length} recent edits`);
      if (sortedEdits.length > 0) {
        console.log(`🔍 [RECENT_EDITS] Most recent edit:`, {
          title: sortedEdits[0].title,
          lastModified: sortedEdits[0].lastModified,
          source: sortedEdits[0].source
        });
      }

      // Fetch subscription data for all unique user IDs
      const uniqueUserIds = [...new Set(sortedEdits.map(edit => edit.userId).filter(Boolean))];
      const batchUserData = await fetchBatchUserData(uniqueUserIds, db);

      // Enhance edits with subscription data
      const enhancedEdits = sortedEdits.map(edit => ({
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
    }





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
