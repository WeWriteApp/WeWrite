/**
 * Utility to create test page links for graph visualization testing
 * This helps verify that the graph system works when there are actual connections
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName } from './environmentConfig';

interface TestLinkData {
  sourcePageId: string;
  targetPageId: string;
  linkText: string;
}

/**
 * Create test links between pages to verify graph functionality
 */
export async function createTestPageLinks(links: TestLinkData[]) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }

    const db = admin.firestore();
    const batch = db.batch();

    for (const link of links) {
      // Get source page data
      const sourcePageRef = db.collection(getCollectionName('pages')).doc(link.sourcePageId);
      const sourcePageDoc = await sourcePageRef.get();
      
      if (!sourcePageDoc.exists) {
        console.warn(`Source page ${link.sourcePageId} not found`);
        continue;
      }

      // Get target page data
      const targetPageRef = db.collection(getCollectionName('pages')).doc(link.targetPageId);
      const targetPageDoc = await targetPageRef.get();
      
      if (!targetPageDoc.exists) {
        console.warn(`Target page ${link.targetPageId} not found`);
        continue;
      }

      const sourceData = sourcePageDoc.data();
      const targetData = targetPageDoc.data();

      // Update source page content to include a link to target page
      const currentContent = sourceData?.content || '[]';
      let contentNodes;
      
      try {
        contentNodes = JSON.parse(currentContent);
      } catch {
        contentNodes = [];
      }

      // Add a new paragraph with a page link
      const linkNode = {
        type: 'paragraph',
        children: [
          { text: 'Link to ' },
          {
            type: 'link',
            url: `/${link.targetPageId}`,
            pageId: link.targetPageId,
            isPageLink: true,
            pageTitle: targetData?.title || 'Untitled',
            children: [{ text: link.linkText }]
          },
          { text: ' (test link)' }
        ]
      };

      contentNodes.push(linkNode);

      // Update the source page
      batch.update(sourcePageRef, {
        content: JSON.stringify(contentNodes),
        lastModified: new Date()
      });

      // Create backlink entry
      const backlinkRef = db.collection(getCollectionName('backlinks')).doc();
      batch.set(backlinkRef, {
        sourcePageId: link.sourcePageId,
        sourcePageTitle: sourceData?.title || 'Untitled',
        sourceUsername: sourceData?.username || 'unknown',
        targetPageId: link.targetPageId,
        targetPageTitle: targetData?.title || 'Untitled',
        targetUsername: targetData?.username || 'unknown',
        linkText: link.linkText,
        isPublic: sourceData?.isPublic !== false,
        lastModified: new Date(),
        createdAt: new Date()
      });
    }

    await batch.commit();
    
    return { success: true, linksCreated: links.length };
  } catch (error) {
    console.error('❌ Error creating test links:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate test links between existing pages
 */
export async function generateTestLinksForExistingPages() {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }

    const db = admin.firestore();
    
    // Get some existing pages
    const pagesSnapshot = await db.collection(getCollectionName('pages'))
      .where('isPublic', '==', true)
      .limit(6)
      .get();

    const pages = pagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (pages.length < 2) {
      console.warn('Not enough pages to create test links');
      return { success: false, error: 'Need at least 2 pages' };
    }

    // Create some test links between pages
    const testLinks: TestLinkData[] = [];
    
    // Create a chain of links: page1 -> page2 -> page3, etc.
    for (let i = 0; i < pages.length - 1; i++) {
      testLinks.push({
        sourcePageId: pages[i].id,
        targetPageId: pages[i + 1].id,
        linkText: pages[i + 1].title || 'Linked Page'
      });
    }

    // Create some additional cross-links for more interesting graph
    if (pages.length >= 4) {
      testLinks.push({
        sourcePageId: pages[0].id,
        targetPageId: pages[2].id,
        linkText: pages[2].title || 'Cross Link'
      });
      
      testLinks.push({
        sourcePageId: pages[3].id,
        targetPageId: pages[0].id,
        linkText: pages[0].title || 'Back Link'
      });
    }

    return await createTestPageLinks(testLinks);
  } catch (error) {
    console.error('❌ Error generating test links:', error);
    return { success: false, error: error.message };
  }
}
