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

    // Use lastModified ordering (which has existing indexes and is used throughout the codebase)
    let pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId),
      orderBy('lastModified', 'desc'),
      limit(limitCount * 2) // Get more to allow for search filtering
    );

    console.log('[my-pages API] Querying with lastModified ordering...');
    const pagesSnapshot = await getDocs(pagesQuery);
    console.log('[my-pages API] Query successful, found', pagesSnapshot.docs.length, 'pages');

    const pages: any[] = [];

    pagesSnapshot.forEach(doc => {
      const pageData = { id: doc.id, ...doc.data() } as any;
      console.log('[my-pages API] Page data:', { id: doc.id, title: pageData.title, lastModified: pageData.lastModified, userId: pageData.userId });

      // Apply search filter if provided
      if (!searchTerm ||
          pageData.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pageData.content?.toLowerCase().includes(searchTerm.toLowerCase())) {
        pages.push(pageData);
      }
    });

    // Limit results after filtering
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
