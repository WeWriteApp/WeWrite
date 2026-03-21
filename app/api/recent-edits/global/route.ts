import { NextRequest, NextResponse } from 'next/server';
import { getCollectionNameAsync, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { getEffectiveTier } from '../../../utils/subscriptionTiers';
import { getUserIdFromRequest } from '../../auth-helper';
import { trackFirebaseRead } from '../../../utils/costMonitor';
import { sanitizeUsername } from '../../../utils/usernameSecurity';
import { getAdminFirestore } from '../../../firebase/firebaseAdmin';
import { getBatchPageViewData } from '../../../services/pageViewService';
import { computeFeedScore, passesQualityFilter, type FeedScore } from '../../../services/feedRankingService';

// EMERGENCY COST OPTIMIZATION: Global cache for recent edits
const globalRecentEditsCache = new Map<string, { data: any; timestamp: number }>();

let _adminDb: ReturnType<typeof getAdminFirestore> | null = null;
function getDb() {
  if (!_adminDb) _adminDb = getAdminFirestore();
  return _adminDb;
}

/**
 * GLOBAL ACTIVITY FEED API
 *
 * Supports two feed modes:
 * - feedMode=latest: Chronological feed (ORDER BY lastModified DESC)
 * - feedMode=top: Algorithmic feed ranked by engagement, quality, freshness, and trust
 *
 * Spam filtering uses a single feedQuality parameter:
 * - strict: trust >= 70
 * - balanced (default): trust >= 40
 * - relaxed: trust >= 15
 * - off: no filter
 *
 * Legacy parameters (hideUnverified, hideLikelySpam) are mapped to feedQuality for backward compatibility.
 *
 * @deprecated Use /api/activity-feed/global instead. This route is kept for backward compatibility.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    let userId = searchParams.get('userId');
    if (!userId) {
      userId = await getUserIdFromRequest(request);
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 20);
    const includeOwn = searchParams.get('includeOwn') === 'true';
    const followingOnly = searchParams.get('followingOnly') === 'true';
    const cursor = searchParams.get('cursor');

    // Feed mode: 'top' (algorithmic) or 'latest' (chronological)
    const feedMode = searchParams.get('feedMode') === 'latest' ? 'latest' : 'top';

    // Feed quality filter — new unified parameter
    // Backward compatibility: map old toggles to feedQuality if new param not provided
    let feedQuality = searchParams.get('feedQuality');
    if (!feedQuality) {
      const hideUnverified = searchParams.get('hideUnverified') !== 'false';
      const hideLikelySpam = searchParams.get('hideLikelySpam') === 'true';
      if (hideLikelySpam && hideUnverified) feedQuality = 'strict';
      else if (hideUnverified) feedQuality = 'balanced';
      else feedQuality = 'relaxed';
    }

    // Cache
    const CACHE_TTL = 10 * 1000;
    const EMPTY_CACHE_TTL = 2 * 1000;
    const cacheKey = `recent-edits:global:${userId || 'anon'}:${limit}:${includeOwn}:${followingOnly}:${feedMode}:${feedQuality}:${cursor || 'first'}`;

    const cached = globalRecentEditsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < (cached.data?.edits?.length > 0 ? CACHE_TTL : EMPTY_CACHE_TTL)) {
      return NextResponse.json(cached.data);
    }

    const responseData = await (async () => {
      const db = getDb();
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

      // BACKFILL LOGIC: When quality filter removes too much content, expand time window
      const MIN_RESULTS_BEFORE_BACKFILL = Math.ceil(limit * 0.5);
      // For algorithmic mode, start with a wider window since we're ranking anyway
      const BACKFILL_INCREMENTS = feedMode === 'top' ? [7, 30, 90, 180] : [30, 60, 90, 180];

      let currentTimeWindowDays = BACKFILL_INCREMENTS[0];
      let allEnhancedEdits: any[] = [];
      let hasMorePages = false;
      let backfillAttempts = 0;
      let didBackfill = false;

      let _diagnostics = {
        totalPagesFetched: 0,
        afterBasicFilters: 0,
        filteredByQuality: 0,
        finalCount: 0,
        feedMode,
        feedQuality,
        usedSafetyValve: false,
      };

      const shouldAttemptBackfill = !cursor && feedQuality !== 'off';

      for (const timeWindowDays of BACKFILL_INCREMENTS) {
        currentTimeWindowDays = timeWindowDays;

        if (allEnhancedEdits.length >= limit || (cursor && backfillAttempts > 0)) {
          break;
        }

        const cutoffDate = new Date(Date.now() - (timeWindowDays * 24 * 60 * 60 * 1000));

        let pagesQuery = db.collection(pagesCollectionName)
          .where('lastModified', '>=', cutoffDate.toISOString())
          .orderBy('lastModified', 'desc');

        if (cursor) {
          pagesQuery = pagesQuery.startAfter(cursor);
        }

        const fetchMultiplier = backfillAttempts > 0 ? 5 : (userId ? 3 : 2);
        const fetchLimit = Math.min(limit * fetchMultiplier, backfillAttempts > 0 ? 100 : 50);
        pagesQuery = pagesQuery.limit(fetchLimit);

        const pagesSnapshot = await pagesQuery.get();
        trackFirebaseRead('pages', 'global-recent-edits', pagesSnapshot.docs.length, 'api-recent-edits');

        if (pagesSnapshot.empty) {
          backfillAttempts++;
          if (!shouldAttemptBackfill) break;
          continue;
        }

        const pages: any[] = pagesSnapshot.docs.map(doc => {
          const data = doc.data();
          const safeUsername = sanitizeUsername(
            (data as any).username || (data as any).authorName,
            'User',
            `user_${doc.id.slice(0, 8)}`
          );
          return { id: doc.id, ...data, username: safeUsername };
        });

        _diagnostics.totalPagesFetched += pages.length;

        // Basic filters (deleted, private, own, following)
        const filteredPages = pages.filter(page => {
          if (page.deleted === true) return false;
          if (page.isPublic === false && page.userId !== userId) return false;
          if (!includeOwn && page.userId === userId) return false;
          if (followingOnly && followedUserIds !== null) {
            if (!page.userId || !followedUserIds.has(page.userId)) return false;
          }
          return true;
        });

        _diagnostics.afterBasicFilters += filteredPages.length;

        // Convert to edits format
        const edits = filteredPages.slice(0, limit * 2).map(page => {
          const replyPreview = deriveReplyPreview(page);
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
            pageScore: page.pageScore ?? null,
            pageScoreFactors: page.pageScoreFactors ?? null,
            source: 'pages-collection'
          };
        });

        // Fetch user data
        const uniqueUserIds = [...new Set(edits.map(edit => edit.userId).filter(Boolean))];
        const batchUserData = await fetchBatchUserData(uniqueUserIds, db);

        // Enhance edits with user data + internal fields for filtering
        const enhancedEditsPreFilter = edits.map(edit => {
          const userData = batchUserData[edit.userId];
          return {
            ...edit,
            username: userData?.username || edit.username,
            hasActiveSubscription: userData?.hasActiveSubscription || false,
            subscriptionTier: userData?.tier || null,
            subscriptionAmount: userData?.subscriptionAmount || null,
            _isAdmin: userData?.isAdmin ?? false,
            _riskScore: userData?.riskScore ?? 30, // Default to low-medium trust
            _followerCount: userData?.followerCount ?? 0,
          };
        });

        // Apply unified quality filter
        const afterQualityFilter = enhancedEditsPreFilter.filter(edit => {
          const passes = passesQualityFilter(
            edit._riskScore,
            edit.pageScore,
            feedQuality!,
            edit._isAdmin
          );
          if (!passes) _diagnostics.filteredByQuality++;
          return passes;
        });

        // SAFETY VALVE: If all content filtered, show most trusted items
        let editsToUse = afterQualityFilter;
        if (afterQualityFilter.length === 0 && enhancedEditsPreFilter.length > 0) {
          editsToUse = [...enhancedEditsPreFilter]
            .sort((a, b) => (b._riskScore) - (a._riskScore))
            .slice(0, limit);
          _diagnostics.usedSafetyValve = true;
        }

        // Fetch community signals for algorithmic ranking
        let viewDataMap: Map<string, { total: number; hourly: number[] }> | null = null;
        let replyCountMap: Map<string, number> | null = null;
        let backlinkCountMap: Map<string, number> | null = null;
        let supporterCountMap: Map<string, number> | null = null;

        if (feedMode === 'top' && editsToUse.length > 0) {
          const pageIds = editsToUse.map(e => e.id);
          // Fetch all community signals in parallel
          const [viewData, replyCounts, backlinkCounts, supporterCounts] = await Promise.all([
            getBatchPageViewData(db, pageIds),
            getBatchReplyCounts(db, pageIds),
            getBatchBacklinkCounts(db, pageIds),
            getBatchSupporterCounts(db, pageIds),
          ]);
          viewDataMap = viewData;
          replyCountMap = replyCounts;
          backlinkCountMap = backlinkCounts;
          supporterCountMap = supporterCounts;
        }

        // Compute feed scores and strip internal fields
        const finalEditsForWindow = editsToUse.map(({ _isAdmin, _riskScore, _followerCount, ...edit }) => {
          let feedScore: FeedScore | undefined;
          if (feedMode === 'top') {
            feedScore = computeFeedScore({
              replyCount: replyCountMap?.get(edit.id) ?? 0,
              backlinkCount: backlinkCountMap?.get(edit.id) ?? 0,
              supporterCount: supporterCountMap?.get(edit.id) ?? 0,
              followerCount: _followerCount,
              views24h: viewDataMap?.get(edit.id)?.total ?? 0,
              pageScore: edit.pageScore,
              lastModified: edit.lastModified,
              authorTrustScore: _riskScore,
            });
          }
          return { ...edit, feedScore: feedScore?.total ?? null };
        });

        // Deduplicate and merge
        const existingIds = new Set(allEnhancedEdits.map(e => e.id));
        const newEdits = finalEditsForWindow.filter(e => !existingIds.has(e.id));
        allEnhancedEdits = [...allEnhancedEdits, ...newEdits];

        const totalFetched = pagesSnapshot.docs.length;
        hasMorePages = (filteredPages.length > limit) || (totalFetched >= fetchLimit);

        if (allEnhancedEdits.length >= MIN_RESULTS_BEFORE_BACKFILL || !shouldAttemptBackfill) {
          break;
        }

        backfillAttempts++;
        if (backfillAttempts > 0 && timeWindowDays < BACKFILL_INCREMENTS[BACKFILL_INCREMENTS.length - 1]) {
          didBackfill = true;
        }
      }

      // Sort by feed score in algorithmic mode, chronological in latest mode
      if (feedMode === 'top') {
        allEnhancedEdits.sort((a, b) => (b.feedScore ?? 0) - (a.feedScore ?? 0));
      }
      // In 'latest' mode, the Firestore query already returns in chronological order

      const finalEdits = allEnhancedEdits.slice(0, limit);
      _diagnostics.finalCount = finalEdits.length;

      hasMorePages = allEnhancedEdits.length > limit || hasMorePages;

      const nextCursor = hasMorePages && finalEdits.length > 0
        ? finalEdits[finalEdits.length - 1].lastModified
        : null;

      return {
        edits: finalEdits,
        hasMore: hasMorePages,
        nextCursor,
        total: finalEdits.length,
        timestamp: new Date().toISOString(),
        _meta: {
          feedMode,
          feedQuality,
          timeWindowDays: currentTimeWindowDays,
          didBackfill,
          backfillAttempts,
          diagnostics: _diagnostics
        }
      };
    })();

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
 * Derive a friendly preview for reply/agree/disagree pages
 */
function deriveReplyPreview(page: any) {
  const isReply = page.isReply || !!page.replyTo;
  if (!isReply) return null;

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
    } catch (_err) { /* ignore */ }
  }

  const author = page.username || 'Unknown user';
  const pageTitle = page.title || 'Untitled';
  const targetTitle = page.replyToTitle || 'the original page';

  let action = 'as a reply to';
  if (replyType === 'agree') action = 'to agree with';
  if (replyType === 'disagree') action = 'to disagree with';

  return {
    beforeContext: '',
    addedText: `${pageTitle} was created by ${author} ${action} ${targetTitle}`,
    removedText: '',
    afterContext: '',
    hasAdditions: true,
    hasRemovals: false
  };
}

