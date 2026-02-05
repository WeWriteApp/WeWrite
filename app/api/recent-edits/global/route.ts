import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionNameAsync, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { getEffectiveTier } from '../../../utils/subscriptionTiers';
import { getUserIdFromRequest } from '../../auth-helper';
import { trackFirebaseRead } from '../../../utils/costMonitor';
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

    globalRecentEditsApp = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')})}, 'global-recent-edits-app');
  }
} catch (error) {
  throw error;
}

const adminDb = getFirestore(globalRecentEditsApp);

/**
 * GLOBAL ACTIVITY FEED API
 *
 * This API provides global activity feed for the homepage.
 * It queries pages collection directly by lastModified.
 *
 * @deprecated Use /api/activity-feed/global instead. This route is kept for backward compatibility.
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
    // hideUnverified defaults to true for spam prevention - only show content from verified users
    const hideUnverified = searchParams.get('hideUnverified') !== 'false';
    // hideLikelySpam defaults to false - opt-in filter to hide accounts flagged as likely spam
    const hideLikelySpam = searchParams.get('hideLikelySpam') === 'true';
    const cursor = searchParams.get('cursor');

    // SMART CACHING: Only cache meaningful results to allow backfill to run
    // Use the local cache (line 11) with conditional caching logic
    const CACHE_TTL = 10 * 1000; // 10 seconds for good results
    const EMPTY_CACHE_TTL = 2 * 1000; // 2 seconds for empty/sparse results (allows backfill retry)
    const cacheKey = `recent-edits:global:${userId || 'anon'}:${limit}:${includeOwn}:${followingOnly}:${hideUnverified}:${hideLikelySpam}:${cursor || 'first'}`;

    // Check cache first
    const cached = globalRecentEditsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < (cached.data?.edits?.length > 0 ? CACHE_TTL : EMPTY_CACHE_TTL)) {
      return NextResponse.json(cached.data);
    }

    // Cache miss or expired - fetch fresh data
    const responseData = await (async () => {

    // Use the same Firebase Admin instance as my-pages API
    const db = adminDb;

    const pagesCollectionName = await getCollectionNameAsync('pages');

    // Fetch followed users list if followingOnly filter is enabled
    let followedUserIds: Set<string> | null = null;
    if (followingOnly && userId) {
      try {
        const userFollowingCollectionName = await getCollectionNameAsync('userFollowing');
        const userFollowingDoc = await db.collection(userFollowingCollectionName).doc(userId).get();
        if (userFollowingDoc.exists) {
          const followingData = userFollowingDoc.data();
          followedUserIds = new Set(followingData?.following || []);
        } else {
          followedUserIds = new Set();
        }
      } catch (error) {
        console.error('[Global Recent Edits] Failed to fetch followed users:', error);
        followedUserIds = new Set();
      }
    }

    // BACKFILL LOGIC: When spam filters remove too much content, expand time window
    // Start with 30 days and expand up to 180 days if needed
    const MIN_RESULTS_BEFORE_BACKFILL = Math.ceil(limit * 0.5); // Trigger backfill if < 50% of requested limit
    const MAX_BACKFILL_DAYS = 180; // Don't go back more than 6 months
    const BACKFILL_INCREMENTS = [30, 60, 90, 180]; // Days to try

    let currentTimeWindowDays = 30;
    let allEnhancedEdits: any[] = [];
    let hasMorePages = false;
    let lastCursor: string | null = null;
    let backfillAttempts = 0;
    let didBackfill = false;

    // Diagnostic counters for debugging filter behavior
    let _diagnostics: {
      totalPagesFetched: number;
      afterBasicFilters: number;
      afterUserDataEnhancement: number;
      filteredByUnverified: number;
      filteredByLikelySpam: number;
      usersWithoutDocuments: number;
      finalCount: number;
      usedSafetyValve?: boolean;
    } = {
      totalPagesFetched: 0,
      afterBasicFilters: 0,
      afterUserDataEnhancement: 0,
      filteredByUnverified: 0,
      filteredByLikelySpam: 0,
      usersWithoutDocuments: 0,
      finalCount: 0
    };

    // Only backfill on initial request (no cursor) and when filters are active
    const shouldAttemptBackfill = !cursor && (hideUnverified || hideLikelySpam);

    for (const timeWindowDays of BACKFILL_INCREMENTS) {
      currentTimeWindowDays = timeWindowDays;

      // Skip backfill attempts if we already have enough results or this is a paginated request
      if (allEnhancedEdits.length >= limit || (cursor && backfillAttempts > 0)) {
        break;
      }

      const cutoffDate = new Date(Date.now() - (timeWindowDays * 24 * 60 * 60 * 1000));

      let pagesQuery = db.collection(pagesCollectionName)
        .where('lastModified', '>=', cutoffDate.toISOString())
        .orderBy('lastModified', 'desc');

      // Add cursor support for pagination
      if (cursor) {
        pagesQuery = pagesQuery.startAfter(cursor);
      }

      // Fetch more documents to account for filtering
      // When backfilling, fetch even more to increase chances of finding good content
      const fetchMultiplier = backfillAttempts > 0 ? 5 : (userId ? 3 : 2);
      const fetchLimit = Math.min(limit * fetchMultiplier, backfillAttempts > 0 ? 100 : 50);
      pagesQuery = pagesQuery.limit(fetchLimit);

      const queryStartTime = Date.now();
      const pagesSnapshot = await pagesQuery.get();
      const queryTime = Date.now() - queryStartTime;

      // Track query for cost optimization monitoring
      trackFirebaseRead('pages', 'global-recent-edits', pagesSnapshot.docs.length, 'api-recent-edits');

      if (pagesSnapshot.empty) {
        backfillAttempts++;
        if (!shouldAttemptBackfill) break;
        continue;
      }

      const pages: any[] = pagesSnapshot.docs.map(doc => {
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

      _diagnostics.totalPagesFetched += pages.length;

      // Filter pages based on criteria (same logic as homepage)
      const filteredPages = pages.filter(page => {
        // Skip deleted pages (double check)
        if (page.deleted === true) {
          return false;
        }

        // Skip private pages (isPublic === false) unless it's the user's own page
        if (page.isPublic === false && page.userId !== userId) {
          return false;
        }

        // FIXED: Hide my edits logic - when includeOwn is false, exclude user's own pages
        if (!includeOwn && page.userId === userId) {
          return false;
        }

        // FIXED: Following only filter - only show pages from users we follow
        if (followingOnly && followedUserIds !== null) {
          if (!page.userId || !followedUserIds.has(page.userId)) {
            return false;
          }
        }

        return true;
      });

      _diagnostics.afterBasicFilters += filteredPages.length;

      // Convert to edits format
      const edits = filteredPages
        .slice(0, limit * 2) // Take more than needed for spam filtering
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
            // Page quality score (admin-only visibility)
            pageScore: page.pageScore ?? null,
            pageScoreFactors: page.pageScoreFactors ?? null,
            source: 'pages-collection'
          };
        });

      // Fetch subscription data for all unique user IDs
      const uniqueUserIds = [...new Set(edits.map(edit => edit.userId).filter(Boolean))];
      const batchUserData = await fetchBatchUserData(uniqueUserIds, db);

      // Enhance edits with user and subscription data
      const enhancedEditsPreFilter = edits
        .map(edit => {
          const userData = batchUserData[edit.userId];
          const hasUserDocument = userData !== undefined;

          // Track users without documents
          if (!hasUserDocument) {
            _diagnostics.usersWithoutDocuments++;
          }

          return {
            ...edit,
            // Use username from user data if available, fallback to page username
            username: userData?.username || edit.username,
            hasActiveSubscription: userData?.hasActiveSubscription || false,
            subscriptionTier: userData?.tier || null,
            subscriptionAmount: userData?.subscriptionAmount || null,
            // Include email verification status for filtering
            _emailVerified: userData?.emailVerified ?? false,
            _isAdmin: userData?.isAdmin ?? false,
            // Include risk score for spam filtering
            _riskScore: userData?.riskScore ?? null,
            // Include page count (single-page accounts are more likely spam)
            _pageCount: userData?.pageCount ?? 0,
            // Track if user document exists
            _hasUserDocument: hasUserDocument
          };
        });

      _diagnostics.afterUserDataEnhancement += enhancedEditsPreFilter.length;


      // Filter out pages from users with unverified email (admins bypass this check)
      // Only apply this filter when hideUnverified is true
      const afterUnverifiedFilter = enhancedEditsPreFilter.filter(edit => {
        // If hideUnverified is false, skip email verification check
        if (!hideUnverified) return true;
        // Admins always show
        if (edit._isAdmin) return true;
        // CRITICAL FIX: Established users (multiple pages) should show even if not email verified
        // This prevents filtering out legitimate users who just haven't verified email
        if (edit._pageCount >= 3) return true;
        // CRITICAL FIX: If user has no document but hideLikelySpam is OFF, be lenient
        // Users without documents are "unknown" not "proven spam"
        // The hideLikelySpam filter will handle them more aggressively if enabled
        if (!edit._hasUserDocument && !hideLikelySpam) return true;
        // Hide pages from unverified users with few pages
        if (edit._emailVerified !== true) {
          _diagnostics.filteredByUnverified++;
          return false;
        }
        return true;
      });

      // Filter out likely spam accounts when hideLikelySpam is enabled
      // Uses trust score threshold: < 50 means soft_challenge or lower (yellow/orange/red in admin)
      // Trust levels: 75-100 = allow (trusted), 50-74 = soft_challenge, 25-49 = hard_challenge, 0-24 = block
      const enhancedEdits = afterUnverifiedFilter
        .filter(edit => {
          // Skip filter if not enabled
          if (!hideLikelySpam) return true;
          // Admins always show
          if (edit._isAdmin) return true;
          // CRITICAL FIX: Established users should show even with lower trust score
          if (edit._pageCount >= 5) return true;
          // If we have a trust score, filter accounts at soft_challenge level or lower (score < 50)
          // This hides yellow/orange/red trust users from the feed
          if (edit._riskScore !== null && edit._riskScore < 50) {
            _diagnostics.filteredByLikelySpam++;
            return false;
          }
          // Single-page accounts from unverified users are more likely spam
          if (edit._pageCount <= 1 && edit._emailVerified !== true) {
            _diagnostics.filteredByLikelySpam++;
            return false;
          }
          return true;
        })
        // Remove internal fields from response
        .map(({ _emailVerified, _isAdmin, _riskScore, _pageCount, _hasUserDocument, ...edit }) => edit);

      // SAFETY VALVE: If all content was filtered and we have pre-filter pages,
      // relax filtering to show SOME content (better than empty feed)
      let editsToUse = enhancedEdits;
      if (enhancedEdits.length === 0 && enhancedEditsPreFilter.length > 0) {
        // Show the most trusted items from pre-filter results
        // Sort by trust score (nulls last, higher is better) and take up to limit
        const relaxedEdits = [...enhancedEditsPreFilter]
          .sort((a, b) => {
            // Prioritize: verified > has user doc > higher trust score
            if (a._emailVerified && !b._emailVerified) return -1;
            if (!a._emailVerified && b._emailVerified) return 1;
            if (a._hasUserDocument && !b._hasUserDocument) return -1;
            if (!a._hasUserDocument && b._hasUserDocument) return 1;
            const aTrust = a._riskScore ?? 50;
            const bTrust = b._riskScore ?? 50;
            return bTrust - aTrust; // Higher trust score first
          })
          .slice(0, limit)
          .map(({ _emailVerified, _isAdmin, _riskScore, _pageCount, _hasUserDocument, ...edit }) => edit);

        editsToUse = relaxedEdits;
        // Mark that we used the safety valve (for debugging)
        _diagnostics.usedSafetyValve = true;
      }

      // Deduplicate and merge with existing results (for backfill)
      const existingIds = new Set(allEnhancedEdits.map(e => e.id));
      const newEdits = editsToUse.filter(e => !existingIds.has(e.id));
      allEnhancedEdits = [...allEnhancedEdits, ...newEdits];

      // Determine if there are more pages available
      const totalFetched = pagesSnapshot.docs.length;
      hasMorePages = (filteredPages.length > limit) || (totalFetched >= fetchLimit);

      if (allEnhancedEdits.length > 0) {
        lastCursor = allEnhancedEdits[allEnhancedEdits.length - 1].lastModified;
      }

      // Check if we need to backfill
      if (allEnhancedEdits.length >= MIN_RESULTS_BEFORE_BACKFILL || !shouldAttemptBackfill) {
        break;
      }

      // If we're about to try a longer time window, mark that we're backfilling
      backfillAttempts++;
      if (backfillAttempts > 0 && timeWindowDays < MAX_BACKFILL_DAYS) {
        didBackfill = true;
      }
    }

    // Trim to requested limit
    const finalEdits = allEnhancedEdits.slice(0, limit);

    // Update diagnostics with final count
    _diagnostics.finalCount = finalEdits.length;

    // Update hasMore based on whether we have more than limit
    hasMorePages = allEnhancedEdits.length > limit || hasMorePages;

    // Update cursor to last item in final results
    const nextCursor = hasMorePages && finalEdits.length > 0
      ? finalEdits[finalEdits.length - 1].lastModified
      : null;

    const responseData = {
      edits: finalEdits,
      hasMore: hasMorePages,
      nextCursor: nextCursor,
      total: finalEdits.length,
      timestamp: new Date().toISOString(),
      // Include metadata about backfill and filtering (useful for debugging/UI hints)
      _meta: {
        timeWindowDays: currentTimeWindowDays,
        didBackfill,
        backfillAttempts,
        // Include filter diagnostics to help debug empty results
        diagnostics: _diagnostics
      }
    };

    return responseData;
    })();

    // Cache the result - use longer TTL for good results, shorter for empty
    // This allows backfill to retry quickly when spam filters produce empty results
    globalRecentEditsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);

  } catch (error) {
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
 * Calculate trust score server-side (mirrors client-side calculateClientRiskScore)
 * Used when riskScore/trustScore is not stored in the user document
 * Note: Higher scores = more trusted (100 = trusted, 0 = suspicious)
 */
