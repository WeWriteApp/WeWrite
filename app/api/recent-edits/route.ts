import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../firebase/admin';
import { getCollectionName } from '../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeOwn = searchParams.get('includeOwn') === 'true';
    const followingOnly = searchParams.get('followingOnly') === 'true';
    const filterToUser = searchParams.get('filterToUser'); // NEW: Filter to specific user
    const cursor = searchParams.get('cursor'); // For pagination

    // Initialize Firebase Admin
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    // Build query for recently modified pages
    let pagesQuery = db.collection(getCollectionName('pages'))
      .orderBy('lastModified', 'desc');

    // If filtering to a specific user, add that filter
    if (filterToUser) {
      pagesQuery = pagesQuery.where('userId', '==', filterToUser);
    }

    pagesQuery = pagesQuery.limit(limit * 3); // Get more to account for filtering

    // Add cursor for pagination
    if (cursor) {
      try {
        const cursorDate = new Date(cursor);
        pagesQuery = pagesQuery.startAfter(cursorDate);
      } catch (error) {
        console.warn('Invalid cursor provided:', cursor);
      }
    }

    // Add visibility filter for non-authenticated users
    if (!userId) {
      pagesQuery = pagesQuery.where('isPublic', '==', true);
    }

    const snapshot = await pagesQuery.get();
    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Debug logging
    console.log(`🔍 Recent edits query: Found ${pages.length} pages`);
    if (filterToUser) {
      console.log(`🔍 Filtering to user: ${filterToUser}`);
    }

    // Log first few pages for debugging
    const debugPages = pages.slice(0, 3).map(p => ({
      id: p.id,
      title: p.title,
      userId: p.userId,
      lastModified: p.lastModified?.toDate ? p.lastModified.toDate().toISOString() : p.lastModified,
      hasLastDiff: !!p.lastDiff,
      lastDiffHasChanges: p.lastDiff?.hasChanges
    }));
    console.log('🔍 Sample pages:', debugPages);

    // Filter pages to only include those with actual edits
    let filteredPages = pages
      .filter(page => page.deleted !== true) // Remove deleted pages
      .filter(page => {
        // For recent edits, we want pages that have been modified recently
        // Check if page has lastDiff with changes OR if it's been recently modified
        const hasRecentChanges = page.lastDiff?.hasChanges === true;
        const hasRecentModification = page.lastModified &&
          (new Date().getTime() - new Date(page.lastModified.toDate ? page.lastModified.toDate() : page.lastModified).getTime()) < (30 * 24 * 60 * 60 * 1000); // 30 days

        return hasRecentChanges || hasRecentModification;
      })
      .filter(page => {
        // Apply visibility filter
        if (!userId) return page.isPublic;
        return page.isPublic || page.userId === userId;
      });

    // Apply own edits filter (skip if filtering to specific user)
    if (!includeOwn && userId && !filterToUser) {
      filteredPages = filteredPages.filter(page => page.userId !== userId);
    }

    // Apply following filter (placeholder - would need to fetch followed pages)
    if (followingOnly && userId) {
      // TODO: Implement following filter when needed
      // For now, just return empty array
      filteredPages = [];
    }

    // Transform to simple format and limit to requested amount
    const edits = filteredPages
      .slice(0, limit)
      .map(page => ({
        id: page.id,
        title: page.title || 'Untitled',
        userId: page.userId,
        username: page.username || 'Anonymous',
        displayName: page.displayName,
        lastModified: page.lastModified?.toDate ? page.lastModified.toDate().toISOString() : page.lastModified,
        isPublic: page.isPublic || false,
        totalPledged: page.totalPledged || 0,
        pledgeCount: page.pledgeCount || 0,
        lastDiff: page.lastDiff
      }));

    // Determine if there are more items available
    const hasMore = filteredPages.length >= limit;

    // Get the cursor for the next page (last item's lastModified date)
    const nextCursor = edits.length > 0 ? edits[edits.length - 1].lastModified : null;

    return NextResponse.json({
      edits,
      hasMore,
      nextCursor,
      total: edits.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching recent edits:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch recent edits',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
