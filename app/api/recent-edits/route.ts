import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../utils/environmentConfig';
import { getEffectiveTier } from '../../utils/subscriptionTiers';

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
    const userId = searchParams.get('userId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 20); // REDUCED LIMIT FOR COST OPTIMIZATION
    const includeOwn = searchParams.get('includeOwn') === 'true';
    const followingOnly = searchParams.get('followingOnly') === 'true';
    const filterToUser = searchParams.get('filterToUser');
    const cursor = searchParams.get('cursor');

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
      // Progressive batch loading: Start with reasonable fetch size, let client request more
      pagesQuery = db.collection(getCollectionName('pages'))
        .orderBy('lastModified', 'desc')
        .limit(limit * 8); // Balanced: enough data after filtering, but fast initial load
    }

    // Add cursor for pagination
    if (cursor) {
      try {
        const cursorDate = new Date(cursor);
        pagesQuery = pagesQuery.startAfter(cursorDate);
      } catch (error) {
        console.warn('Invalid cursor provided:', cursor);
      }
    }

    // Add visibility filter for non-authenticated users
    if (!userId) {
      pagesQuery = pagesQuery.where('isPublic', '==', true);
    }

    console.log(`🔍 [RECENT_EDITS] Executing query...`);
    const pagesSnapshot = await pagesQuery.get();
    console.log(`🔍 [RECENT_EDITS] Query returned ${pagesSnapshot.size} pages`);

    // Debug: Log the first few pages to understand what we're getting
    if (pagesSnapshot.size > 0) {
      const firstFewPages = pagesSnapshot.docs.slice(0, 3).map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          lastModified: data.lastModified?.toDate ? data.lastModified.toDate().toISOString() : data.lastModified,
          userId: data.userId,
          username: data.username
        };
      });
      console.log(`🔍 [RECENT_EDITS] First few pages:`, firstFewPages);
    }

    if (pagesSnapshot.empty) {
      console.log(`📊 UNIFIED VERSION SYSTEM: No pages found${filterToUser ? ` for user ${filterToUser}` : ''}`);

      // If filtering by user and no pages found, let's check if any pages exist for this user
      if (filterToUser) {
        const debugQuery = db.collection(getCollectionName('pages')).where('userId', '==', filterToUser).limit(1);
        const debugSnapshot = await debugQuery.get();
        console.log(`🔍 [DEBUG] User ${filterToUser} has ${debugSnapshot.size} pages in database`);

        if (!debugSnapshot.empty) {
          const samplePage = debugSnapshot.docs[0].data();
          console.log(`🔍 [DEBUG] Sample page data:`, {
            id: debugSnapshot.docs[0].id,
            userId: samplePage.userId,
            title: samplePage.title,
            lastModified: samplePage.lastModified
          });
        }
      }

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

    console.log(`📊 UNIFIED VERSION SYSTEM: Found ${pages.length} pages, fetching their latest versions`);

    // Enhanced debug logging
    console.log(`📊 UNIFIED VERSION SYSTEM: Found ${pages.length} pages`);
    if (filterToUser) {
      console.log(`🔍 Filtering to user: ${filterToUser} (already applied at DB level)`);
    }

    // UNIFIED VERSION SYSTEM: Process pages and get their latest versions
    const validEdits: any[] = [];

    for (const page of pages) {
      // Filter out deleted pages
      if (page.deleted === true) {
        continue;
      }

      // User filter already applied at DB level when filterToUser is set

      // Apply visibility filter
      if (!userId && !page.isPublic) {
        continue;
      }

      if (userId && !page.isPublic && page.userId !== userId) {
        continue;
      }

      // Apply own edits filter
      if (!includeOwn && userId && page.userId === userId && !filterToUser) {
        continue;
      }

      // Process all pages (removed 7-day restriction to show all recent edits)
      const lastModifiedDate = page.lastModified?.toDate ? page.lastModified.toDate() : new Date(page.lastModified);

      // Always process pages to show all recent edits
        // Try to get the latest version for this page, prioritizing user versions
        try {
          // Get recent versions and filter client-side to avoid Firestore != query issues
          const versionsQuery = db.collection(getCollectionName('pages'))
            .doc(page.id)
            .collection('versions')
            .orderBy('createdAt', 'desc')
            .limit(10); // Get more to find non-migration versions

          const allVersionsSnapshot = await versionsQuery.get();

          if (allVersionsSnapshot.empty) {
            continue; // Skip pages with no versions
          }

          // Find the first non-migration version, or use the latest if none found
          let selectedVersion = allVersionsSnapshot.docs[0]; // Default to latest
          let foundUserVersion = false;

          for (const versionDoc of allVersionsSnapshot.docs) {
            const versionData = versionDoc.data();
            if (!versionData.optimizationMigration && !versionData.migratedFromVersion) {
              selectedVersion = versionDoc;
              foundUserVersion = true;
              break; // Use the first (most recent) non-migration version
            }
          }

          // Debug logging for first few pages
          if (validEdits.length < 3) {
            console.log(`🔍 [RECENT_EDITS] Page ${page.id} (${page.title}):`, {
              totalVersions: allVersionsSnapshot.docs.length,
              foundUserVersion,
              selectedVersionIsMigration: selectedVersion.data().optimizationMigration || selectedVersion.data().migratedFromVersion,
              pageLastModified: page.lastModified?.toDate ? page.lastModified.toDate().toISOString() : page.lastModified,
              selectedVersionCreatedAt: selectedVersion.data().createdAt?.toDate ? selectedVersion.data().createdAt.toDate().toISOString() : selectedVersion.data().createdAt
            });
          }

          const versionSnapshot = { docs: [selectedVersion], empty: false };

          if (!versionSnapshot.empty) {
            const latestVersion = versionSnapshot.docs[0];
            const versionData = latestVersion.data();

            // If this is still a migration version, use the page's lastModified as the source of truth
            const isMigrationVersion = versionData.optimizationMigration || versionData.migratedFromVersion;

            if (isMigrationVersion) {
              // For migration versions, check if the page itself has been modified recently by a user
              const pageLastModified = page.lastModified?.toDate ? page.lastModified.toDate() : new Date(page.lastModified);
              const versionCreatedAt = versionData.createdAt?.toDate ? versionData.createdAt.toDate() : new Date(versionData.createdAt);

              // If the page was modified after the migration version was created, it's a real user edit
              if (pageLastModified > versionCreatedAt) {
                // This is a real user edit after migration - include it
              } else {
                // This is just a migration version with no subsequent user edits
                const daysSincePageModified = (new Date().getTime() - pageLastModified.getTime()) / (24 * 60 * 60 * 1000);
                if (daysSincePageModified > 7) {
                  continue; // Skip old migration-only pages
                }
              }
            }

            // CRITICAL FIX: Use page.lastModified as primary timestamp, not version createdAt
            // This ensures we show actual user edit times, not migration/system timestamps
            const actualLastModified = page.lastModified || versionData.createdAt;

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

              // Use page's lastDiff if available (more reliable), otherwise fall back to version diff
              lastDiff: page.lastDiff || versionData.diff || {
                added: 0,
                removed: 0,
                hasChanges: false
              },
              diffPreview: versionData.diffPreview,
              versionId: latestVersion.id,
              isNewPage: versionData.isNewPage || false,
              source: 'version'
            });
          } else {
            // Fallback to page data if no versions found
            validEdits.push({
              id: page.id,
              title: page.title || 'Untitled',
              userId: page.userId,
              username: page.username || 'Anonymous',
              displayName: page.displayName,
              lastModified: page.lastModified?.toDate ? page.lastModified.toDate().toISOString() : page.lastModified,
              isPublic: page.isPublic || false,
              totalPledged: page.totalPledged || 0,
              pledgeCount: page.pledgeCount || 0,

              // Fallback to page lastDiff
              lastDiff: page.lastDiff || {
                added: 0,
                removed: 0,
                hasChanges: false
              },
              source: 'page_fallback'
            });
          }
        } catch (error) {
          console.warn(`Error fetching versions for page ${page.id}:`, error);
          // Continue with page data as fallback
          validEdits.push({
            id: page.id,
            title: page.title || 'Untitled',
            userId: page.userId,
            username: page.username || 'Anonymous',
            displayName: page.displayName,
            lastModified: page.lastModified?.toDate ? page.lastModified.toDate().toISOString() : page.lastModified,
            isPublic: page.isPublic || false,
            totalPledged: page.totalPledged || 0,
            pledgeCount: page.pledgeCount || 0,
            lastDiff: page.lastDiff || {
              added: 0,
              removed: 0,
              hasChanges: false
            },
            source: 'page_error_fallback'
          });
        }
    }

    // Apply following filter (placeholder - would need to fetch followed pages)
    if (followingOnly && userId) {
      // TODO: Implement following filter when needed
      // For now, just return empty array
      validEdits.length = 0;
    }

    // Sort by last modified date and limit
    const sortedEdits = validEdits
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      .slice(0, limit);

    // Fetch subscription data for all unique user IDs
    const uniqueUserIds = [...new Set(sortedEdits.map(edit => edit.userId).filter(Boolean))];
    const batchUserData = await fetchBatchUserData(uniqueUserIds, db);

    // Add subscription data to edits
    const editsWithSubscriptions = sortedEdits.map(edit => {
      if (!edit.userId) return edit;

      const userData = batchUserData[edit.userId];
      return {
        ...edit,
        tier: userData?.tier,
        subscriptionStatus: userData?.subscriptionStatus,
        subscriptionAmount: userData?.subscriptionAmount,
        username: userData?.username || edit.username
      };
    });

    // Determine if there are more items available
    const hasMore = validEdits.length >= limit;

    // Get the cursor for the next page (last item's lastModified date)
    const nextCursor = editsWithSubscriptions.length > 0 ? editsWithSubscriptions[editsWithSubscriptions.length - 1].lastModified : null;

    console.log(`📊 UNIFIED VERSION SYSTEM: Returning ${editsWithSubscriptions.length} recent edits from versions with subscription data`);

    const result = {
      edits: editsWithSubscriptions,
      hasMore,
      nextCursor,
      total: editsWithSubscriptions.length,
      timestamp: new Date().toISOString(),
      source: 'unified_version_system' // Indicate this is using the new system
    };

    // TEMPORARILY DISABLE CACHE STORAGE FOR DEBUGGING
    // recentEditsCache.set(cacheKey, { data: result, timestamp: Date.now() });

    // Clean up old cache entries to prevent memory leaks
    if (recentEditsCache.size > 100) {
      const oldestKey = recentEditsCache.keys().next().value;
      recentEditsCache.delete(oldestKey);
    }

    return NextResponse.json(result);

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
