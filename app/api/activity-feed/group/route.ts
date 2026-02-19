import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { getEffectiveTier } from '../../../utils/subscriptionTiers';
import { sanitizeUsername } from '../../../utils/usernameSecurity';

/**
 * GROUP ACTIVITY FEED API
 *
 * Fetches recent page edits for a specific group (group page activity tab).
 * Follows the same pattern as /api/recent-edits/user/route.ts.
 *
 * Query parameters:
 * - groupId: The group ID to fetch activity for (REQUIRED)
 * - limit: Maximum number of results (default: 20)
 * - cursor: Pagination cursor (lastModified timestamp)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const limitCount = parseInt(searchParams.get('limit') || '20');
    const cursor = searchParams.get('cursor');

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
    }

    let adminApp;
    try {
      adminApp = initAdmin();
      if (!adminApp) {
        return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
      }
    } catch {
      return NextResponse.json({ error: 'Firebase Admin initialization failed' }, { status: 500 });
    }

    const db = adminApp.firestore();

    // Query group pages ordered by lastModified
    let pagesQuery = db.collection(getCollectionName('pages'))
      .where('groupId', '==', groupId)
      .orderBy('lastModified', 'desc')
      .limit(limitCount + 1);

    if (cursor) {
      pagesQuery = pagesQuery.startAfter(cursor);
    }

    const snapshot = await pagesQuery.get();

    if (snapshot.empty) {
      return NextResponse.json({
        pages: [],
        total: 0,
        hasMore: false,
      });
    }

    const allDocs = snapshot.docs;
    const hasMore = allDocs.length > limitCount;
    const docs = hasMore ? allDocs.slice(0, limitCount) : allDocs;

    const pages = docs
      .map(doc => {
        const data = doc.data();
        const safeUsername = sanitizeUsername(
          data.username || data.authorName,
          'User',
          `user_${doc.id.slice(0, 8)}`
        );
        return {
          id: doc.id,
          ...data,
          username: safeUsername,
        };
      })
      .filter(page => page.deleted !== true);

    // Fetch subscription data for all unique user IDs
    const uniqueUserIds = [...new Set(pages.map(page => page.userId).filter(Boolean))] as string[];
    const batchUserData = await fetchBatchUserData(uniqueUserIds, db);

    const enhancedPages = pages.map(page => {
      const userData = batchUserData[page.userId];
      const username = sanitizeUsername(
        userData?.username || page.username,
        'User',
        `user_${page.userId?.slice(0, 8) || 'unknown'}`
      );
      return {
        ...page,
        username,
        hasActiveSubscription: userData?.hasActiveSubscription || false,
        subscriptionTier: userData?.tier || null,
        subscriptionAmount: userData?.subscriptionAmount || null,
        lastDiff: page.lastDiff,
        diffPreview: page.diffPreview || page.lastDiff?.preview || null,
      };
    });

    const nextCursor = hasMore && enhancedPages.length > 0
      ? enhancedPages[enhancedPages.length - 1].lastModified
      : null;

    return NextResponse.json({
      pages: enhancedPages,
      total: enhancedPages.length,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error('[GROUP_ACTIVITY_FEED] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group activity feed' },
      { status: 500 }
    );
  }
}

async function fetchBatchUserData(userIds: string[], db: any): Promise<Record<string, any>> {
  if (userIds.length === 0) return {};

  const results: Record<string, any> = {};

  try {
    const batchSize = 10;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      try {
        const userPromises = batch.map(async (userId) => {
          try {
            const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
            return { userId, data: userDoc.exists ? userDoc.data() : null };
          } catch {
            return { userId, data: null };
          }
        });

        const userResults = await Promise.all(userPromises);

        const subscriptionPromises = batch.map(async (userId) => {
          try {
            const { parentPath, subCollectionName } = getSubCollectionPath(
              PAYMENT_COLLECTIONS.USERS,
              userId,
              PAYMENT_COLLECTIONS.SUBSCRIPTIONS
            );
            const subDoc = await db.doc(parentPath).collection(subCollectionName).doc('current').get();
            const subscriptionData = subDoc.exists ? subDoc.data() : null;
            const effectiveTier = getEffectiveTier(
              subscriptionData?.amount || null,
              subscriptionData?.tier || null,
              subscriptionData?.status || null
            );
            const isActive = subscriptionData?.status === 'active' || subscriptionData?.status === 'trialing';
            return {
              userId,
              subscription: {
                hasActiveSubscription: isActive,
                tier: String(effectiveTier),
                subscriptionAmount: subscriptionData?.amount || null,
              },
            };
          } catch {
            return {
              userId,
              subscription: {
                hasActiveSubscription: false,
                tier: null,
                subscriptionAmount: null,
              },
            };
          }
        });

        const subscriptionResults = await Promise.all(subscriptionPromises);

        userResults.forEach(({ userId, data }) => {
          const subscriptionData = subscriptionResults.find(s => s.userId === userId)?.subscription || {};
          results[userId] = {
            username: data?.username || null,
            ...subscriptionData,
          };
        });
      } catch {
        // Continue with next batch
      }
    }
  } catch {
    // Return partial results
  }

  return results;
}
