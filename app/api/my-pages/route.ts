import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

/**
 * GET /api/my-pages
 * 
 * Fetches pages created by the current user
 * 
 * Query parameters:
 * - userId: The user ID to fetch pages for
 * - searchTerm: Optional search term to filter results
 * - limit: Maximum number of results (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const searchTerm = searchParams.get('searchTerm') || '';
    const limitCount = parseInt(searchParams.get('limit') || '20');

    console.log('[my-pages API] Request params:', { userId, searchTerm, limitCount });

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Use the simplest possible query to avoid any index requirements
    // Only use userId filter - no orderBy to avoid index issues
    let pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId),
      limit(limitCount * 3) // Get more to allow for filtering out deleted pages and search filtering
    );

    console.log('[my-pages API] Querying with simple userId filter...');
    const pagesSnapshot = await getDocs(pagesQuery);
    console.log('[my-pages API] Query successful, found', pagesSnapshot.docs.length, 'pages');

    const pages: any[] = [];

    pagesSnapshot.forEach(doc => {
      const pageData = { id: doc.id, ...doc.data() } as any;
      console.log('[my-pages API] Page data:', { id: doc.id, title: pageData.title, lastModified: pageData.lastModified, userId: pageData.userId, deleted: pageData.deleted });

      // Skip deleted pages (filter client-side to avoid complex index)
      if (pageData.deleted === true) {
        console.log('[my-pages API] Skipping deleted page:', pageData.title);
        return;
      }

      // Apply search filter if provided
      if (!searchTerm ||
          pageData.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pageData.content?.toLowerCase().includes(searchTerm.toLowerCase())) {
        pages.push(pageData);
      }
    });

    // Sort by lastModified client-side (most recent first)
    pages.sort((a, b) => {
      const aTime = new Date(a.lastModified || 0).getTime();
      const bTime = new Date(b.lastModified || 0).getTime();
      return bTime - aTime;
    });

    // Limit results after filtering and sorting
    const limitedPages = pages.slice(0, limitCount);
    console.log('[my-pages API] Returning', limitedPages.length, 'pages after filtering');

    return NextResponse.json({ pages: limitedPages });

  } catch (error) {
    console.error('[my-pages API] Error fetching user pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user pages', details: error.message },
      { status: 500 }
    );
  }
}