/**
 * Calculate trust score server-side
 * Higher scores = more trusted (100 = trusted, 0 = suspicious)
 */
function calculateServerRiskScore(userData: {
  createdAt?: any;
  emailVerified?: boolean;
  pageCount?: number;
  hasActiveSubscription?: boolean;
  isAdmin?: boolean;
}): number {
  let score = 50;

  if (userData.createdAt) {
    const createdDate = userData.createdAt?.toDate?.()
      || (typeof userData.createdAt === 'string' ? new Date(userData.createdAt) : new Date());
    const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    if (ageInDays > 90) score += 30;
    else if (ageInDays > 30) score += 20;
    else if (ageInDays > 7) score += 10;
    else score -= 10;
  } else {
    score -= 10;
  }

  if (userData.emailVerified) score += 15;
  else score -= 5;

  const pageCount = userData.pageCount || 0;
  if (pageCount > 50) score += 15;
  else if (pageCount > 10) score += 10;
  else if (pageCount > 0) score += 5;
  else score -= 5;

  if (userData.hasActiveSubscription) score += 10;
  if (userData.isAdmin) score += 20;

  return Math.max(0, Math.min(100, score));
}

/**
 * Fetch batch user data including subscription information
 */
async function fetchBatchUserData(userIds: string[], db: any): Promise<Record<string, any>> {
  if (userIds.length === 0) return {};

  const results: Record<string, any> = {};

  try {
    const batchSize = 10;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      try {
        const usersCollectionName = await getCollectionNameAsync('users');
        const usersQuery = db.collection(usersCollectionName).where('__name__', 'in', batch);
        const usersSnapshot = await usersQuery.get();

        const subscriptionPromises = batch.map(async (uid) => {
          try {
            const { parentPath, subCollectionName } = getSubCollectionPath(
              PAYMENT_COLLECTIONS.USERS, uid, PAYMENT_COLLECTIONS.SUBSCRIPTIONS
            );
            const subDoc = await db.doc(parentPath).collection(subCollectionName).doc('current').get();
            return { userId: uid, subscription: subDoc.exists ? subDoc.data() : null };
          } catch {
            return { userId: uid, subscription: null };
          }
        });

        const subscriptionResults = await Promise.all(subscriptionPromises);
        const subscriptionMap = new Map(subscriptionResults.map(r => [r.userId, r.subscription]));

        usersSnapshot.forEach((doc: any) => {
          const userData = doc.data();
          const subscription = subscriptionMap.get(doc.id);

          const effectiveTier = getEffectiveTier(
            subscription?.amount || null,
            subscription?.tier || null,
            subscription?.status || null
          );

          const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
          const emailVerified = userData.emailVerified ?? false;
          const isAdmin = userData.isAdmin ?? false;
          const pageCount = userData.pageCount || userData.pagesCount || 0;

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
            username: userData.username,
            emailVerified,
            isAdmin,
            riskScore: storedRiskScore ?? calculatedRiskScore,
            tier: String(effectiveTier),
            subscriptionStatus: subscription?.status,
            subscriptionAmount: subscription?.amount,
            hasActiveSubscription: isActive,
            pageCount,
            followerCount: userData.followerCount || 0,
            viewCount: userData.viewCount || 0
          };
        });
      } catch {
        // Silently continue to next batch
      }
    }
  } catch {
    // Silently handle error
  }

  return results;
}

