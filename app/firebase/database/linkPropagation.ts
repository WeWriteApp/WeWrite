/**
 * Link Propagation System
 * 
 * Handles automatic propagation of page title changes to all existing links
 * that reference the page across the entire application.
 */

import { db } from './core';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { getCollectionName } from '../../utils/environmentConfig';

interface LinkReference {
  pageId: string;
  linkData: any;
  needsUpdate: boolean;
  isCompoundLink: boolean;
}

/**
 * Propagate page title updates to all links referencing the page
 */
export const propagatePageTitleUpdate = async (
  targetPageId: string,
  newTitle: string,
  oldTitle: string
): Promise<void> => {
  console.log(`🔄 Starting title propagation for page ${targetPageId}: "${oldTitle}" -> "${newTitle}"`);

  try {
    // Find all pages that might contain links to this page
    const linkReferences = await findAllLinksToPage(targetPageId);

    if (linkReferences.length === 0) {
      console.log(`✅ No links found referencing page ${targetPageId} - propagation complete`);
      // Still trigger real-time updates for any open pages
      triggerRealTimeUpdates(targetPageId, newTitle);
      return;
    }

    console.log(`📝 Found ${linkReferences.length} potential link references to update`);

    // Process updates in batches to avoid Firestore limits
    const batchSize = 500; // Firestore batch limit
    const batches = [];
    
    for (let i = 0; i < linkReferences.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchRefs = linkReferences.slice(i, i + batchSize);
      
      for (const ref of batchRefs) {
        if (ref.needsUpdate) {
          const updatedContent = updateLinksInContent(ref.linkData, targetPageId, newTitle, oldTitle);
          if (updatedContent) {
const pageRef = doc(db, getCollectionName("pages"), ref.pageId);
            batch.update(pageRef, { 
              content: JSON.stringify(updatedContent),
              lastModified: new Date().toISOString()
            });
          }
        }
      }
      
      if (batchRefs.some(ref => ref.needsUpdate)) {
        batches.push(batch);
      }
    }

    // Execute all batches
    for (const batch of batches) {
      await batch.commit();
    }

    console.log(`✅ Successfully propagated title update to ${batches.length} batches`);

    // Trigger real-time updates for any open pages
    triggerRealTimeUpdates(targetPageId, newTitle);

  } catch (error) {
    console.error('Error propagating page title update:', error);
    throw error;
  }
};

/**
 * Find all pages that contain links to the target page
 */
const findAllLinksToPage = async (targetPageId: string): Promise<LinkReference[]> => {
  const linkReferences: LinkReference[] = [];

  try {
    // Query all pages (we'll need to search their content for links)
    // Note: We can't use where('deleted', '!=', true) because it requires an index
    // Instead, we'll filter out deleted pages in the processing loop
    const pagesQuery = query(collection(db, getCollectionName('pages')));

    const querySnapshot = await getDocs(pagesQuery);
    
    for (const docSnapshot of querySnapshot.docs) {
      const pageData = docSnapshot.data();
      const pageId = docSnapshot.id;

      // Skip the target page itself
      if (pageId === targetPageId) continue;

      // Skip soft-deleted pages
      if (pageData.deleted === true) continue;

      // Parse page content to look for links
      if (pageData.content) {
        try {
          const content = typeof pageData.content === 'string'
            ? JSON.parse(pageData.content)
            : pageData.content;

          const hasLinksToTarget = checkContentForLinks(content, targetPageId);

          if (hasLinksToTarget.found) {
            linkReferences.push({
              pageId,
              linkData: content,
              needsUpdate: hasLinksToTarget.needsUpdate,
              isCompoundLink: hasLinksToTarget.hasCompoundLinks
            });
          }
        } catch (error) {
          console.warn(`Error parsing content for page ${pageId}:`, error);
        }
      }
    }
    
  } catch (error) {
    console.error('Error finding links to page:', error);
  }
  
  return linkReferences;
};

/**
 * Check if content contains links to the target page and if they need updating
 */
