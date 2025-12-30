import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionNameAsync, COLLECTIONS } from '../../../../utils/environmentConfig';
import { trackFirebaseRead } from '../../../../utils/costMonitor';
import { recordProductionRead } from '../../../../utils/productionReadMonitor';

/**
 * User Profile Stats API
 *
 * Returns aggregated stats for a user profile:
 * - Account creation date
 * - Total page count
 * - Total sponsors (people supporting this user)
 * - Total sponsoring (pages/users this user is sponsoring)
 * - 30-day rolling history for sparklines (from real snapshots or flat line fallback)
 */

const SPARKLINE_DAYS = 30;

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateNDaysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Generate flat sparkline data as fallback when no historical data exists
// Shows a flat line at the current value (honest representation of "no historical data")
function generateSparklineData(currentValue: number, days: number = SPARKLINE_DAYS): number[] {
  // Return a flat line - all values are the current value
  // This honestly represents "we don't have historical data" rather than faking trends
  return Array(days).fill(currentValue);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const startTime = Date.now();

  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log(`[User Stats API] Fetching stats for user: ${userId}`);

    trackFirebaseRead('users', 'getUserStats', 1, 'api-user-stats');

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Fetch user document to get createdAt
    const usersCollection = await getCollectionNameAsync(COLLECTIONS.USERS);
    const userDoc = await db.collection(usersCollection).doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const createdAt = userData?.createdAt;

    // Get current page count
    const pagesCollection = await getCollectionNameAsync(COLLECTIONS.PAGES);
    const pagesSnapshot = await db.collection(pagesCollection)
      .where('userId', '==', userId)
      .get();
    const pageCount = pagesSnapshot.docs.filter(doc => !doc.data().isDeleted).length;

    // Get current sponsors count (unique users who have allocated funds TO this user)
    const allocationsCollection = await getCollectionNameAsync(COLLECTIONS.USD_ALLOCATIONS);
    const userAllocationsSnapshot = await db.collection(allocationsCollection)
      .where('recipientUserId', '==', userId)
      .where('status', '==', 'active')
      .get();

    const sponsorIds = new Set<string>();
    userAllocationsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // userId is the donor (the person allocating funds)
      if (data.userId && data.userId !== userId) {
        sponsorIds.add(data.userId);
      }
    });
    const sponsorsCount = sponsorIds.size;

    // Get current sponsoring count (how many allocations this user has made to others)
    const sponsoringSnapshot = await db.collection(allocationsCollection)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .count()
      .get();
    const sponsoringCount = sponsoringSnapshot.data().count;

    // Try to fetch historical snapshots for sparklines
    const snapshotsCollection = await getCollectionNameAsync(COLLECTIONS.USER_STATS_SNAPSHOTS);
    const startDate = getDateNDaysAgo(SPARKLINE_DAYS);
    const startDateStr = formatDate(startDate);

    // Query snapshots for this user - simple query without composite index requirement
    // Filter by date client-side to avoid needing userId + date composite index
    const snapshotsQuery = await db.collection(snapshotsCollection)
      .where('userId', '==', userId)
      .get();

    // Filter to last 60 days client-side
    const filteredDocs = snapshotsQuery.docs.filter(doc => {
      const docDate = doc.data().date;
      return docDate >= startDateStr;
    });

    let sparklines: {
      pages: number[];
      sponsors: number[];
      sponsoring: number[];
    };

    if (filteredDocs.length < 7) {
      // Not enough historical data - use generated sparklines
      console.log(`[User Stats API] No/insufficient snapshots for ${userId} (found ${filteredDocs.length}), using generated data`);
      sparklines = {
        pages: generateSparklineData(pageCount),
        sponsors: generateSparklineData(sponsorsCount),
        sponsoring: generateSparklineData(sponsoringCount),
      };
    } else {
      // Build sparklines from real historical data
      console.log(`[User Stats API] Found ${filteredDocs.length} snapshots for ${userId}`);

      // Create a map of date -> snapshot data
      const snapshotMap = new Map<string, { pages: number; sponsors: number; sponsoring: number }>();
      filteredDocs.forEach(doc => {
        const data = doc.data();
        snapshotMap.set(data.date, {
          pages: data.pageCount || 0,
          sponsors: data.sponsorsCount || 0,
          sponsoring: data.sponsoringCount || 0,
        });
      });

      // Build arrays for each day, interpolating missing data
      const pagesData: number[] = [];
      const sponsorsData: number[] = [];
      const sponsoringData: number[] = [];

      let lastKnown = { pages: 0, sponsors: 0, sponsoring: 0 };

      for (let i = SPARKLINE_DAYS; i >= 0; i--) {
        const date = getDateNDaysAgo(i);
        const dateStr = formatDate(date);
        const snapshot = snapshotMap.get(dateStr);

        if (snapshot) {
          lastKnown = snapshot;
        }

        pagesData.push(lastKnown.pages);
        sponsorsData.push(lastKnown.sponsors);
        sponsoringData.push(lastKnown.sponsoring);
      }

      // Ensure the last value matches current counts
      pagesData[pagesData.length - 1] = pageCount;
      sponsorsData[sponsorsData.length - 1] = sponsorsCount;
      sponsoringData[sponsoringData.length - 1] = sponsoringCount;

      sparklines = {
        pages: pagesData,
        sponsors: sponsorsData,
        sponsoring: sponsoringData,
      };
    }

    const responseTime = Date.now() - startTime;
    console.log(`[User Stats API] Stats fetched for ${userId} in ${responseTime}ms`);

    recordProductionRead('/api/users/stats', 'user-stats', 4, {
      userId,
      responseTime,
      pageCount,
      sponsorsCount,
      sponsoringCount,
      hasRealSnapshots: filteredDocs.length >= 7,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        createdAt: createdAt?.toDate?.()?.toISOString() || createdAt || null,
        pageCount,
        sponsorsCount,
        sponsoringCount,
        sparklines,
      }
    });

    // Cache for 5 minutes
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200');
    response.headers.set('X-Response-Time', `${responseTime}ms`);

    return response;

  } catch (error: any) {
    console.error('[User Stats API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch user stats',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
