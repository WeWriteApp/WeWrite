import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Debug API to test what recent edits API is actually returning
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Initialize Firebase Admin
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    console.log('🔍 TEST RECENT EDITS: Starting debug test');
    console.log('🔍 Collection name:', getCollectionName('pages'));

    // Get recent pages ordered by lastModified (same as recent edits API)
    const pagesQuery = db.collection(getCollectionName('pages'))
      .orderBy('lastModified', 'desc')
      .limit(20);

    const snapshot = await pagesQuery.get();
    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`🔍 Found ${pages.length} pages total`);

    // Apply the same filtering logic as recent edits API
    const filteredPages = pages
      .filter(page => page.deleted !== true)
      .filter(page => {
        if (!page.lastModified) return false;
        
        const lastModifiedDate = page.lastModified.toDate ? page.lastModified.toDate() : new Date(page.lastModified);
        const daysSinceModified = (new Date().getTime() - lastModifiedDate.getTime()) / (24 * 60 * 60 * 1000);
        
        const isRecentlyModified = daysSinceModified <= 7;
        const hasTrackedChanges = page.lastDiff?.hasChanges === true;
        
        console.log(`🔍 Page: ${page.id} - ${page.title}`, {
          lastModified: lastModifiedDate.toISOString(),
          daysSinceModified: daysSinceModified.toFixed(2),
          isRecentlyModified,
          hasTrackedChanges,
          included: isRecentlyModified || hasTrackedChanges
        });
        
        return isRecentlyModified || hasTrackedChanges;
      })
      .filter(page => {
        // Apply visibility filter
        if (!userId) return page.isPublic;
        return page.isPublic || page.userId === userId;
      });

    console.log(`🔍 After filtering: ${filteredPages.length} pages`);

    // Transform to same format as recent edits API
    const edits = filteredPages
      .slice(0, 10)
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

    // Also test the actual recent edits API
    let apiResponse = null;
    try {
      const apiUrl = new URL('/api/recent-edits', request.url);
      if (userId) {
        apiUrl.searchParams.set('userId', userId);
      }
      apiUrl.searchParams.set('limit', '10');
      
      const apiRes = await fetch(apiUrl.toString());
      if (apiRes.ok) {
        apiResponse = await apiRes.json();
      }
    } catch (apiError) {
      console.error('Error calling recent edits API:', apiError);
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      collection: getCollectionName('pages'),
      userId,
      debug: {
        totalPagesFound: pages.length,
        filteredPagesCount: filteredPages.length,
        finalEditsCount: edits.length
      },
      sampleRawPages: pages.slice(0, 5).map(p => ({
        id: p.id,
        title: p.title,
        lastModified: p.lastModified,
        deleted: p.deleted,
        hasLastDiff: !!p.lastDiff,
        lastDiffHasChanges: p.lastDiff?.hasChanges
      })),
      filteredEdits: edits,
      apiResponse: apiResponse
    });

  } catch (error) {
    console.error('Error in test recent edits debug:', error);
    return NextResponse.json(
      { 
        error: 'Failed to debug test recent edits',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
