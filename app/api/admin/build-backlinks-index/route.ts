/**
 * Admin endpoint to build backlinks index for production environment
 * This populates the backlinks collection so that BacklinksSection and RelatedPagesSection work properly
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (adminCheck.error) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    console.log('🚀 Starting backlinks index build for production...');

    // Get all public pages
    const pagesSnapshot = await db.collection(getCollectionName('pages'))
      .where('isPublic', '==', true)
      .where('deleted', '!=', true)
      .limit(100) // Process in batches to avoid timeouts
      .get();

    console.log(`Found ${pagesSnapshot.size} pages to process`);

    let processedCount = 0;
    let errorCount = 0;
    let backlinksCreated = 0;
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

        // Extract page links from content
        const pageLinks = extractPageLinksFromContent(contentNodes);
        
        // Create backlink entries for each linked page
        for (const link of pageLinks) {
          if (link.pageId && link.pageId !== pageId) {
            try {
              // Create backlink document
              const backlinkId = `${pageId}_${link.pageId}`;
              await db.collection(getCollectionName('backlinks')).doc(backlinkId).set({
                sourcePageId: pageId,
                sourcePageTitle: pageData.title || 'Untitled',
                sourceUsername: pageData.username || 'Unknown',
                targetPageId: link.pageId,
                linkText: link.text || link.pageTitle || 'Link',
                isPublic: pageData.isPublic || false,
                lastModified: pageData.lastModified || admin.firestore.Timestamp.now(),
                createdAt: admin.firestore.Timestamp.now()
              });
              
              backlinksCreated++;
            } catch (backlinkError) {
              console.warn(`Error creating backlink from ${pageId} to ${link.pageId}:`, backlinkError);
            }
          }
        }

        processedCount++;
        results.push({
          pageId,
          title: pageData.title || 'Untitled',
          status: 'success',
          linksFound: pageLinks.length
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

    // Check final backlinks count
    const backlinksSnapshot = await db.collection(getCollectionName('backlinks')).limit(10).get();

    const response = {
      timestamp: new Date().toISOString(),
      results: {
        totalPages: pagesSnapshot.size,
        processedSuccessfully: processedCount,
        errors: errorCount,
        backlinksCreated,
        backlinksInCollection: backlinksSnapshot.size,
        details: results
      },
      message: `Backlinks index build completed. Processed ${processedCount} pages, created ${backlinksCreated} backlinks with ${errorCount} errors.`
    };

    console.log('🎉 Backlinks index build completed');
    console.log(`✅ Successfully processed: ${processedCount} pages`);
    console.log(`🔗 Backlinks created: ${backlinksCreated}`);
    console.log(`❌ Errors: ${errorCount} pages`);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('💥 Fatal error building backlinks index:', error);
    return NextResponse.json({
      error: 'Failed to build backlinks index',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Helper function to extract page links from content
function extractPageLinksFromContent(contentNodes: any[]): Array<{pageId: string, text: string, pageTitle?: string}> {
  const links: Array<{pageId: string, text: string, pageTitle?: string}> = [];
  
  if (!Array.isArray(contentNodes)) {
    return links;
  }
  
  for (const node of contentNodes) {
    if (node && typeof node === 'object') {
      // Check if this node is a paragraph with children
      if (node.type === 'paragraph' && Array.isArray(node.children)) {
        for (const child of node.children) {
          if (child && child.type === 'link' && child.pageId) {
            links.push({
              pageId: child.pageId,
              text: child.text || child.children?.[0]?.text || 'Link',
              pageTitle: child.pageTitle
            });
          }
        }
      }
      // Check if this node is directly a link
      else if (node.type === 'link' && node.pageId) {
        links.push({
          pageId: node.pageId,
          text: node.text || node.children?.[0]?.text || 'Link',
          pageTitle: node.pageTitle
        });
      }
    }
  }
  
  return links;
}

// GET endpoint to check current backlinks status
export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (adminCheck.error) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Check current backlinks count
    const backlinksSnapshot = await db.collection(getCollectionName('backlinks')).limit(100).get();
    const pagesSnapshot = await db.collection(getCollectionName('pages'))
      .where('isPublic', '==', true)
      .where('deleted', '!=', true)
      .limit(10)
      .get();

    // Sample some backlinks
    const sampleBacklinks = backlinksSnapshot.docs.slice(0, 5).map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: {
        totalBacklinks: backlinksSnapshot.size,
        totalPublicPages: pagesSnapshot.size,
        sampleBacklinks,
        needsIndexBuild: backlinksSnapshot.size === 0
      },
      collections: {
        pages: getCollectionName('pages'),
        backlinks: getCollectionName('backlinks')
      }
    });

  } catch (error) {
    console.error('Error checking backlinks status:', error);
    return NextResponse.json({
      error: 'Failed to check backlinks status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
