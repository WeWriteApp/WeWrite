import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionNameAsync, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { getEffectiveTier } from '../../../utils/subscriptionTiers';
import { getUserIdFromRequest } from '../../auth-helper';
import { trackQuery } from '../../../utils/costOptimizationMonitor';
import { sanitizeUsername } from '../../../utils/usernameSecurity';

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
      users: await getCollectionNameAsync('users'),
      subscriptions: await getCollectionNameAsync('subscriptions')
    });

    // SIMPLIFIED CACHING: Use unified cache system
    const { cachedFetch } = await import('../../../utils/unifiedCache');
    const cacheKey = `recent-edits:global:${userId || 'anon'}:${limit}:${includeOwn}:${followingOnly}:${cursor || 'first'}`;

    return NextResponse.json(await cachedFetch(
      cacheKey,
      async () => {

    // Use the same Firebase Admin instance as my-pages API
    const db = adminDb;

    console.log('🔄 GLOBAL RECENT EDITS: Fetching recent edits from pages collection (simplified activity system)');

    // SIMPLIFIED: Use the same approach as homepage recent edits that works
    console.log(`🔄 [GLOBAL_RECENT_EDITS] Using pages collection approach (same as working homepage)`);

    let pagesQuery;

    const pagesCollectionName = await getCollectionNameAsync('pages');

    if (userId) {
      // For logged-in users, get recent pages (last 30 days) and filter deleted ones in code
      // Increased from 7 to 30 days to ensure enough content for pagination
      const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

      pagesQuery = db.collection(pagesCollectionName)
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
      // For anonymous users, all pages from last 30 days (all pages are public now)
      const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

      pagesQuery = db.collection(pagesCollectionName)
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

    const pages = pagesSnapshot.docs.map(doc => {
      const data = doc.data();
      // Only use username field - displayName and email are deprecated for display
      const safeUsername = sanitizeUsername(
        (data as any).username || (data as any).authorName,
        'User',
        `user_${doc.id.slice(0, 8)}`
      );
      return {
        id: doc.id,
        ...data,
        username: safeUsername
      };
    });

    // Filter pages based on criteria (same logic as homepage)
    const filteredPages = pages.filter(page => {
      // Skip deleted pages (double check)
      if (page.deleted === true) {
        return false;
      }

      // All pages are now public - no visibility filtering needed

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
      .map(page => {
        // Derive a friendly preview for reply/agree/disagree pages
        const deriveReplyPreview = () => {
          const isReply = page.isReply || !!page.replyTo;
          if (!isReply) return null;

          // Try to read replyType from the stored content attribution block
          let replyType: string | null = page.replyType || null;
          if (!replyType && Array.isArray(page.content) && page.content.length > 0) {
            replyType = page.content[0]?.replyType || page.content[0]?.reply_type || null;
          }
          if (!replyType && typeof page.content === 'string') {
            try {
              const parsed = JSON.parse(page.content);
              if (Array.isArray(parsed) && parsed.length > 0) {
                replyType = parsed[0]?.replyType || parsed[0]?.reply_type || null;
              }
            } catch (_err) {
              // ignore parse errors
            }
          }

          const author = page.username || 'Unknown user';
          const pageTitle = page.title || 'Untitled';
          const targetTitle = page.replyToTitle || 'the original page';

          let action = 'as a reply to';
          if (replyType === 'agree') action = 'to agree with';
          if (replyType === 'disagree') action = 'to disagree with';

          const message = `${pageTitle} was created by ${author} ${action} ${targetTitle}`;

          return {
            beforeContext: '',
            addedText: message,
            removedText: '',
            afterContext: '',
            hasAdditions: true,
            hasRemovals: false
          };
        };

        const replyPreview = deriveReplyPreview();

        return {
          id: page.id,
          title: page.title || 'Untitled',
          userId: page.userId,
          username: page.username,
          lastModified: page.lastModified,
          totalPledged: page.totalPledged || 0,
          pledgeCount: page.pledgeCount || 0,
          lastDiff: page.lastDiff,
          diffPreview: replyPreview || page.diffPreview || page.lastDiff?.preview || null,
          source: 'pages-collection'
        };
      });

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

        return responseData;
      },
      {
        tags: ['recent-edits', 'global']
      }
    ));

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
        const usersCollectionName = await getCollectionNameAsync('users');
        const usersQuery = db.collection(usersCollectionName).where('__name__', 'in', batch);
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
            // Only use username field - displayName is deprecated
            username: userData.username,
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
