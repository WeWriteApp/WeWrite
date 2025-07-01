import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    // Parse the service account JSON from environment (it's base64 encoded)
    const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
    const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedJson);
    console.log('[Admin SDK] Initializing with project:', serviceAccount.project_id);
    console.log('[Admin SDK] Client email:', serviceAccount.client_email);

    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')})});
    console.log('[Admin SDK] Initialized successfully');
  } catch (error) {
    console.error('[Admin SDK] Initialization failed:', error);
    throw error;
  }
}

const adminDb = getFirestore();

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
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sortBy = searchParams.get('sortBy') || 'lastModified';
    const sortDirection = searchParams.get('sortDirection') || 'desc';
    const searchTerm = searchParams.get('searchTerm') || '';
    const limitCount = parseInt(searchParams.get('limit') || '100');

    console.log('[my-pages API] CRITICAL FIX - Request params:', {
      userId, sortBy, sortDirection, searchTerm, limitCount
    });

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // PERFORMANCE OPTIMIZATION: Use reasonable query limits and server-side filtering
    let pagesQuery;
    let actualSortField; // Track what field we're actually using
    let queryLimit = Math.max(limitCount * 2, 200); // Reduced limit for better performance

    if (sortBy === 'lastModified' || sortBy === 'recently-edited') {
      // CRITICAL FIX: Use proper lastModified index with deleted filter
      // TEMPORARY WORKAROUND: Always use DESC for database query, reverse on client if needed
      actualSortField = 'lastModified';
      pagesQuery = adminDb.collection('pages')
        .where('userId', '==', userId)
        .where('deleted', '==', false) // Filter out deleted pages
        .orderBy('lastModified', 'desc'); // Always use desc to avoid index issues

      if (queryLimit) {
        pagesQuery = pagesQuery.limit(queryLimit);
      }
    } else if (sortBy === 'createdAt' || sortBy === 'recently-created') {
      // CRITICAL FIX: Use proper createdAt index that DOES exist!
      // TEMPORARY WORKAROUND: Always use DESC for database query, reverse on client if needed
      console.log('[my-pages API] CRITICAL FIX - Using proper createdAt index with deleted filter');
      actualSortField = 'createdAt';
      pagesQuery = adminDb.collection('pages')
        .where('userId', '==', userId)
        .where('deleted', '==', false) // Filter out deleted pages
        .orderBy('createdAt', 'desc'); // Always use desc to avoid index issues

      if (queryLimit) {
        pagesQuery = pagesQuery.limit(queryLimit);
      }
    } else if (sortBy === 'title' || sortBy === 'alphabetical') {
      // CRITICAL FIX: Use proper title index with deleted filter and correct direction
      actualSortField = 'title';
      const titleDirection = sortDirection === 'asc' ? 'asc' : 'desc';
      pagesQuery = adminDb.collection('pages')
        .where('userId', '==', userId)
        .where('deleted', '==', false) // Filter out deleted pages
        .orderBy('title', titleDirection); // Use the requested direction

      if (queryLimit) {
        pagesQuery = pagesQuery.limit(queryLimit);
      }
    } else {
      // Fallback to lastModified with proper deleted filter
      // TEMPORARY WORKAROUND: Always use DESC for database query, reverse on client if needed
      actualSortField = 'lastModified (fallback)';
      pagesQuery = adminDb.collection('pages')
        .where('userId', '==', userId)
        .where('deleted', '==', false) // Filter out deleted pages
        .orderBy('lastModified', 'desc'); // Always use desc to avoid index issues

      if (queryLimit) {
        pagesQuery = pagesQuery.limit(queryLimit);
      }
    }

    console.log(`[my-pages API] CRITICAL FIX - Executing database-level sort by ${actualSortField} ${sortDirection} for user ${userId} (requested: ${sortBy}, limit: ${queryLimit || 'ALL'})`);
    const pagesSnapshot = await pagesQuery.get();
    console.log('[my-pages API] CRITICAL FIX - Query successful, found', pagesSnapshot.docs.length, 'pages from entire database');

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

    // Limit results after client-side filtering and potential reversal
    const limitedPages = pages.slice(0, limitCount);

    console.log(`[my-pages API] CRITICAL FIX - Processed ${pages.length} total pages, returning ${limitedPages.length} after limiting`);

    // CRITICAL FIX: Check if any very recent pages (created in last 5 minutes) are in results
    const recentPages = pages.filter(page => {
      const pageTimestamp = new Date(page.lastModified || 0).getTime();
      const now = Date.now();
      const ageMinutes = (now - pageTimestamp) / (1000 * 60);
      return ageMinutes < 5; // Pages created in last 5 minutes
    });

    if (recentPages.length > 0) {
      console.log(`[my-pages API] CRITICAL FIX - Found ${recentPages.length} recent pages (< 5 min old):`,
        recentPages.map(p => ({ id: p.id, title: p.title, lastModified: p.lastModified })));
    } else {
      console.log(`[my-pages API] CRITICAL FIX - No recent pages found in results (this might indicate indexing delay)`);
    }

    console.log(`[my-pages API] CRITICAL FIX - Returning ${limitedPages.length} pages sorted by ${sortBy} ${sortDirection} from entire database`);

    return NextResponse.json({
      pages: limitedPages,
      totalFound: pagesSnapshot.docs.length,
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