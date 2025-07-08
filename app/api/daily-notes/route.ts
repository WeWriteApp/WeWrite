import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';

/**
 * GET /api/daily-notes
 * 
 * Efficiently fetches pages with custom dates for daily notes carousel
 * Only returns pages that have customDate field set within the specified date range
 * 
 * Query parameters:
 * - userId: The user ID to fetch pages for (required)
 * - startDate: Start date in YYYY-MM-DD format (optional)
 * - endDate: End date in YYYY-MM-DD format (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    const adminDb = admin.firestore();

    // Build query to get pages with custom dates
    // Use range query instead of != null to work with existing indexes
    let pagesQuery = adminDb.collection('pages')
      .where('userId', '==', userId)
      .where('customDate', '>=', '') // Only pages with custom dates (empty string is less than any date)
      .orderBy('customDate', 'asc'); // Order by custom date

    // Apply date range filters if provided
    if (startDate) {
      pagesQuery = pagesQuery.where('customDate', '>=', startDate);
    }
    if (endDate) {
      pagesQuery = pagesQuery.where('customDate', '<=', endDate);
    }

    console.log(`[daily-notes API] Querying pages with custom dates for user ${userId}`, {
      startDate,
      endDate
    });

    const pagesSnapshot = await pagesQuery.get();
    
    const pages = pagesSnapshot.docs
      .map(doc => {
        const data = doc.data();

        // Normalize mixed timestamp formats for lastModified field (same as my-pages API)
        let normalizedLastModified = data.lastModified;
        if (data.lastModified?.toDate) {
          // Firestore Timestamp object
          normalizedLastModified = data.lastModified.toDate().toISOString();
        } else if (data.lastModified?.seconds) {
          // Firestore Timestamp-like object {seconds, nanoseconds}
          normalizedLastModified = new Date(data.lastModified.seconds * 1000).toISOString();
        }

        // Normalize mixed timestamp formats for createdAt field (same as my-pages API)
        let normalizedCreatedAt = data.createdAt;
        if (data.createdAt?.toDate) {
          // Firestore Timestamp object
          normalizedCreatedAt = data.createdAt.toDate().toISOString();
        } else if (data.createdAt?.seconds) {
          // Firestore Timestamp-like object {seconds, nanoseconds}
          normalizedCreatedAt = new Date(data.createdAt.seconds * 1000).toISOString();
        }

        return {
          id: doc.id,
          title: data.title || 'Untitled',
          customDate: data.customDate,
          lastModified: normalizedLastModified,
          createdAt: normalizedCreatedAt,
          deleted: data.deleted || false
        };
      })
      .filter(page => !page.deleted); // Filter out deleted pages client-side

    console.log(`[daily-notes API] Found ${pages.length} pages with custom dates`);

    return NextResponse.json({
      pages,
      totalFound: pages.length
    });

  } catch (error) {
    console.error('[daily-notes API] Error fetching daily notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily notes', details: error.message },
      { status: 500 }
    );
  }
}
