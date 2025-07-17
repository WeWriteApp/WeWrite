/**
 * Build Backlinks Index Debug Endpoint
 * 
 * Manually triggers backlinks index building for testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getEnvironmentType, getCollectionName } from '../../../utils/environmentConfig';

export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({
        error: 'Firebase Admin not initialized',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const db = admin.firestore();
    const envType = getEnvironmentType();

    console.log('🚀 Starting backlinks index build via API...');
    console.log('Environment:', envType);
    console.log('Collection prefix:', getCollectionName(''));

    // Get all pages
    const pagesSnapshot = await db.collection(getCollectionName('pages'))
      .where('deleted', '!=', true)
      .limit(50) // Limit for testing
      .get();

    console.log(`Found ${pagesSnapshot.size} pages to process`);

    let processedCount = 0;
    let errorCount = 0;
    const results = [];

    // Process each page
    for (const pageDoc of pagesSnapshot.docs) {
      try {
        const pageData = pageDoc.data();
        const pageId = pageDoc.id;

        console.log(`Processing page: ${pageData.title || 'Untitled'} (${pageId})`);

        // Parse content to extract links
        let contentNodes = [];
        if (pageData.content) {
          try {
            if (typeof pageData.content === 'string') {
              contentNodes = JSON.parse(pageData.content);
            } else {
              contentNodes = pageData.content;
            }
          } catch (parseError) {
            console.warn(`Could not parse content for page ${pageId}:`, parseError.message);
            contentNodes = [];
          }
        }

        // Import and use the updateBacklinksIndex function
        const { updateBacklinksIndex } = await import('../../../firebase/database/backlinks');
        
        await updateBacklinksIndex(
          pageId,
          pageData.title || 'Untitled',
          pageData.username || 'unknown',
          contentNodes,
          pageData.isPublic || false,
          pageData.lastModified
        );

        processedCount++;
        results.push({
          pageId,
          title: pageData.title || 'Untitled',
          status: 'success',
          linksFound: Array.isArray(contentNodes) ? contentNodes.filter(node => 
            node && typeof node === 'object' && node.type === 'link'
          ).length : 0
        });

      } catch (error) {
        console.error(`❌ Error processing page ${pageDoc.id}:`, error);
        errorCount++;
        results.push({
          pageId: pageDoc.id,
          title: pageDoc.data().title || 'Untitled',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Check backlinks collection after building
    const backlinksSnapshot = await db.collection(getCollectionName('backlinks')).limit(10).get();

    const response = {
      timestamp: new Date().toISOString(),
      environment: envType,
      collections: {
        pages: getCollectionName('pages'),
        backlinks: getCollectionName('backlinks')
      },
      results: {
        totalPages: pagesSnapshot.size,
        processedSuccessfully: processedCount,
        errors: errorCount,
        backlinksCreated: backlinksSnapshot.size,
        details: results
      },
      message: `Backlinks index build completed. Processed ${processedCount} pages with ${errorCount} errors.`
    };

    console.log('🎉 Backlinks index build completed via API');
    console.log(`✅ Successfully processed: ${processedCount} pages`);
    console.log(`❌ Errors: ${errorCount} pages`);
    console.log(`🔗 Backlinks in collection: ${backlinksSnapshot.size}`);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('💥 Fatal error building backlinks index via API:', error);
    return NextResponse.json({
      error: 'Failed to build backlinks index',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Also allow GET requests for easier testing
export async function GET(request: NextRequest) {
  return POST(request);
}
