import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { withAdminContext } from '../../../../utils/adminRequestContext';

export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
  try {
    // Check authentication and admin access
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json(
        { success: false, error: adminCheck.error },
        { status: adminCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const granularity = parseInt(searchParams.get('granularity') || '24');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const admin = getFirebaseAdmin();
    const adminDb = admin.firestore();

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate time intervals based on granularity
    const intervalMs = granularity * 60 * 60 * 1000; // Convert hours to milliseconds
    const intervals: { start: Date; end: Date; label: string }[] = [];

    for (let time = start.getTime(); time < end.getTime(); time += intervalMs) {
      intervals.push({
        start: new Date(time),
        end: new Date(Math.min(time + intervalMs, end.getTime())),
        label: new Date(time).toLocaleDateString()
      });
    }

    // Try to get data from the follows collection first
    let followsSnapshot;
    let hasFollowsData = false;

    try {
      // Query follows collection for user follows in the date range
      const followsQuery = adminDb.collection(getCollectionName('follows'))
        .where('followedAt', '>=', start)
        .where('followedAt', '<=', end)
        .orderBy('followedAt', 'asc');

      followsSnapshot = await followsQuery.get();
      hasFollowsData = followsSnapshot.size > 0;
    } catch (indexError) {
      // Index might not exist yet, try without date filtering
      try {
        followsSnapshot = await adminDb.collection(getCollectionName('follows')).get();
        hasFollowsData = followsSnapshot.size > 0;
      } catch (e) {
        followsSnapshot = { docs: [], size: 0 };
      }
    }

    // If no data in follows collection, fall back to counting from userFollowing collection
    if (!hasFollowsData) {

      // Get all userFollowing documents to count total follows
      const userFollowingSnapshot = await adminDb.collection(getCollectionName('userFollowing')).get();

      let totalFollowCount = 0;
      const allFollowingData: { userId: string; following: string[]; updatedAt?: Date }[] = [];

      userFollowingSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const following = data.following || [];
        totalFollowCount += following.length;

        // Get updatedAt if available for rough time distribution
        const updatedAt = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || null;
        if (following.length > 0) {
          allFollowingData.push({
            userId: doc.id,
            following,
            updatedAt
          });
        }
      });

      // If we have follow data but no timestamps, distribute it evenly across the date range
      // This provides a rough visualization until backfill is complete
      if (totalFollowCount > 0) {
        // Create time-based distribution (spread follows across the date range)
        const data = intervals.map((interval, index) => {
          // Distribute follows based on which have updatedAt in this interval
          let followsInInterval = 0;

          allFollowingData.forEach(userData => {
            if (userData.updatedAt &&
                userData.updatedAt >= interval.start &&
                userData.updatedAt < interval.end) {
              followsInInterval += userData.following.length;
            }
          });

          return {
            date: interval.start.toISOString(),
            label: interval.label,
            count: followsInInterval,
            uniqueFollowers: 0,
            uniqueFollowed: 0,
            totalFollows: followsInInterval
          };
        });

        // Calculate cumulative data
        let cumulativeCount = 0;
        const cumulativeData = data.map(point => {
          cumulativeCount += point.count;
          return {
            ...point,
            cumulativeCount
          };
        });

        return NextResponse.json({
          success: true,
          data: cumulativeData,
          summary: {
            totalFollows: totalFollowCount,
            totalUniqueFollowers: userFollowingSnapshot.size,
            totalUniqueFollowed: 0,
            dateRange: { startDate, endDate },
            granularity,
            note: 'Data from userFollowing collection - timestamps may not be accurate. Run backfill script for precise data.'
          }
        });
      }
    }

    // Process data from follows collection into time intervals
    const data = intervals.map(interval => {
      const followsInInterval = (followsSnapshot?.docs || []).filter(doc => {
        const docData = doc.data();
        // Handle deleted follows
        if (docData.deleted === true) return false;

        const followedAt = docData.followedAt?.toDate?.();
        if (!followedAt) return false;

        return followedAt >= interval.start && followedAt < interval.end;
      });

      // Count unique followers (users who followed someone)
      const uniqueFollowers = new Set<string>();
      const uniqueFollowed = new Set<string>();

      followsInInterval.forEach(doc => {
        const docData = doc.data();
        if (docData.followerId) uniqueFollowers.add(docData.followerId);
        if (docData.followedId) uniqueFollowed.add(docData.followedId);
      });

      return {
        date: interval.start.toISOString(),
        label: interval.label,
        count: followsInInterval.length, // Total follow actions
        uniqueFollowers: uniqueFollowers.size, // Unique users who followed someone
        uniqueFollowed: uniqueFollowed.size, // Unique users who were followed
        // For cumulative view compatibility
        totalFollows: followsInInterval.length
      };
    });

    // Calculate cumulative data for cumulative view
    let cumulativeCount = 0;
    const cumulativeData = data.map(point => {
      cumulativeCount += point.count;
      return {
        ...point,
        cumulativeCount
      };
    });

    return NextResponse.json({
      success: true,
      data: cumulativeData,
      summary: {
        totalFollows: followsSnapshot?.size || 0,
        totalUniqueFollowers: new Set((followsSnapshot?.docs || []).map(doc => doc.data().followerId)).size,
        totalUniqueFollowed: new Set((followsSnapshot?.docs || []).map(doc => doc.data().followedId)).size,
        dateRange: { startDate, endDate },
        granularity
      }
    });

  } catch (error) {
    console.error('Error fetching followed users analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch followed users analytics' },
      { status: 500 }
    );
  }
  }); // End withAdminContext
}