const checkContentForLinks = (content: any[], targetPageId: string): {
  found: boolean;
  needsUpdate: boolean;
  hasCompoundLinks: boolean;
} => {
  let found = false;
  let needsUpdate = false;
  let hasCompoundLinks = false;
  
  const checkNode = (node: any) => {
    if (!node) return;
    
    // Check if this is a link to our target page
    if (node.type === 'link' && node.pageId === targetPageId) {
      found = true;
      
      // Check if this link needs updating (not custom text)
      if (shouldUpdateLink(node)) {
        needsUpdate = true;
      }
      
      // Check if it's a compound link
      if (node.showAuthor && node.authorUsername) {
        hasCompoundLinks = true;
      }
    }
    
    // Recursively check children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const childResult = checkNode(child);
        if (childResult) {
          found = found || childResult.found;
          needsUpdate = needsUpdate || childResult.needsUpdate;
          hasCompoundLinks = hasCompoundLinks || childResult.hasCompoundLinks;
        }
      }
    }
  };
  
  if (Array.isArray(content)) {
    for (const node of content) {
      checkNode(node);
    }
  }
  
  return { found, needsUpdate, hasCompoundLinks };
};

/**
 * Determine if a link should be updated (not custom text)
 */
const shouldUpdateLink = (linkNode: any): boolean => {
  // If the link has custom display text that differs from the original page title,
  // don't update it (preserve user customization)
  if (linkNode.displayText && 
      linkNode.originalPageTitle && 
      linkNode.displayText !== linkNode.originalPageTitle) {
    return false;
  }
  
  // If displayText matches pageTitle or originalPageTitle, it's auto-generated
  if (linkNode.displayText === linkNode.pageTitle || 
      linkNode.displayText === linkNode.originalPageTitle) {
    return true;
  }
  
  // If no displayText but has pageTitle, it's auto-generated
  if (!linkNode.displayText && linkNode.pageTitle) {
    return true;
  }
  
  // Default to updating if we can't determine (safer to update)
  return true;
};

/**
 * Update all links in content that reference the target page
 */
const updateLinksInContent = (
  content: any[], 
  targetPageId: string, 
  newTitle: string, 
  oldTitle: string
): any[] | null => {
  let hasChanges = false;
  
  const updateNode = (node: any): any => {
    if (!node) return node;
    
    // If this is a link to our target page
    if (node.type === 'link' && node.pageId === targetPageId) {
      if (shouldUpdateLink(node)) {
        hasChanges = true;
        
        // Update the link with new title
        const updatedNode = { ...node };
        
        // Update pageTitle and originalPageTitle
        updatedNode.pageTitle = newTitle;
        updatedNode.originalPageTitle = newTitle;
        
        // Update displayText if it was auto-generated
        if (!updatedNode.displayText || 
            updatedNode.displayText === oldTitle ||
            updatedNode.displayText === node.pageTitle ||
            updatedNode.displayText === node.originalPageTitle) {
          updatedNode.displayText = newTitle;
        }
        
        // Update children text for compound links
        if (updatedNode.children && Array.isArray(updatedNode.children)) {
          updatedNode.children = updatedNode.children.map(child => {
            if (child.text === oldTitle || 
                child.text === node.pageTitle ||
                child.text === node.originalPageTitle) {
              return { ...child, text: newTitle };
            }
            return child;
          });
        }
        
        console.log(`Updated link: "${oldTitle}" -> "${newTitle}"`);
        return updatedNode;
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
  
  return hasChanges ? updatedContent : null;
};

/**
 * Trigger real-time updates for any open pages
 */
const triggerRealTimeUpdates = (targetPageId: string, newTitle: string): void => {
  // Dispatch custom event for real-time UI updates
  if (typeof window !== 'undefined') {
    console.log(`📡 Broadcasting real-time title update: ${targetPageId} -> "${newTitle}"`);
    window.dispatchEvent(new CustomEvent('page-title-updated', {
      detail: {
        pageId: targetPageId,
        newTitle: newTitle,
        timestamp: new Date().toISOString()
      }
    }));
  }
};