/**
 * Batch fetch reply counts for multiple pages.
 * Queries the pages collection for documents where replyTo is one of the given page IDs.
 * Uses Firestore 'in' queries (max 30 per batch).
 */
async function getBatchReplyCounts(db: any, pageIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (pageIds.length === 0) return result;

  // Initialize all to 0
  for (const id of pageIds) result.set(id, 0);

  try {
    const pagesCollectionName = await getCollectionNameAsync('pages');
    const batchSize = 30; // Firestore 'in' limit

    for (let i = 0; i < pageIds.length; i += batchSize) {
      const batch = pageIds.slice(i, i + batchSize);
      const snapshot = await db.collection(pagesCollectionName)
        .where('replyTo', 'in', batch)
        .where('deleted', '!=', true)
        .select('replyTo') // Only fetch the field we need
        .get();

      snapshot.forEach((doc: any) => {
        const replyTo = doc.data().replyTo;
        if (replyTo) {
          result.set(replyTo, (result.get(replyTo) || 0) + 1);
        }
      });
    }
  } catch (error: any) {
    console.warn('[Feed] Error fetching reply counts:', error?.message);
  }

  return result;
}

/**
 * Batch fetch backlink counts for multiple pages.
 * Queries the backlinks collection for documents where targetPageId is one of the given page IDs.
 */
