import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../../firebase/config';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

/**
 * GET /api/recent-pages
 * 
 * Fetches recent pages for the current user based on their activity history
 * 
 * Query parameters:
 * - userId: The user ID to fetch recent pages for
 * - searchTerm: Optional search term to filter results
 * - limit: Maximum number of results (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const searchTerm = searchParams.get('searchTerm') || '';
    const limitCount = parseInt(searchParams.get('limit') || '20');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('[recent-pages API] Starting recent pages fetch for user:', userId);

    // Get recent pages from Firebase Realtime Database
    const rtdb = getDatabase(app);
    const recentPagesRef = ref(rtdb, `users/${userId}/recentPages`);
    const recentPagesSnapshot = await get(recentPagesRef);

    let recentPageIds: string[] = [];
    
    if (recentPagesSnapshot.exists()) {
      const recentPagesData = recentPagesSnapshot.val();
      // Convert to array and sort by timestamp (most recent first)
      const recentPagesArray = Object.values(recentPagesData || {}) as any[];
      recentPageIds = recentPagesArray
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .map(page => page.id)
        .slice(0, limitCount);
    }

    if (recentPageIds.length === 0) {
      return NextResponse.json({ pages: [] });
    }

    // Fetch page details from Firestore
    // We'll need to fetch in batches since Firestore 'in' queries are limited to 10 items
    const pages: any[] = [];
    const batchSize = 10;
    
    for (let i = 0; i < recentPageIds.length; i += batchSize) {
      const batch = recentPageIds.slice(i, i + batchSize);
      
      let pagesQuery = query(
        collection(db, 'pages'),
        where('__name__', 'in', batch)
      );

      const pagesSnapshot = await getDocs(pagesQuery);

      pagesSnapshot.forEach(doc => {
        const pageData = { id: doc.id, ...doc.data() } as any;

        // Filter out soft-deleted pages and apply search filter
        if (pageData.deleted === true) {
          return; // Skip deleted pages
        }

        // Apply search filter if provided
        if (!searchTerm ||
            pageData.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            pageData.content?.toLowerCase().includes(searchTerm.toLowerCase())) {
          pages.push(pageData);
        }
      });
    }

    // Sort pages by their position in the recent pages list to maintain recency order
    const sortedPages = pages.sort((a, b) => {
      const aIndex = recentPageIds.indexOf(a.id);
      const bIndex = recentPageIds.indexOf(b.id);
      return aIndex - bIndex;
    });

    return NextResponse.json({ pages: sortedPages });

  } catch (error) {
    console.error('Error fetching recent pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent pages' },
      { status: 500 }
    );
  }
}