import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';

export async function GET(request: NextRequest) {
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
    const intervals = [];
    
    for (let time = start.getTime(); time < end.getTime(); time += intervalMs) {
      intervals.push({
        start: new Date(time),
        end: new Date(Math.min(time + intervalMs, end.getTime())),
        label: new Date(time).toLocaleDateString()
      });
    }

    // Query follows collection for user follows in the date range
    const followsQuery = adminDb.collection(getCollectionName('follows'))
      .where('followedAt', '>=', start)
      .where('followedAt', '<=', end)
      .orderBy('followedAt', 'asc');

    const followsSnapshot = await followsQuery.get();
    
    // Process data into time intervals
    const data = intervals.map(interval => {
      const followsInInterval = followsSnapshot.docs.filter(doc => {
        const followedAt = doc.data().followedAt?.toDate();
        return followedAt && followedAt >= interval.start && followedAt < interval.end;
      });

      // Count unique followers (users who followed someone)
      const uniqueFollowers = new Set();
      const uniqueFollowed = new Set();
      
      followsInInterval.forEach(doc => {
        const data = doc.data();
        if (data.followerId) uniqueFollowers.add(data.followerId);
        if (data.followedId) uniqueFollowed.add(data.followedId);
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
        totalFollows: followsSnapshot.size,
        totalUniqueFollowers: new Set(followsSnapshot.docs.map(doc => doc.data().followerId)).size,
        totalUniqueFollowed: new Set(followsSnapshot.docs.map(doc => doc.data().followedId)).size,
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
}
