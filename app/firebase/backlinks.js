import { db } from './config';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  getDoc
} from 'firebase/firestore';

// Get backlinks for a specific page
export const getBacklinks = async (pageId) => {
  if (!pageId) return [];
  
  try {
    const backlinksRef = collection(db, 'backlinks');
    const q = query(backlinksRef, where('targetPageId', '==', pageId));
    const querySnapshot = await getDocs(q);
    
    const backlinks = [];
    querySnapshot.forEach((doc) => {
      backlinks.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return backlinks;
  } catch (error) {
    console.error('Error getting backlinks:', error);
    return [];
  }
};

// Alias for getBacklinks to maintain compatibility with existing code
export const findBacklinks = getBacklinks;

// Update backlinks when page content changes
export const updateBacklinks = async (pageId, content, userId, groupId) => {
  if (!pageId || !content) return;
  
  try {
    // Extract all links from the content
    const links = extractLinksFromContent(content);
    
    // First, delete all existing backlinks from this page
    await removeAllBacklinksFromPage(pageId);
    
    // Then create new backlinks
    for (const link of links) {
      const targetPageId = link.pageId;
      
      // Don't create backlinks to the same page
      if (targetPageId === pageId) continue;
      
      // Create a unique ID for the backlink
      const backlinkId = `${pageId}_${targetPageId}`;
      
      // Create or update the backlink
      const backlinkRef = doc(db, 'backlinks', backlinkId);
      await setDoc(backlinkRef, {
        sourcePageId: pageId,
        targetPageId,
        userId,
        groupId: groupId || null,
        createdAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error updating backlinks:', error);
  }
};

// Remove all backlinks from a specific page
export const removeAllBacklinksFromPage = async (pageId) => {
  if (!pageId) return;
  
  try {
    const backlinksRef = collection(db, 'backlinks');
    const q = query(backlinksRef, where('sourcePageId', '==', pageId));
    const querySnapshot = await getDocs(q);
    
    const deletePromises = [];
    querySnapshot.forEach((document) => {
      deletePromises.push(deleteDoc(doc(db, 'backlinks', document.id)));
    });
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error removing backlinks:', error);
  }
};

// Helper function to extract links from page content
const extractLinksFromContent = (content) => {
  if (!content || !Array.isArray(content)) return [];
  
  const links = [];
  
  // Recursively search for internal links in the content
  const findLinks = (nodes) => {
    if (!nodes || !Array.isArray(nodes)) return;
    
    for (const node of nodes) {
      if (node.type === 'link' && node.isInternal && node.href) {
        // Extract pageId from href
        const pageId = extractPageIdFromHref(node.href);
        if (pageId) {
          links.push({
            pageId,
            text: node.children?.[0]?.text || '',
            href: node.href
          });
        }
      }
      
      // Recursively check children
      if (node.children) {
        findLinks(node.children);
      }
    }
  };
  
  findLinks(content);
  return links;
};

// Helper function to extract pageId from href
const extractPageIdFromHref = (href) => {
  if (!href) return null;
  
  // If href is already a page ID (no slashes), return it directly
  if (!href.includes('/')) return href;
  
  // Otherwise, try to extract the ID from various URL formats
  try {
    const url = new URL(href, 'https://example.com');
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Handle different URL patterns
    if (pathSegments.length > 0) {
      // Usually the last segment is the ID
      return pathSegments[pathSegments.length - 1];
    }
    
    return null;
  } catch (error) {
    // If href is not a valid URL, try to extract ID directly
    const segments = href.split('/').filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : null;
  }
};
