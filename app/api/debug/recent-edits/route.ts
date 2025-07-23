import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Debug API to check recent edits data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Initialize Firebase Admin
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    // Get recent pages ordered by lastModified
    let pagesQuery;
    if (userId) {
      pagesQuery = db.collection(getCollectionName('pages'))
        .orderBy('lastModified', 'desc')
        .limit(20);
    } else {
      pagesQuery = db.collection(getCollectionName('pages'))
        .where('isPublic', '==', true)
        .orderBy('lastModified', 'desc')
        .limit(20);
    }

    const snapshot = await pagesQuery.get();
    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter out deleted pages
    const filteredPages = pages.filter(page => page.deleted !== true);

    // Analyze the data
    const analysis = {
      totalPages: pages.length,
      filteredPages: filteredPages.length,
      pagesWithLastDiff: filteredPages.filter(p => !!p.lastDiff).length,
      pagesWithChanges: filteredPages.filter(p => p.lastDiff?.hasChanges).length,
      
      // Sample pages with detailed info
      samplePages: filteredPages.slice(0, 10).map(p => ({
        id: p.id,
        title: p.title,
        userId: p.userId,
        username: p.username,
        lastModified: p.lastModified,
        isPublic: p.isPublic,
        deleted: p.deleted,
        hasLastDiff: !!p.lastDiff,
        lastDiff: p.lastDiff,
        lastDiffHasChanges: p.lastDiff?.hasChanges
      })),

      // Pages that would show in recent edits (using same logic as main API)
      recentEditsPages: filteredPages
        .filter(p => {
          if (!p.lastModified) return false;
          const lastModifiedDate = p.lastModified.toDate ? p.lastModified.toDate() : new Date(p.lastModified);
          const daysSinceModified = (new Date().getTime() - lastModifiedDate.getTime()) / (24 * 60 * 60 * 1000);
          return daysSinceModified <= 7 || p.lastDiff?.hasChanges === true;
        })
        .slice(0, 8)
        .map(p => {
          const lastModifiedDate = p.lastModified?.toDate ? p.lastModified.toDate() : new Date(p.lastModified);
          const daysSinceModified = p.lastModified ? (new Date().getTime() - lastModifiedDate.getTime()) / (24 * 60 * 60 * 1000) : null;

          return {
            id: p.id,
            title: p.title,
            userId: p.userId,
            username: p.username,
            lastModified: p.lastModified,
            daysSinceModified: daysSinceModified?.toFixed(2),
            lastDiff: p.lastDiff
          };
        })
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      collections: {
        pages: getCollectionName('pages')
      },
      userId,
      analysis
    });

  } catch (error) {
    console.error('Error in recent edits debug:', error);
    return NextResponse.json(
      { 
        error: 'Failed to debug recent edits',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
