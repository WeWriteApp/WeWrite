import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Development endpoint to fix pages that have null content
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development' || process.env.USE_DEV_AUTH !== 'true') {
      return NextResponse.json({
        error: 'Development auth not active'
      }, { status: 400 });
    }

    const admin = initAdmin();
    const db = admin.firestore();

    console.log('🔧 Fixing pages with null content...');

    // Get all pages
    const pagesCollectionName = getCollectionName('pages');
    const pagesSnapshot = await db.collection(pagesCollectionName).get();
    
    const results = [];
    let fixedCount = 0;

    for (const doc of pagesSnapshot.docs) {
      const pageData = doc.data();
      
      // Check if page has null or undefined content
      if (pageData.content === null || pageData.content === undefined) {
        console.log(`Fixing page: ${doc.id} - "${pageData.title}"`);
        
        // Create default content based on the page title
        const defaultContent = JSON.stringify([
          {
            type: "heading",
            level: 1,
            children: [{ text: pageData.title || "Untitled" }]
          },
          {
            type: "paragraph", 
            children: [{ text: "This page is ready for content. Click edit to start writing!" }]
          }
        ]);

        // Update the page with default content
        await doc.ref.update({
          content: defaultContent,
          lastModified: new Date().toISOString()
        });

        results.push({
          pageId: doc.id,
          title: pageData.title,
          status: 'fixed',
          contentAdded: true
        });
        
        fixedCount++;
      } else {
        results.push({
          pageId: doc.id,
          title: pageData.title,
          status: 'already_has_content',
          contentAdded: false
        });
      }
    }

    console.log(`✅ Fixed ${fixedCount} pages with null content`);

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} pages with null content`,
      results,
      summary: {
        totalPages: pagesSnapshot.size,
        pagesFixed: fixedCount,
        pagesWithContent: pagesSnapshot.size - fixedCount
      }
    });

  } catch (error) {
    console.error('Error fixing page content:', error);
    return NextResponse.json({
      error: 'Failed to fix page content',
      message: error.message
    }, { status: 500 });
  }
}
