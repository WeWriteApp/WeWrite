import { 
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from './config';
import { Page } from '../types';

// Interface for backlink document
interface BacklinkDocument {
  sourcePageId: string;  // ID of the page containing the link
  targetPageId: string;  // ID of the page being linked to
  createdAt: string;     // When the backlink was created
  updatedAt: string;     // When the backlink was last updated
}

/**
 * Find all pages that link to a specific page
 * @param pageId The ID of the page to find backlinks for
 * @returns Array of pages that link to the specified page
 */
export async function findBacklinks(pageId: string): Promise<Page[]> {
  try {
    // Query the backlinks collection
    const backlinksRef = collection(db, 'backlinks');
    const backlinksQuery = query(
      backlinksRef,
      where('targetPageId', '==', pageId)
    );
    
    const backlinksSnap = await getDocs(backlinksQuery);
    if (backlinksSnap.empty) {
      return [];
    }
    
    // Get unique source page IDs
    const sourcePageIds = new Set<string>();
    backlinksSnap.forEach(doc => {
      const data = doc.data() as BacklinkDocument;
      sourcePageIds.add(data.sourcePageId);
    });
    
    // Fetch page details for each source page
    const pages: Page[] = [];
    const sourceIds = Array.from(sourcePageIds);
    
    for (const sourceId of sourceIds) {
      const pageRef = doc(db, 'pages', sourceId);
      const pageSnap = await getDoc(pageRef);
      
      if (pageSnap.exists()) {
        const pageData = pageSnap.data();
        pages.push({
          id: pageSnap.id,
          title: pageData.title || 'Untitled',
          isPublic: pageData.isPublic || false,
          userId: pageData.userId,
          authorName: pageData.authorName,
          lastModified: pageData.lastModified,
          createdAt: pageData.createdAt || new Date().toISOString()
        });
      }
    }
    
    // Sort by last modified date
    return pages.sort((a, b) => {
      const dateA = new Date(a.lastModified || a.createdAt);
      const dateB = new Date(b.lastModified || b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
    
  } catch (error) {
    console.error('Error finding backlinks:', error);
    return [];
  }
}

/**
 * Update backlinks for a page
 * @param pageId ID of the page being updated
 * @param content Page content to extract links from
 */
export async function updateBacklinks(pageId: string, content: any[]): Promise<void> {
  try {
    // First, find all links in the content
    const currentLinks = new Set<string>();
    
    // Extract links from content
    const extractLinks = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'link' || node.type === 'internal-link') {
          const url = node.url || node.href || node.link;
          if (url) {
            const targetId = extractPageIdFromUrl(url);
            if (targetId) currentLinks.add(targetId);
          }
        }
        
        if (node.children && Array.isArray(node.children)) {
          extractLinks(node.children);
        }
      }
    };
    
    if (Array.isArray(content)) {
      extractLinks(content);
    }
    
    // Get existing backlinks
    const backlinksRef = collection(db, 'backlinks');
    const existingQuery = query(
      backlinksRef,
      where('sourcePageId', '==', pageId)
    );
    const existingSnap = await getDocs(existingQuery);
    
    // Track existing links to avoid duplicates
    const existingLinks = new Set<string>();
    existingSnap.forEach(doc => {
      const data = doc.data() as BacklinkDocument;
      existingLinks.add(data.targetPageId);
    });
    
    // Create batch for updates
    const batch = writeBatch(db);
    const timestamp = new Date().toISOString();
    
    // Add new backlinks
    const newLinks = Array.from(currentLinks);
    for (const targetId of newLinks) {
      if (!existingLinks.has(targetId)) {
        const newBacklinkRef = doc(backlinksRef);
        batch.set(newBacklinkRef, {
          sourcePageId: pageId,
          targetPageId: targetId,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }
    }
    
    // Remove old backlinks that no longer exist
    existingSnap.forEach(doc => {
      const data = doc.data() as BacklinkDocument;
      if (!currentLinks.has(data.targetPageId)) {
        batch.delete(doc.ref);
      }
    });
    
    // Commit all changes
    await batch.commit();
    
  } catch (error) {
    console.error('Error updating backlinks:', error);
    throw error;
  }
}

/**
 * Delete all backlinks for a page
 * @param pageId ID of the page to delete backlinks for
 */
export async function deleteBacklinks(pageId: string): Promise<void> {
  try {
    // Delete backlinks where this page is the source
    const sourceQuery = query(
      collection(db, 'backlinks'),
      where('sourcePageId', '==', pageId)
    );
    const sourceSnap = await getDocs(sourceQuery);
    
    // Delete backlinks where this page is the target
    const targetQuery = query(
      collection(db, 'backlinks'),
      where('targetPageId', '==', pageId)
    );
    const targetSnap = await getDocs(targetQuery);
    
    // Delete all found backlinks
    const batch = writeBatch(db);
    sourceSnap.forEach(doc => batch.delete(doc.ref));
    targetSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
  } catch (error) {
    console.error('Error deleting backlinks:', error);
    throw error;
  }
}

/**
 * Extract page ID from URL
 * @param url URL to extract page ID from
 * @returns Page ID or null if not found
 */
/**
 * Extract page ID from a given URL.
 * 
 * @param {string} url - The URL to extract the page ID from.
 * @returns {string | null} The extracted page ID, or null if not found.
 */
function extractPageIdFromUrl(url: string): string | null {
  if (!url) return null;
  
  // Handle direct pageId
  if (url.match(/^[A-Za-z0-9-_]+$/)) {
    return url;
  }
  
  // Handle /pages/pageId format
  const match = url.match(/\/pages\/([A-Za-z0-9-_]+)/);
  return match ? match[1] : null;
}