async function getBatchBacklinkCounts(db: any, pageIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (pageIds.length === 0) return result;

  for (const id of pageIds) result.set(id, 0);

  try {
    const backlinksCollectionName = await getCollectionNameAsync('backlinks');
    const batchSize = 30;

    for (let i = 0; i < pageIds.length; i += batchSize) {
      const batch = pageIds.slice(i, i + batchSize);
      const snapshot = await db.collection(backlinksCollectionName)
        .where('targetPageId', 'in', batch)
        .where('isPublic', '==', true)
        .select('targetPageId')
        .get();

      snapshot.forEach((doc: any) => {
        const targetPageId = doc.data().targetPageId;
        if (targetPageId) {
          result.set(targetPageId, (result.get(targetPageId) || 0) + 1);
        }
      });
    }
  } catch (error: any) {
    console.warn('[Feed] Error fetching backlink counts:', error?.message);
  }

  return result;
}

/**
 * Batch fetch supporter counts for multiple pages.
 * Queries the usdAllocations collection for active allocations to the given page IDs.
 */
async function getBatchSupporterCounts(db: any, pageIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (pageIds.length === 0) return result;

  for (const id of pageIds) result.set(id, 0);

  try {
    const allocationsCollectionName = await getCollectionNameAsync('usdAllocations');
    const batchSize = 30;

    for (let i = 0; i < pageIds.length; i += batchSize) {
      const batch = pageIds.slice(i, i + batchSize);
      const snapshot = await db.collection(allocationsCollectionName)
        .where('resourceId', 'in', batch)
        .where('status', '==', 'active')
        .select('resourceId', 'userId')
        .get();

      // Count unique supporters per page
      const supportersByPage = new Map<string, Set<string>>();
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        if (data.resourceId && data.userId) {
          if (!supportersByPage.has(data.resourceId)) {
            supportersByPage.set(data.resourceId, new Set());
          }
          supportersByPage.get(data.resourceId)!.add(data.userId);
        }
      });

      for (const [pageId, supporters] of supportersByPage) {
        result.set(pageId, supporters.size);
      }
    }
  } catch (error: any) {
    console.warn('[Feed] Error fetching supporter counts:', error?.message);
  }

  return result;
}
