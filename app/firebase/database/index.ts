/**
 * Database Module Index
 * 
 * This file re-exports all database functions from the modular structure.
 * The original database.ts file (2,385 lines) has been split into logical modules:
 * 
 * - core.ts: Core database setup, types, and generic utilities
 * - access.ts: Access control and permission checking
 * - pages.ts: Page CRUD operations and listeners
 * - versions.ts: Version management and history
 * - links.ts: Link extraction and management
 * - search.ts: Search functionality for users and pages
 * - users.ts: User-related operations and profile management
 */

// Core database functionality
export * from './core';

// Access control and permissions
export * from './access';

// Page operations
export * from './pages';

// Version management
export * from './versions';

// Link management
export * from './links';

// Search functionality
export * from './search';

// User operations
export * from './users';

// Additional functions that need to be added to complete the migration
// These would be extracted from the remaining parts of the original database.ts file

import { db, updateDoc, getDoc, doc } from './core';
import { getPageById } from './pages';

/**
 * Update a page with new data
 */
export const updatePage = async (pageId: string, data: any): Promise<boolean> => {
  try {
    return await updateDoc('pages', pageId, data);
  } catch (error) {
    console.error('Error updating page:', error);
    return false;
  }
};

/**
 * Delete a page and all its versions
 */
export const deletePage = async (pageId: string): Promise<boolean> => {
  try {
    // This would need to be implemented to delete the page and all its versions
    // For now, just delete the main page document
    return await updateDoc('pages', pageId, { deleted: true, deletedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error deleting page:', error);
    return false;
  }
};

/**
 * Append content from one page to another
 */
export const appendPageReference = async (
  targetPageId: string,
  sourcePageData: any,
  userId?: string
): Promise<boolean> => {
  try {
    if (!targetPageId || !sourcePageData) return false;

    // Get the current version of the target page
    const { pageData } = await getPageById(targetPageId);

    if (!pageData) {
      throw new Error("Target page not found");
    }

    // Get the current content from the page data
    let currentContent = [];
    if (pageData.content) {
      if (typeof pageData.content === 'string') {
        try {
          currentContent = JSON.parse(pageData.content);
        } catch (e) {
          currentContent = [{ type: "paragraph", children: [{ text: pageData.content }] }];
        }
      } else if (Array.isArray(pageData.content)) {
        currentContent = pageData.content;
      }
    }

    // Get the source page content
    let sourceContent = [];
    if (sourcePageData.content) {
      try {
        if (typeof sourcePageData.content === 'string') {
          sourceContent = JSON.parse(sourcePageData.content);
        } else if (Array.isArray(sourcePageData.content)) {
          sourceContent = sourcePageData.content;
        }
      } catch (e) {
        console.error("Error parsing source page content:", e);
        // Create a fallback content if parsing fails
        sourceContent = [{
          type: "paragraph",
          children: [{ text: "Content from source page could not be loaded properly." }]
        }];
      }
    }

    // Create a reference header to append (without bold formatting)
    const referenceHeader = {
      type: "paragraph",
      children: [
        { text: "Content from " },
        {
          type: "link",
          href: `/pages/${sourcePageData.id}`,
          displayText: sourcePageData.title,
          children: [{ text: sourcePageData.title }]
        }
      ]
    };

    // Append the reference header and source content to the target content
    // No separator line and no bold formatting
    const newContent = [
      ...currentContent,
      { type: "paragraph", children: [{ text: "" }] }, // Empty line for spacing
      referenceHeader,
      ...sourceContent
    ];

    // Update the page with the new content
    await updatePage(targetPageId, {
      content: JSON.stringify(newContent),
      lastModified: new Date().toISOString()
    });

    // Notifications functionality removed

    return true;
  } catch (error) {
    console.error("Error appending page reference:", error);
    return false;
  }
};

/**
 * Get page metadata for SEO and analytics
 */
export const getPageMetadata = async (pageId: string): Promise<any> => {
  try {
    const pageRef = doc(db, "pages", pageId);
    const docSnap = await getDoc(pageRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: pageId,
        title: data.title || 'Untitled',
        username: data.username || 'Anonymous',
        isPublic: data.isPublic || false,
        userId: data.userId,
        createdAt: data.createdAt,
        lastModified: data.lastModified
      };
    }
    return null;
  } catch (error) {
    // Handle permission denied errors gracefully - this is expected for private pages
    if (error?.code === 'permission-denied') {
      console.log('Permission denied getting page metadata - this is expected for private pages');
    } else {
      console.error('Error getting page metadata:', error);
    }
    return null;
  }
};

/**
 * Get cached page title for analytics
 */
export const getCachedPageTitle = async (pageId: string): Promise<string> => {
  try {
    const metadata = await getPageMetadata(pageId);
    return metadata?.title || 'Untitled';
  } catch (error) {
    console.error('Error getting cached page title:', error);
    return 'Untitled';
  }
};

/**
 * Get page statistics for pledge system
 */
export const getPageStats = async (pageId: string): Promise<any> => {
  try {
    const pageRef = doc(db, "pages", pageId);
    const docSnap = await getDoc(pageRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        totalPledged: data.totalPledged || 0,
        pledgeCount: data.pledgeCount || 0,
        fundraisingGoal: data.fundraisingGoal || 0,
        fundraisingEnabled: data.fundraisingEnabled !== false
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting page stats:', error);
    return null;
  }
};
