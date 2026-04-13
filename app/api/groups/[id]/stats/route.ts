import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';

/**
 * GET /api/groups/[id]/stats - Get group stats (earnings history, page stats, member growth)
 * Owner/admin only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    // Fetch group doc
    const groupDoc = await db.collection(getCollectionName('groups')).doc(groupId).get();
    if (!groupDoc.exists || groupDoc.data()?.deleted) {
      return createErrorResponse('NOT_FOUND', 'Group not found');
    }

    const groupData = groupDoc.data()!;

    // Only owner or admin can view stats
    if (!groupData.memberIds?.includes(userId)) {
      return createErrorResponse('FORBIDDEN', 'Not a group member');
    }

    // Fetch earnings history from groupEarnings collection
    let earningsHistory: any[] = [];
    try {
      const earningsSnap = await db
        .collection(getCollectionName('groupEarnings'))
        .where('groupId', '==', groupId)
        .orderBy('month', 'desc')
        .limit(24)
        .get();

      earningsHistory = earningsSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          month: data.month,
          totalAllocationsReceived: data.totalAllocationsReceived || 0,
          distributions: data.distributions || [],
          pageEarnings: data.pageEarnings || [],
        };
      });
    } catch (indexError: any) {
      // Fallback if composite index missing
      if (indexError?.code === 9 || indexError?.message?.includes('index')) {
        const earningsSnap = await db
          .collection(getCollectionName('groupEarnings'))
          .where('groupId', '==', groupId)
          .get();

        earningsHistory = earningsSnap.docs
          .map((doc) => {
            const data = doc.data();
            return {
              month: data.month,
              totalAllocationsReceived: data.totalAllocationsReceived || 0,
              distributions: data.distributions || [],
              pageEarnings: data.pageEarnings || [],
            };
          })
          .sort((a, b) => b.month.localeCompare(a.month));
      } else {
        throw indexError;
      }
    }

    // Fetch group pages to compute per-page allocation totals
    let pageStats: any[] = [];
    try {
      const pagesSnap = await db
        .collection(getCollectionName('pages'))
        .where('groupId', '==', groupId)
        .where('deleted', '!=', true)
        .get();

      pageStats = pagesSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          pageId: doc.id,
          title: data.title || 'Untitled',
          authorId: data.authorId,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
        };
      });
    } catch {
      // Pages may not have the composite index, try simple query
      try {
        const pagesSnap = await db
          .collection(getCollectionName('pages'))
          .where('groupId', '==', groupId)
          .get();

        pageStats = pagesSnap.docs
          .filter((doc) => doc.data().deleted !== true)
          .map((doc) => {
            const data = doc.data();
            return {
              pageId: doc.id,
              title: data.title || 'Untitled',
              authorId: data.authorId,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
            };
          });
      } catch {
        // Ignore
      }
    }

    // Compute totals
    const totalEarnings = earningsHistory.reduce(
      (sum, r) => sum + (r.totalAllocationsReceived || 0),
      0
    );

    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentMonthEarnings =
      earningsHistory.find((r) => r.month === currentMonth)?.totalAllocationsReceived || 0;

    return createApiResponse({
      groupId,
      totalEarnings,
      currentMonthEarnings,
      earningsHistory,
      pageStats,
      memberCount: groupData.memberCount || groupData.memberIds?.length || 0,
      pageCount: groupData.pageCount || 0,
      fundDistribution: groupData.fundDistribution || {},
      createdAt: groupData.createdAt,
    });
  } catch (error: any) {
    console.error('[API] GET /api/groups/[id]/stats error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}