function calculateServerRiskScore(userData: {
  createdAt?: any;
  emailVerified?: boolean;
  pageCount?: number;
  hasActiveSubscription?: boolean;
  isAdmin?: boolean;
}): number {
  let score = 50; // Start at medium trust

  // Account age increases trust (max +30 points)
  if (userData.createdAt) {
    const createdDate = userData.createdAt?.toDate?.()
      || (typeof userData.createdAt === 'string' ? new Date(userData.createdAt) : new Date());
    const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    if (ageInDays > 90) score += 30;
    else if (ageInDays > 30) score += 20;
    else if (ageInDays > 7) score += 10;
    else score -= 10; // New accounts are less trusted
  } else {
    score -= 10; // Unknown creation date
  }

  // Email verification increases trust (+15 points)
  if (userData.emailVerified) {
    score += 15;
  } else {
    score -= 5;
  }

  // Content creation shows engagement (+15 points max)
  const pageCount = userData.pageCount || 0;
  if (pageCount > 50) score += 15;
  else if (pageCount > 10) score += 10;
  else if (pageCount > 0) score += 5;
  else score -= 5; // No content yet

  // Subscription shows commitment (+10 points)
  if (userData.hasActiveSubscription) {
    score += 10;
  }

  // Admin users are trusted (+20 points)
  if (userData.isAdmin) {
    score += 20;
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
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

          const emailVerified = userData.emailVerified ?? false;
          const isAdmin = userData.isAdmin ?? false;
          const pageCount = userData.pageCount || userData.pagesCount || 0;

          // Calculate risk score if not stored - mirrors client-side calculation
          const storedRiskScore = userData.riskScore;
          const calculatedRiskScore = calculateServerRiskScore({
            createdAt: userData.createdAt,
            emailVerified,
            pageCount,
            hasActiveSubscription: isActive,
            isAdmin
          });

          results[doc.id] = {
            uid: doc.id,
            // Only use username field - displayName is deprecated
            username: userData.username,
            emailVerified,  // For hiding unverified users' pages from feed
            isAdmin,              // Admins bypass email verification check
            // Use stored risk score if available, otherwise calculate it
            riskScore: storedRiskScore ?? calculatedRiskScore,
            tier: String(effectiveTier), // Ensure tier is always a string
            subscriptionStatus: subscription?.status,
            subscriptionAmount: subscription?.amount,
            hasActiveSubscription: isActive,
            pageCount,
            followerCount: userData.followerCount || 0,
            viewCount: userData.viewCount || 0
          };
        });

      } catch (error) {
        // Silently continue to next batch
      }
    }

  } catch (error) {
    // Silently handle error
  }

  return results;
}
