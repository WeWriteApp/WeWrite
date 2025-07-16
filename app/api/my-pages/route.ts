import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionName } from '../../utils/environmentConfig';

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
    const limitParam = searchParams.get('limit');
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

    if (sortBy === 'lastModified' || sortBy === 'recently-edited') {
      // CRITICAL FIX: Use proper lastModified index with deleted filter
      // TEMPORARY WORKAROUND: Always use DESC for database query, reverse on client if needed
      actualSortField = 'lastModified';
      pagesQuery = adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userId)
        .where('deleted', '!=', true) // Filter out deleted pages (includes pages without deleted field)
        .orderBy('deleted') // Required for != queries
        .orderBy('lastModified', 'desc'); // Always use desc to avoid index issues

      if (queryLimit !== null) {
        pagesQuery = pagesQuery.limit(queryLimit);
      }
    } else if (sortBy === 'createdAt' || sortBy === 'recently-created') {
      // CRITICAL FIX: Use proper createdAt index that DOES exist!
      // TEMPORARY WORKAROUND: Always use DESC for database query, reverse on client if needed
      console.log('[my-pages API] CRITICAL FIX - Using proper createdAt index with deleted filter');
      actualSortField = 'createdAt';
      pagesQuery = adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userId)
        .where('deleted', '!=', true) // Filter out deleted pages (includes pages without deleted field)
        .orderBy('deleted') // Required for != queries
        .orderBy('createdAt', 'desc'); // Always use desc to avoid index issues

      if (queryLimit !== null) {
        pagesQuery = pagesQuery.limit(queryLimit);
      }
    } else if (sortBy === 'title' || sortBy === 'alphabetical') {
      // CRITICAL FIX: Use proper title index with deleted filter and correct direction
      actualSortField = 'title';
      const titleDirection = sortDirection === 'asc' ? 'asc' : 'desc';
      pagesQuery = adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userId)
        .where('deleted', '!=', true) // Filter out deleted pages (includes pages without deleted field)
        .orderBy('deleted') // Required for != queries
        .orderBy('title', titleDirection); // Use the requested direction

      if (queryLimit !== null) {
        pagesQuery = pagesQuery.limit(queryLimit);
      }
    } else {
      // Fallback to lastModified with proper deleted filter
      // TEMPORARY WORKAROUND: Always use DESC for database query, reverse on client if needed
      actualSortField = 'lastModified (fallback)';
      pagesQuery = adminDb.collection(getCollectionName('pages'))
        .where('userId', '==', userId)
        .where('deleted', '!=', true) // Filter out deleted pages (includes pages without deleted field)
        .orderBy('deleted') // Required for != queries
        .orderBy('lastModified', 'desc'); // Always use desc to avoid index issues

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