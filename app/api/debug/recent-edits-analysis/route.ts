import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Debug endpoint to analyze recent edits data and migration impact
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();

    // Get recent pages ordered by lastModified
    const pagesQuery = db.collection(getCollectionName('pages'))
      .orderBy('lastModified', 'desc')
      .limit(limit);

    const pagesSnapshot = await pagesQuery.get();
    
    const analysis = {
      totalPages: pagesSnapshot.size,
      pages: [],
      summary: {
        migrationVersions: 0,
        userVersions: 0,
        pagesWithoutVersions: 0,
        recentUserEdits: 0,
        oldMigrationOnly: 0,
      }
    };

    for (const pageDoc of pagesSnapshot.docs) {
      const page = { id: pageDoc.id, ...pageDoc.data() };
      
      // Get versions for this page
      const versionsQuery = db.collection(getCollectionName('pages'))
        .doc(page.id)
        .collection('versions')
        .orderBy('createdAt', 'desc')
        .limit(5);

      const versionsSnapshot = await versionsQuery.get();
      
      const versions = versionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      }));

      const pageLastModified = page.lastModified?.toDate ? page.lastModified.toDate() : new Date(page.lastModified);
      const daysSinceModified = (new Date().getTime() - pageLastModified.getTime()) / (24 * 60 * 60 * 1000);
      
      const latestVersion = versions[0];
      const isMigrationVersion = latestVersion?.optimizationMigration || latestVersion?.migratedFromVersion;
      const hasUserVersions = versions.some(v => !v.optimizationMigration && !v.migratedFromVersion);
      
      // Categorize
      if (!latestVersion) {
        analysis.summary.pagesWithoutVersions++;
      } else if (isMigrationVersion && !hasUserVersions && daysSinceModified > 7) {
        analysis.summary.oldMigrationOnly++;
      } else if (isMigrationVersion) {
        analysis.summary.migrationVersions++;
      } else {
        analysis.summary.userVersions++;
      }
      
      if (daysSinceModified <= 7) {
        analysis.summary.recentUserEdits++;
      }

      const pageAnalysis = {
        id: page.id,
        title: page.title || 'Untitled',
        userId: page.userId,
        username: page.username,
        lastModified: pageLastModified.toISOString(),
        daysSinceModified: Math.round(daysSinceModified * 100) / 100,
        isPublic: page.isPublic,
        deleted: page.deleted,
        versionsCount: versions.length,
        latestVersion: latestVersion ? {
          id: latestVersion.id,
          createdAt: latestVersion.createdAt,
          isMigration: isMigrationVersion,
          optimizationMigration: latestVersion.optimizationMigration,
          migratedFromVersion: latestVersion.migratedFromVersion,
        } : null,
        hasUserVersions,
        wouldShowInRecentEdits: !page.deleted && (daysSinceModified <= 7 || hasUserVersions),
        filterReason: page.deleted ? 'deleted' : 
                    (isMigrationVersion && !hasUserVersions && daysSinceModified > 7) ? 'old migration only' :
                    daysSinceModified > 7 && !hasUserVersions ? 'too old' : 'none'
      };

      analysis.pages.push(pageAnalysis);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      analysis,
      recommendations: {
        pagesFilteredOut: analysis.pages.filter(p => !p.wouldShowInRecentEdits).length,
        mainIssues: [
          analysis.summary.oldMigrationOnly > 0 ? `${analysis.summary.oldMigrationOnly} pages filtered out due to old migration versions` : null,
          analysis.summary.pagesWithoutVersions > 0 ? `${analysis.summary.pagesWithoutVersions} pages have no versions` : null,
        ].filter(Boolean)
      }
    });

  } catch (error) {
    console.error('Error analyzing recent edits:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze recent edits data',
      details: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
