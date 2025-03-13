import { db } from "../firebase/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";

// Extract page IDs from content nodes
export const extractPageIds = (nodes) => {
  const pageIds = new Set();
  
  const traverse = (node) => {
    // Handle both custom-link and link types
    if ((node.type === 'link' || node.type === 'custom-link') && node.url) {
      // Extract page ID from URL (format: /pages/[id])
      const match = node.url.match(/\/pages\/([^/]+)/);
      if (match) {
        pageIds.add(match[1]);
      }
    }
    
    if (node.children) {
      node.children.forEach(traverse);
    }
  };

  try {
    // Handle potentially double-stringified content
    let contentNodes = nodes;
    if (typeof nodes === 'string') {
      try {
        contentNodes = JSON.parse(nodes);
        // Check if it's still a string (double-stringified)
        if (typeof contentNodes === 'string') {
          contentNodes = JSON.parse(contentNodes);
        }
      } catch (parseError) {
        console.error('Error parsing content nodes:', parseError);
        return [];
      }
    }
    
    if (Array.isArray(contentNodes)) {
      contentNodes.forEach(traverse);
    } else if (contentNodes.children) {
      contentNodes.children.forEach(traverse);
    }

    return Array.from(pageIds);
  } catch (error) {
    console.error('Error processing content nodes:', error);
    console.log('Content nodes:', nodes);
    return [];
  }
};

// Update backlinks when a page is created or updated
export const updateBacklinks = async (pageId, oldContent, newContent) => {
  try {
    console.log('Updating backlinks for page:', pageId);
    console.log('Old content:', oldContent);
    console.log('New content:', newContent);
    
    // Get page IDs from old and new content
    const oldLinks = oldContent ? extractPageIds(oldContent) : [];
    const newLinks = extractPageIds(newContent);
    
    console.log('Old links:', oldLinks);
    console.log('New links:', newLinks);
    
    // Find links to add and remove
    const linksToAdd = newLinks.filter(id => !oldLinks.includes(id));
    const linksToRemove = oldLinks.filter(id => !newLinks.includes(id));
    
    console.log('Links to add:', linksToAdd);
    console.log('Links to remove:', linksToRemove);
    
    // Update backlinks for each affected page
    const promises = [];
    
    // Add new backlinks
    linksToAdd.forEach(targetPageId => {
      console.log('Adding backlink to page:', targetPageId);
      const targetRef = doc(db, "pages", targetPageId);
      promises.push(
        updateDoc(targetRef, {
          backlinks: arrayUnion(pageId)
        })
      );
    });
    
    // Remove old backlinks
    linksToRemove.forEach(targetPageId => {
      console.log('Removing backlink from page:', targetPageId);
      const targetRef = doc(db, "pages", targetPageId);
      promises.push(
        updateDoc(targetRef, {
          backlinks: arrayRemove(pageId)
        })
      );
    });
    
    await Promise.all(promises);
    console.log('Backlinks update completed successfully');
    return true;
  } catch (error) {
    console.error("Error updating backlinks:", error);
    return false;
  }
};

// Get all pages that link to a specific page
export const getBacklinks = async (pageId) => {
  try {
    console.log('Getting backlinks for page:', pageId);
    const pageRef = doc(db, "pages", pageId);
    const pageSnap = await getDoc(pageRef);
    
    if (!pageSnap.exists()) {
      console.log('Page does not exist:', pageId);
      return [];
    }
    
    const backlinks = pageSnap.data().backlinks || [];
    console.log('Found backlinks:', backlinks);
    return backlinks;
  } catch (error) {
    console.error("Error getting backlinks:", error);
    return [];
  }
}; 