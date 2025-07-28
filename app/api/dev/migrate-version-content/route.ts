import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Migration API: Fix pages with null content but existing versions
 * 
 * This API finds pages where:
 * - Page content is null
 * - But versions exist with actual content
 * - Migrates the latest version content back to the page
 * 
 * Usage: GET /api/dev/migrate-version-content?dry-run=true
 */

interface MigrationResult {
  pageId: string;
  title: string;
  status: 'migrated' | 'skipped' | 'error';
  reason?: string;
  contentLength?: number;
  versionId?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dry-run') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const specificPageId = searchParams.get('pageId');
    const useProduction = searchParams.get('production') === 'true';

    console.log('🔄 Starting version content migration', {
      dryRun,
      limit,
      specificPageId,
      useProduction
    });

    const admin = initAdmin();
    const db = admin.firestore();

    // Use production collections if specified, otherwise use environment-aware collections
    const pagesCollection = useProduction ? 'pages' : getCollectionName('pages');

    // Build query
    let pagesQuery = db.collection(pagesCollection);
    
    if (specificPageId) {
      // Migrate specific page
      const pageDoc = await db.collection(pagesCollection).doc(specificPageId).get();
      if (!pageDoc.exists) {
        return NextResponse.json({
          error: 'Page not found',
          pageId: specificPageId
        }, { status: 404 });
      }
      
      const result = await migratePage(db, specificPageId, pageDoc.data()!, dryRun, useProduction);
      return NextResponse.json({
        success: true,
        dryRun,
        results: [result],
        summary: {
          total: 1,
          migrated: result.status === 'migrated' ? 1 : 0,
          skipped: result.status === 'skipped' ? 1 : 0,
          errors: result.status === 'error' ? 1 : 0
        }
      });
    }

    // Find pages with missing content (null, undefined, or empty)
    // We need to get all pages and filter in memory since Firestore can't query for undefined
    const allPagesSnapshot = await pagesQuery
      .limit(limit)
      .get();

    console.log(`📊 Checking ${allPagesSnapshot.size} pages for missing content`);

    // Filter pages that need migration (null, undefined, or empty content)
    const pagesToMigrate = allPagesSnapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.content || data.content === null || data.content === '';
    });

    console.log(`📊 Found ${pagesToMigrate.length} pages needing migration`);

    const results: MigrationResult[] = [];
    const summary = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0
    };

    // Process each page that needs migration
    for (const pageDoc of pagesToMigrate) {
      const pageData = pageDoc.data();
      const result = await migratePage(db, pageDoc.id, pageData, dryRun, useProduction);

      results.push(result);
      summary.total++;

      if (result.status === 'migrated') summary.migrated++;
      else if (result.status === 'skipped') summary.skipped++;
      else if (result.status === 'error') summary.errors++;
    }

    return NextResponse.json({
      success: true,
      dryRun,
      results,
      summary,
      instructions: dryRun ? [
        '🔍 DRY RUN COMPLETE - No changes made',
        '📊 Review the results above',
        '🚀 To execute migration: Remove ?dry-run=true from URL',
        '⚠️  Always backup data before running live migration'
      ] : [
        '✅ MIGRATION COMPLETE',
        '📊 Check results above for any errors',
        '🔄 Pages with migrated content should now display properly',
        '🧹 Consider running again to catch any remaining pages'
      ]
    });

  } catch (error) {
    console.error('Error in version content migration:', error);
    return NextResponse.json({
      error: 'Migration failed',
      message: error.message
    }, { status: 500 });
  }
}

async function migratePage(
  db: FirebaseFirestore.Firestore,
  pageId: string,
  pageData: any,
  dryRun: boolean,
  useProduction: boolean = false
): Promise<MigrationResult> {
  try {
    console.log(`📄 Processing page ${pageId}: "${pageData.title}"`);

    // Check if page already has content
    if (pageData.content && pageData.content !== null) {
      return {
        pageId,
        title: pageData.title || 'Untitled',
        status: 'skipped',
        reason: 'Page already has content'
      };
    }

    // Get versions for this page
    const pagesCollectionName = useProduction ? 'pages' : getCollectionName('pages');
    // Versions subcollection is always just 'versions' regardless of environment
    const versionsCollectionName = 'versions';

    console.log(`🔍 Looking for versions in: ${pagesCollectionName}/${pageId}/${versionsCollectionName}`);

    const versionsSnapshot = await db
      .collection(pagesCollectionName)
      .doc(pageId)
      .collection(versionsCollectionName)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    console.log(`📊 Found ${versionsSnapshot.size} versions for page ${pageId}`);

    if (versionsSnapshot.empty) {
      return {
        pageId,
        title: pageData.title || 'Untitled',
        status: 'skipped',
        reason: 'No versions found'
      };
    }

    // Get the latest version
    const latestVersion = versionsSnapshot.docs[0];
    const versionData = latestVersion.data();

    if (!versionData.content) {
      return {
        pageId,
        title: pageData.title || 'Untitled',
        status: 'skipped',
        reason: 'Latest version has no content'
      };
    }

    console.log(`  📝 Found content in version ${latestVersion.id}`);
    console.log(`  📏 Content length: ${versionData.content.length} characters`);

    if (dryRun) {
      return {
        pageId,
        title: pageData.title || 'Untitled',
        status: 'migrated',
        reason: 'DRY RUN: Would migrate content from version',
        contentLength: versionData.content.length,
        versionId: latestVersion.id
      };
    }

    // Migrate content from version to page
    await db.collection(pagesCollectionName).doc(pageId).update({
      content: versionData.content,
      currentVersion: latestVersion.id,
      lastModified: new Date().toISOString(),
      migratedFromVersion: latestVersion.id,
      migrationTimestamp: new Date().toISOString()
    });

    console.log(`  ✅ Migrated content from version ${latestVersion.id} to page ${pageId}`);

    return {
      pageId,
      title: pageData.title || 'Untitled',
      status: 'migrated',
      reason: 'Content migrated from latest version',
      contentLength: versionData.content.length,
      versionId: latestVersion.id
    };

  } catch (error) {
    console.error(`  ❌ Error processing page ${pageId}:`, error);
    return {
      pageId,
      title: pageData.title || 'Untitled',
      status: 'error',
      reason: error.message
    };
  }
}
