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

    // Build query to get ALL pages for the user first, then filter for custom dates
    // This ensures we catch pages that might have been migrated or have custom dates
    // OPTIMIZATION: Remove deleted filter from query to avoid index requirement, filter in code instead
    let pagesQuery = adminDb.collection('pages')
      .where('userId', '==', userId);

    // If we have date range, we'll filter after getting the results
    // This is more reliable than trying to query on customDate field directly

    console.log(`[daily-notes API] Querying all pages for user ${userId} (will filter deleted pages in code)`, {
      startDate,
      endDate
    });

    const pagesSnapshot = await pagesQuery.get();

    // Helper function to check if a string is in YYYY-MM-DD format
    const isDateFormat = (str: string): boolean => {
      return /^\d{4}-\d{2}-\d{2}$/.test(str);
    };

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
      .filter(page => {
        // Filter out deleted pages
        if (page.deleted) return false;

        // Include pages with customDate field
        if (page.customDate) {
          // Apply date range filter if specified
          if (startDate && page.customDate < startDate) return false;
          if (endDate && page.customDate > endDate) return false;
          return true;
        }

        // Include legacy pages with YYYY-MM-DD titles (for backward compatibility)
        if (page.title && isDateFormat(page.title)) {
          // Apply date range filter if specified
          if (startDate && page.title < startDate) return false;
          if (endDate && page.title > endDate) return false;
          return true;
        }

        return false;
      });

    console.log(`[daily-notes API] Found ${pages.length} pages with custom dates or legacy date titles`);

    // Debug: Show first few pages to understand what we're returning
    if (pages.length > 0) {
      console.log('[daily-notes API] Sample pages:', pages.slice(0, 3).map(page => ({
        id: page.id,
        title: page.title,
        customDate: page.customDate,
        hasCustomDate: !!page.customDate
      })));
    }

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
