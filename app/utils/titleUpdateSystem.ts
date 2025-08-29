/**
 * Simplified Title Update System
 * 
 * This replaces the complex event-based system with a simple, direct approach:
 * 1. When a page title changes, find all pages that link to it
 * 2. Update those pages directly in the database
 * 3. Update the current editor if it contains links to the changed page
 * 4. No events, no complex propagation - just direct updates
 */

import { getFirebaseAdmin } from '../firebase/admin';
import { getCollectionName } from '../utils/environmentConfig';

export interface TitleUpdateResult {
  success: boolean;
  updatedPages: string[];
  errors: string[];
}

/**
 * Update all links to a page when its title changes
 * This is called after a successful page save
 */
export async function updateLinksAfterTitleChange(
  pageId: string,
  newTitle: string,
  oldTitle: string
): Promise<TitleUpdateResult> {
  console.log(`🔄 TITLE_UPDATE: Starting title update for ${pageId}: "${oldTitle}" -> "${newTitle}"`);
  
  const result: TitleUpdateResult = {
    success: true,
    updatedPages: [],
    errors: []
  };

  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }
    
    const db = admin.firestore();
    const pagesCollection = getCollectionName('pages');
    
    // Find all pages that might contain links to this page
    console.log(`🔍 TITLE_UPDATE: Searching for pages with links to ${pageId}`);
    
    const allPagesSnapshot = await db.collection(pagesCollection)
      .where('deleted', '==', false)
      .get();
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of allPagesSnapshot.docs) {
      const pageData = doc.data();
      
      if (!pageData.content || typeof pageData.content !== 'string') {
        continue;
      }
      
      try {
        // Parse content and look for links to our page
        const content = JSON.parse(pageData.content);
        let hasChanges = false;
        
        const updatedContent = updateLinksInContent(content, pageId, newTitle, oldTitle);
        
        if (updatedContent.hasChanges) {
          console.log(`📝 TITLE_UPDATE: Updating page ${doc.id} with new link text`);
          
          batch.update(doc.ref, {
            content: JSON.stringify(updatedContent.content),
            lastModified: new Date().toISOString()
          });
          
          result.updatedPages.push(doc.id);
          batchCount++;
          
          // Firestore batch limit is 500 operations
          if (batchCount >= 400) {
            await batch.commit();
            console.log(`💾 TITLE_UPDATE: Committed batch of ${batchCount} updates`);
            batchCount = 0;
          }
        }
      } catch (parseError) {
        console.warn(`⚠️ TITLE_UPDATE: Could not parse content for page ${doc.id}:`, parseError);
        result.errors.push(`Failed to parse content for page ${doc.id}`);
      }
    }
    
    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`💾 TITLE_UPDATE: Committed final batch of ${batchCount} updates`);
    }
    
    console.log(`✅ TITLE_UPDATE: Successfully updated ${result.updatedPages.length} pages`);
    
  } catch (error) {
    console.error('❌ TITLE_UPDATE: Error updating links:', error);
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }
  
  return result;
}

/**
 * Update links in content structure
 */
function updateLinksInContent(
  content: any[],
  targetPageId: string,
  newTitle: string,
  oldTitle: string
): { content: any[], hasChanges: boolean } {
  let hasChanges = false;
  
  const updateNode = (node: any): any => {
    if (!node) return node;
    
    // If this is a link to our target page
    if (node.type === 'link' && node.pageId === targetPageId) {
      const currentDisplayText = node.children?.[0]?.text || node.displayText || '';
      
      // Only update if the current text matches the old title (not custom text)
      if (currentDisplayText === oldTitle || 
          currentDisplayText === node.pageTitle || 
          currentDisplayText === node.originalPageTitle ||
          !currentDisplayText) {
        
        console.log(`🔗 TITLE_UPDATE: Updating link text: "${currentDisplayText}" -> "${newTitle}"`);
        hasChanges = true;
        
        return {
          ...node,
          pageTitle: newTitle,
          originalPageTitle: newTitle,
          displayText: newTitle,
          children: [{ text: newTitle }]
        };
      }
    }
    
    // Recursively update children
    if (node.children && Array.isArray(node.children)) {
      const updatedChildren = node.children.map(updateNode);
      return { ...node, children: updatedChildren };
    }
    
    return node;
  };
  
  const updatedContent = content.map(updateNode);
  
  return {
    content: updatedContent,
    hasChanges
  };
}

/**
 * Update the current editor with new link titles
 * This is called on the frontend after a successful save
 */
export function updateCurrentEditorLinks(
  editorContent: any[],
  pageId: string,
  newTitle: string,
  oldTitle: string
): { content: any[], hasChanges: boolean } {
  console.log(`🔗 EDITOR_UPDATE: Updating current editor links for ${pageId}: "${oldTitle}" -> "${newTitle}"`);
  
  return updateLinksInContent(editorContent, pageId, newTitle, oldTitle);
}

/**
 * Simple function to trigger title updates from the API
 * This replaces the complex event system
 */
export async function handleTitleChangeAfterSave(
  pageId: string,
  newTitle: string,
  oldTitle: string
): Promise<void> {
  if (newTitle === oldTitle) {
    console.log('🔄 TITLE_UPDATE: No title change detected, skipping update');
    return;
  }
  
  console.log(`🚀 TITLE_UPDATE: Handling title change for ${pageId}`);
  
  // Update all linked pages in the background
  // Don't await this to avoid slowing down the save response
  updateLinksAfterTitleChange(pageId, newTitle, oldTitle)
    .then(result => {
      if (result.success) {
        console.log(`✅ TITLE_UPDATE: Background update completed for ${result.updatedPages.length} pages`);
      } else {
        console.error('❌ TITLE_UPDATE: Background update failed:', result.errors);
      }
    })
    .catch(error => {
      console.error('❌ TITLE_UPDATE: Background update error:', error);
    });
}
