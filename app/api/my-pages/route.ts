import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import { getUserIdFromRequest } from '../auth-helper';



// Initialize Firebase Admin lazily
let adminDb;

/**
 * Server-side function to get user page count
 * @param userId - The user whose pages to count
 * @param viewerUserId - The user viewing the profile (null if not authenticated)
 * @returns Promise<number> - The page count
 */
async function getUserPageCountServer(userId: string, viewerUserId: string | null = null): Promise<number> {
  if (!userId) return 0;

  try {
    if (!adminDb) {
      const admin = getFirebaseAdmin();
      adminDb = admin.firestore();
    }

    // Determine if the viewer is the owner
    const isOwner = viewerUserId && userId === viewerUserId;

    if (isOwner) {
      // Owner can see all their pages (including private)
      // First try to get from counter document
      const counterDocRef = adminDb.collection(getCollectionName('counters')).doc(`user_${userId}`);
      const counterDoc = await counterDocRef.get();

      if (counterDoc.exists && counterDoc.data().pageCount !== undefined) {
        return counterDoc.data().pageCount;
      }

      // No counter, count manually
      const pagesQuery = adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userId)
        .where('deleted', '==', false);

      const pagesSnapshot = await pagesQuery.get();
      const count = pagesSnapshot.size;

      // Store the count for future use
      await counterDocRef.set({
        pageCount: count,
        lastUpdated: new Date()
      }, { merge: true });

      return count;
    } else {
      // Visitor can only see public pages
      // First try to get from public counter document
      const publicCounterDocRef = adminDb.collection(getCollectionName('counters')).doc(`user_${userId}_public`);
      const publicCounterDoc = await publicCounterDocRef.get();

      if (publicCounterDoc.exists && publicCounterDoc.data().pageCount !== undefined) {
        return publicCounterDoc.data().pageCount;
      }

      // No counter, count manually (all pages are public now)
      const pagesQuery = adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userId)
        .where('deleted', '==', false);

      const pagesSnapshot = await pagesQuery.get();
      const count = pagesSnapshot.size;

      // Store the count for future use
      await publicCounterDocRef.set({
        pageCount: count,
        lastUpdated: new Date()
      }, { merge: true });

      return count;
    }
  } catch (error) {
    console.error('Error getting user page count (server):', error);
    return 0;
  }
}

function initializeFirebase() {
  if (adminDb) return { adminDb }; // Already initialized

  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { adminDb: null };
    }
    adminDb = admin.firestore();
    console.log('Firebase Admin initialized successfully in my-pages');
  } catch (error) {
    console.error('Error initializing Firebase Admin in my-pages:', error);
    return { adminDb: null };
  }

  return { adminDb };
}

/**
 * GET /api/my-pages
 *
 * CRITICAL FIX: Fetches pages created by the current user with proper database-level sorting
 * This ensures we get the ACTUAL top N pages from the entire database, not just from a limited subset
 *
 * Query parameters:
 * - userId: The user ID to fetch pages for
 * - sortBy: Sort field (lastModified, createdAt, title) - default: lastModified
 * - sortDirection: Sort direction (desc, asc) - default: desc
 * - searchTerm: Optional search term to filter results
 * - limit: Maximum number of results (default: 100)
 * - cursor: Pagination cursor for loading more results
 */
