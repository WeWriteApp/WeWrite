import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

// UPDATED: Now uses createdAt dates instead of customDate for Daily Notes

/**
 * GET /api/daily-notes
 *
 * Efficiently fetches pages grouped by their creation date for daily notes carousel
 * Returns pages organized by the date they were created (createdAt field)
 * Updated to use creation dates instead of custom dates
 *
 * Query parameters:
 * - userId: The user ID to fetch pages for (required)
 * - startDate: Start date in YYYY-MM-DD format (optional)
 * - endDate: End date in YYYY-MM-DD format (optional)
 */
export async function GET(request: NextRequest) {
  console.log('🔄 [daily-notes API] NEW VERSION - Using createdAt dates instead of customDate');

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const timezone = searchParams.get('timezone') || 'UTC'; // Default to UTC if not provided

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    let admin;
    try {
      admin = getFirebaseAdmin();
      if (!admin) {
        console.error('Firebase Admin not available');
        return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not available');
      }
    } catch (error) {
      console.error('Error getting Firebase Admin:', error);
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin initialization failed');
    }

    const adminDb = admin.firestore();

    // Build query to get ALL pages for the user first, then filter by creation date
    // This ensures we get all pages and can group them by their creation date
    // OPTIMIZATION: Remove deleted filter from query to avoid index requirement, filter in code instead
    let pagesQuery = adminDb.collection(getCollectionName('pages'))
      .where('userId', '==', userId);

    // If we have date range, we'll filter after getting the results
    // This is more reliable than trying to query on createdAt field directly

    console.log(`[daily-notes API] Querying all pages for user ${userId} (will group by creation date)`, {
      startDate,
      endDate,
      timezone
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

        // Extract date from createdAt for grouping using user's timezone
        let createdDate = null;
        if (normalizedCreatedAt) {
          try {
            const date = new Date(normalizedCreatedAt);
            // Convert to user's timezone and format as YYYY-MM-DD
            createdDate = date.toLocaleDateString('en-CA', {
              timeZone: timezone,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }); // en-CA locale gives YYYY-MM-DD format

            // Debug logging for first few pages
            if (doc.id === '2FPdHEETzI9bQpQfUXos' || doc.id === 'A53fHCgw3Skn3tAhXkgP') {
              console.log(`[daily-notes API] Processing page ${doc.id}:`, {
                title: data.title,
                rawCreatedAt: data.createdAt,
                normalizedCreatedAt,
                extractedDate: createdDate,
                timezone: timezone,
                utcDate: new Date(normalizedCreatedAt).toISOString().split('T')[0],
                customDate: data.customDate
              });
            }
          } catch (error) {
            console.warn(`[daily-notes API] Invalid createdAt date for page ${doc.id}:`, normalizedCreatedAt);
          }
        } else {
          // Debug: Log pages without createdAt
          if (doc.id === '2FPdHEETzI9bQpQfUXos' || doc.id === 'A53fHCgw3Skn3tAhXkgP') {
            console.log(`[daily-notes API] Page ${doc.id} has no createdAt:`, {
              title: data.title,
              rawCreatedAt: data.createdAt,
              customDate: data.customDate
            });
          }
        }

        return {
          id: doc.id,
          title: data.title || 'Untitled',
          customDate: data.customDate, // Keep for other uses
          lastModified: normalizedLastModified,
          createdAt: normalizedCreatedAt,
          createdDate: createdDate, // YYYY-MM-DD format for grouping
          deleted: data.deleted || false
        };
      })
      .filter(page => {
        // Filter out deleted pages
        if (page.deleted) return false;

        // Only include pages that have a valid creation date
        if (!page.createdDate) return false;

        // Apply date range filter if specified
        if (startDate && page.createdDate < startDate) return false;
        if (endDate && page.createdDate > endDate) return false;

        return true;
      });

    console.log(`[daily-notes API] Found ${pages.length} pages with valid creation dates`);

    // Debug: Show first few pages to understand what we're returning
    if (pages.length > 0) {
      console.log('[daily-notes API] Sample pages with creation dates:', pages.slice(0, 5).map(page => ({
        id: page.id,
        title: page.title,
        createdDate: page.createdDate,
        createdAt: page.createdAt,
        customDate: page.customDate // Show both for comparison
      })));
    } else {
      console.log('[daily-notes API] No pages found with valid creation dates');

      // Debug: Show what we got from the raw query
      const pagesSnapshot = await adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userId)
        .limit(5)
        .get();

      console.log('[daily-notes API] Raw sample pages from DB:', pagesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          createdAt: data.createdAt,
          customDate: data.customDate,
          deleted: data.deleted
        };
      }));
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
