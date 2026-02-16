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

// Version management - DEPRECATED: Use app/services/versionService.ts instead
// export * from './versions'; // Commented out to force migration to unified service

// Link management
export * from './links';

// Search functionality
export * from './search';

// User operations
export * from './users';

// Group operations
export * from './groups';

// Analytics data layer (Firestore operations for analytics aggregations)
export * from './analyticsDataLayer';

// Additional functions that need to be added to complete the migration
// These would be extracted from the remaining parts of the original database.ts file

import { db, updateDoc, getDoc, doc } from './core';
import { getPageById } from './pages';
import { createLogger } from '../utils/logger';
import { getCollectionName, getCollectionNameAsync } from "../../utils/environmentConfig";

const logger = createLogger('Database');

/**
 * Update a page with new data
 */
export const updatePage = async (pageId: string, data: any): Promise<boolean> => {
  try {
    logger.debug('Updating page', { pageId, hasTitle: !!data.title });
    const result = await updateDoc('pages', pageId, data);
    if (result) {
      logger.debug('Page updated successfully', { pageId });
    }
    return result;
  } catch (error) {
    logger.error('Failed to update page', { pageId, error: error.message });
    return false;
  }
};

/**
 * Delete a page and all its versions
 */
export const deletePage = async (pageId: string): Promise<boolean> => {
  try {
    // Soft delete the page in Firestore
    const result = await updateDoc('pages', pageId, { deleted: true, deletedAt: new Date().toISOString() });

    // Remove from Typesense search index
    if (result) {
      try {
        const { removePageFromTypesense } = await import('../../lib/typesenseSync');
        await removePageFromTypesense(pageId);
      } catch (typesenseError) {
        // Non-fatal: page is still deleted in Firestore
        console.error('Error removing page from Typesense:', typesenseError);
      }
    }

    return result;
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

    // Create a page link to append (just the link, no prefix text or source content)
    const pageLink = {
      type: "paragraph",
      children: [
        {
          type: "link",
          url: `/pages/${sourcePageData.id}`,
          pageId: sourcePageData.id,
          pageTitle: sourcePageData.title,
          originalPageTitle: sourcePageData.title,
          isPageLink: true,
          className: "page-link",
          children: [{ text: sourcePageData.title }]
        }
      ]
    };

    // Append just the page link to the target content (no source content copied)
    const newContent = [
      ...currentContent,
      pageLink
    ];

    // Update the page with the new content
    await updatePage(targetPageId, {
      content: newContent, // CRITICAL FIX: Store as object, not string
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
 * Uses environment-aware collection naming
 */
export const getPageMetadata = async (pageId: string): Promise<any> => {
  try {
    const collectionName = await getCollectionNameAsync("pages");
    const pageRef = doc(db, collectionName, pageId);
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
    const pageRef = doc(db, getCollectionName("pages"), pageId);
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