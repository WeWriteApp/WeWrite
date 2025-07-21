import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../firebase/admin';
import { getCollectionName } from '../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeOwn = searchParams.get('includeOwn') === 'true';
    const followingOnly = searchParams.get('followingOnly') === 'true';

    // Initialize Firebase Admin
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    // Build query for recently modified pages
    let pagesQuery = db.collection(getCollectionName('pages'))
      .orderBy('lastModified', 'desc')
      .limit(limit * 3); // Get more to account for filtering

    // Add visibility filter for non-authenticated users
    if (!userId) {
      pagesQuery = pagesQuery.where('isPublic', '==', true);
    }

    const snapshot = await pagesQuery.get();
    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter pages to only include those with actual edits (lastDiff.hasChanges = true)
    let filteredPages = pages
      .filter(page => page.deleted !== true) // Remove deleted pages
      .filter(page => page.lastDiff?.hasChanges === true) // Only pages with actual edits
      .filter(page => {
        // Apply visibility filter
        if (!userId) return page.isPublic;
        return page.isPublic || page.userId === userId;
      });

    // Apply own edits filter
    if (!includeOwn && userId) {
      filteredPages = filteredPages.filter(page => page.userId !== userId);
    }

    // Apply following filter (placeholder - would need to fetch followed pages)
    if (followingOnly && userId) {
      // TODO: Implement following filter when needed
      // For now, just return empty array
      filteredPages = [];
    }

    // Transform to simple format
    const edits = filteredPages
      .slice(0, limit)
      .map(page => ({
        id: page.id,
        title: page.title || 'Untitled',
        userId: page.userId,
        username: page.username || 'Anonymous',
        displayName: page.displayName,
        lastModified: page.lastModified,
        isPublic: page.isPublic || false,
        totalPledged: page.totalPledged || 0,
        pledgeCount: page.pledgeCount || 0,
        lastDiff: page.lastDiff
      }));

    return NextResponse.json({
      edits,
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
