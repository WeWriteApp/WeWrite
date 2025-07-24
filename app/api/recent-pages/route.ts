import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../firebase/admin';
import { getCollectionName } from "../../utils/environmentConfig";

/**
 * GET /api/recent-pages
 *
 * Fetches recent pages for the current user based on their recent activity
 * Uses the same logic as /api/home to ensure consistency
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

    // Initialize Firebase Admin
    let adminApp;
    try {
      adminApp = initAdmin();
      if (!adminApp) {
        console.error('Firebase Admin not available');
        return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not available');
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin initialization failed');
    }

    const db = adminApp.firestore();

    // Use the same logic as /api/home - get recently modified pages for the user
    let pagesQuery;

    // For logged-in users, get recent pages and filter deleted ones in code
    // This avoids the composite index requirement
    pagesQuery = db.collection(getCollectionName('pages'))
      .where('userId', '==', userId)
      .orderBy('lastModified', 'desc')
      .limit(limitCount * 2); // Get more to account for filtering

    const snapshot = await pagesQuery.get();
    console.log(`[recent-pages API] Raw query returned ${snapshot.size} documents`);

    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter out deleted pages and apply search filter
    const filteredPages = pages.filter(page => {
      // Skip deleted pages
      if (page.deleted === true) {
        return false;
      }

      // Apply search filter if provided
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return page.title?.toLowerCase().includes(searchLower) ||
               page.content?.toLowerCase().includes(searchLower);
      }

      return true;
    }).slice(0, limitCount); // Apply final limit

    console.log(`[recent-pages API] Returning ${filteredPages.length} pages after filtering`);

    return NextResponse.json({ pages: filteredPages });

  } catch (error) {
    console.error('Error fetching recent pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent pages' },
      { status: 500 }
    );
  }
}