export async function GET(request: NextRequest) {
  try {
    const { adminDb } = initializeFirebase();
    if (!adminDb) {
      console.warn('Firebase Admin not available for my-pages');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sortBy = searchParams.get('sortBy') || 'lastModified';
    const sortDirection = searchParams.get('sortDirection') || 'desc';
    const searchTerm = searchParams.get('searchTerm') || '';
    const limitParam = searchParams.get('limit');
    const cursor = searchParams.get('cursor'); // Pagination cursor
    const limitCount = limitParam ? parseInt(limitParam) : 100;
    const noLimit = limitParam === null; // If no limit param provided, get ALL pages

    // Only log when getting all pages (daily notes) or when there are issues
    if (noLimit) {
      console.log('[my-pages API] Getting ALL pages for daily notes:', { userId, sortBy });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // PERFORMANCE OPTIMIZATION: Use reasonable query limits and server-side filtering
    // BUT if no limit is specified (daily notes case), get ALL pages
    let pagesQuery;
    let actualSortField; // Track what field we're actually using
    let queryLimit = noLimit ? null : Math.max(limitCount * 2, 200); // No limit for daily notes

    // Parse cursor for pagination
    let startAfterDoc = null;
    if (cursor && !noLimit) { // Only use cursor when we have limits (not for daily notes)
      try {
        // Cursor is the timestamp/value to start after
        startAfterDoc = cursor;
      } catch (error) {
        console.warn('[my-pages API] Invalid cursor, ignoring:', error);
      }
    }

    if (sortBy === 'lastModified' || sortBy === 'recently-edited') {
      // OPTIMIZED: Use equality query (all pages now have deleted: false set on creation)
      actualSortField = 'lastModified';
      pagesQuery = adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userId)
        .where('deleted', '==', false) // More efficient equality query
        .orderBy('lastModified', 'desc');

      // Add cursor support for pagination
      if (startAfterDoc) {
        // For Firestore startAfter with orderBy, we need to pass the field value
        pagesQuery = pagesQuery.startAfter(startAfterDoc);
      }

      if (queryLimit !== null) {
        pagesQuery = pagesQuery.limit(queryLimit);
      }
    } else if (sortBy === 'createdAt' || sortBy === 'recently-created') {
      // OPTIMIZED: Use equality query (all pages now have deleted: false set on creation)
      actualSortField = 'createdAt';
      pagesQuery = adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userId)
        .where('deleted', '==', false) // More efficient equality query
        .orderBy('createdAt', 'desc');

      // Add cursor support for pagination
      if (startAfterDoc) {
        // For Firestore startAfter with orderBy, we need to pass the field value
        pagesQuery = pagesQuery.startAfter(startAfterDoc);
      }

      if (queryLimit !== null) {
        pagesQuery = pagesQuery.limit(queryLimit);
      }
    } else if (sortBy === 'title' || sortBy === 'alphabetical') {
      // OPTIMIZED: Use equality query (all pages now have deleted: false set on creation)
      actualSortField = 'title';
      const titleDirection = sortDirection === 'asc' ? 'asc' : 'desc';
      pagesQuery = adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userId)
        .where('deleted', '==', false) // More efficient equality query
        .orderBy('title', titleDirection);

      // Add cursor support for pagination
      if (startAfterDoc) {
        // For Firestore startAfter with orderBy, we need to pass the field value
        pagesQuery = pagesQuery.startAfter(startAfterDoc);
      }

      if (queryLimit !== null) {
        pagesQuery = pagesQuery.limit(queryLimit);
      }
    } else {
      // OPTIMIZED: Fallback using equality query
      actualSortField = 'lastModified (fallback)';
      pagesQuery = adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userId)
        .where('deleted', '==', false) // More efficient equality query
        .orderBy('lastModified', 'desc');

      // Add cursor support for pagination
      if (startAfterDoc) {
        // For Firestore startAfter with orderBy, we need to pass the field value
        pagesQuery = pagesQuery.startAfter(startAfterDoc);
      }

      if (queryLimit !== null) {
        pagesQuery = pagesQuery.limit(queryLimit);
      }
    }

    const pagesSnapshot = await pagesQuery.get();

    // Only log for daily notes (no limit) or when there are many pages
    if (noLimit || pagesSnapshot.docs.length > 500) {
      console.log(`[my-pages API] Query found ${pagesSnapshot.docs.length} pages (${queryLimit === null ? 'ALL' : 'limited'})`);
    }

    const pages: any[] = [];

    pagesSnapshot.forEach(doc => {
      const rawData = doc.data();

      // CRITICAL FIX: Normalize mixed timestamp formats for lastModified field
      let normalizedLastModified = rawData.lastModified;
      if (rawData.lastModified?.toDate) {
        // Firestore Timestamp object
        normalizedLastModified = rawData.lastModified.toDate().toISOString();
      } else if (rawData.lastModified?.seconds) {
        // Firestore Timestamp-like object {seconds, nanoseconds}
        normalizedLastModified = new Date(rawData.lastModified.seconds * 1000).toISOString();
      }
      // If it's already an ISO string, keep it as is

      // CRITICAL FIX: Normalize mixed timestamp formats for createdAt field
      let normalizedCreatedAt = rawData.createdAt;
      if (rawData.createdAt?.toDate) {
        // Firestore Timestamp object
        normalizedCreatedAt = rawData.createdAt.toDate().toISOString();
      } else if (rawData.createdAt?.seconds) {
        // Firestore Timestamp-like object {seconds, nanoseconds}
        normalizedCreatedAt = new Date(rawData.createdAt.seconds * 1000).toISOString();
      }
      // If it's already an ISO string, keep it as is

      const pageData = {
        id: doc.id,
        ...rawData,
        lastModified: normalizedLastModified,
        createdAt: normalizedCreatedAt
      } as any;

      // CRITICAL FIX: Deleted pages are now filtered at database level, no need for client-side filter

      // Apply search filter if provided
      if (!searchTerm ||
          pageData.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pageData.content?.toLowerCase().includes(searchTerm.toLowerCase())) {
        pages.push(pageData);

        // CRITICAL FIX: Enhanced logging to debug new page visibility
        if (pages.length <= 10) {
          const pageTimestamp = new Date(pageData.lastModified || 0).getTime();
          const now = Date.now();
          const ageMinutes = Math.round((now - pageTimestamp) / (1000 * 60));

          console.log(`[my-pages API] CRITICAL FIX - Page ${pages.length}:`, {
            id: pageData.id,
            title: pageData.title,
            lastModified: pageData.lastModified,
            createdAt: pageData.createdAt,
            deleted: pageData.deleted,
            ageMinutes: ageMinutes
          });
        }
      }
    });

    // CRITICAL FIX: Handle client-side reversal for ascending sorts (temporary workaround for index issues)
    if ((sortBy === 'lastModified' || sortBy === 'recently-edited') && sortDirection === 'asc') {
      console.log('[my-pages API] CRITICAL FIX - Reversing lastModified results for ascending order (index workaround)');
      pages.reverse();
    } else if ((sortBy === 'createdAt' || sortBy === 'recently-created') && sortDirection === 'asc') {
      console.log('[my-pages API] CRITICAL FIX - Reversing createdAt results for ascending order (index workaround)');
      pages.reverse();
    } else {
      console.log('[my-pages API] CRITICAL FIX - Using database sort order as-is');
    }

    // Limit results after client-side filtering and potential reversal (unless noLimit is true)
    const limitedPages = noLimit ? pages : pages.slice(0, limitCount);

    console.log(`[my-pages API] CRITICAL FIX - Processed ${pages.length} total pages, returning ${limitedPages.length} after limiting`);

    // CRITICAL FIX: Check if any very recent pages (created in last 5 minutes) are in results
    const recentPages = pages.filter(page => {
      const pageTimestamp = new Date(page.lastModified || 0).getTime();
      const now = Date.now();
      const ageMinutes = (now - pageTimestamp) / (1000 * 60);
      return ageMinutes < 5; // Pages created in last 5 minutes
    });

    // Only log for daily notes or when there are issues
    if (noLimit && limitedPages.length > 0) {
      const pagesWithCustomDate = limitedPages.filter(p => p.customDate).length;
      console.log(`[my-pages API] Daily notes: returning ${limitedPages.length} total pages, ${pagesWithCustomDate} with custom dates`);
    }

    // Calculate pagination info
    const hasMore = !noLimit && pages.length > limitCount;
    let nextCursor = null;

    if (hasMore && limitedPages.length > 0) {
      const lastPage = limitedPages[limitedPages.length - 1];
      // Use the sort field value as cursor
      if (sortBy === 'lastModified' || sortBy === 'recently-edited') {
        nextCursor = lastPage.lastModified;
      } else if (sortBy === 'createdAt' || sortBy === 'recently-created') {
        nextCursor = lastPage.createdAt;
      } else if (sortBy === 'title' || sortBy === 'alphabetical') {
        nextCursor = lastPage.title;
      } else {
        nextCursor = lastPage.lastModified; // fallback
      }
    }

    // Get total page count for the user (for display purposes)
    let totalPageCount = 0;
    try {
      if (userId) {
        // Get the current user from the request to determine if they're viewing their own pages
        const currentUserId = await getUserIdFromRequest(request);
        totalPageCount = await getUserPageCountServer(userId, currentUserId);
      }
    } catch (error) {
      console.warn('[my-pages API] Failed to get total page count:', error);
      // Don't fail the request if page count fails, just use 0
    }

    return NextResponse.json({
      pages: limitedPages,
      totalFound: pagesSnapshot.docs.length,
      totalPageCount, // Total count of ALL pages for this user
      hasMore,
      nextCursor,
      sortBy,
      sortDirection,
      searchTerm
    });

  } catch (error) {
    console.error('[my-pages API] CRITICAL FIX - Error fetching user pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user pages', details: error.message },
      { status: 500 }
    );
  }
}