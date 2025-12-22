/**
 * Database Module - DEPRECATED
 *
 * ⚠️  MIGRATION NOTICE: This module is deprecated in favor of API routes.
 *
 * All database operations should now use the API client from utils/apiClient.ts
 * instead of direct Firebase calls. This ensures:
 * - Environment-aware collection naming
 * - Consistent authentication handling
 * - Better error handling and logging
 * - Centralized data access patterns
 *
 * Migration Guide:
 * - Replace direct Firebase imports with API client calls
 * - Use followsApi, pageApi, userProfileApi, etc. from utils/apiClient.ts
 * - Update components to use the new API patterns
 *
 * This file is kept for backward compatibility but should not be used for new code.
 */

// Re-export all database functions from modular structure
export * from './database/core';
export * from './database/pages';
export * from './database/versions';
export * from './database/access';
export * from './database/search';
export * from './database/links';
export * from './database/backlinks';
export * from './database/users';
export * from './database/analyticsDataLayer';

// Import required functions for additional exports
import { db, updateDoc, getDoc, doc } from './database/core';
import { getPageById } from './database/pages';
import { getCollectionName } from "../utils/environmentConfig";

/**
 * Update a page with new data
 */
export const updatePage = async (pageId: string, data: any): Promise<boolean> => {
  try {
    // Get the current page data BEFORE updating to detect changes
    let originalPageData = null;
    try {
      const originalData = await getPageById(pageId);
      originalPageData = originalData?.pageData;
    } catch (pageDataError) {
      // Error getting original page data (non-fatal)
    }

    const result = await updateDoc('pages', pageId, data);

    // Get the updated page data for cache invalidation and backlinks
    let pageData = null;
    try {
      pageData = await getPageById(pageId);
    } catch (pageDataError) {
      // Error getting page data for post-update operations (non-fatal)
    }

    // If the update includes content changes, update the backlinks index
    if (result && data.content && pageData?.pageData) {
      try {
        const { updateBacklinksIndex } = await import('./database/backlinks');

        // Parse content to extract links
        let contentNodes = [];
        if (data.content && typeof data.content === 'string') {
          try {
            contentNodes = JSON.parse(data.content);
          } catch (parseError) {
            // Could not parse content for backlinks indexing
          }
        }

        await updateBacklinksIndex(
          pageId,
          pageData.pageData.title,
          pageData.pageData.username,
          contentNodes,
          pageData.pageData.isPublic,
          data.lastModified || pageData.pageData.lastModified
        );

      } catch (backlinkError) {
        // Error updating backlinks index (non-fatal)
      }
    }

    // Note: Activity system has been replaced with version system
    // Title changes are now tracked through the version system

    // Trigger cache invalidation for page updates
    if (result && pageData?.pageData?.userId) {
      try {
        const { invalidateCache } = await import('../utils/serverCache');
        invalidateCache.user(pageData.pageData.userId);
      } catch (cacheError) {
        // Error triggering cache invalidation (non-fatal)
      }
    }

    return result;
  } catch (error) {
    return false;
  }
};

/**
 * Delete a page using soft delete approach
 * Marks the page as deleted but preserves data for recovery and audit trails
 */
export const deletePage = async (pageId: string): Promise<boolean> => {
  try {
    // Get the page data first to check if it exists
    const pageRef = doc(db, getCollectionName('pages'), pageId);
    const pageDoc = await getDoc(pageRef);

    if (!pageDoc.exists()) {
      return false;
    }

    const pageData = pageDoc.data();

    // Mark the main page document as deleted
    const deleteResult = await updateDoc('pages', pageId, {
      deleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: pageData.userId || 'unknown' // Track who deleted it
    });

    if (deleteResult) {
      // Update user page count
      try {
        const { decrementUserPageCount } = await import('./counters');
        await decrementUserPageCount(pageData.userId, pageData.isPublic);
      } catch (counterError) {
        // Don't fail page deletion if counter update fails
      }

      // TODO: In the future, we could also mark versions as deleted
      // For now, we keep versions for potential recovery

      // TODO: Consider cleanup of related data like:
      // - Page followers (mark as deleted)
      // - Pledges (handle separately)
      // - Notifications (keep for audit trail)

      return true;
    }

    return false;
  } catch (error: any) {
    // Handle specific Firebase offline errors gracefully
    const isOfflineError = error?.code === 'unavailable' ||
                          error?.message?.includes('client is offline') ||
                          error?.message?.includes('Failed to get document because the client is offline');

    if (isOfflineError) {
      throw new Error('Cannot delete page while offline. Please check your internet connection and try again.');
    } else {
      throw new Error('Failed to delete page. Please try again.');
    }
  }
};

/**
 * Get page metadata for SEO and analytics
 */
export const getPageMetadata = async (pageId: string): Promise<any> => {
  try {
    const { getCollectionNameAsync } = require("../utils/environmentConfig");
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
    return 'Untitled';
  }
};

/**
 * Get page statistics for pledge system
 */
export const getPageStats = async (pageId: string): Promise<any> => {
  try {
    const { getCollectionNameAsync } = require("../utils/environmentConfig");
    const collectionName = await getCollectionNameAsync("pages");
    const pageRef = doc(db, collectionName, pageId);
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
    return null;
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

    // Append the reference header and source content to the target content
    // Single newline only - no extra spacing
    const newContent = [
      ...currentContent,
      referenceHeader,
      ...sourceContent
    ];

    // Update the page with the new content
    await updatePage(targetPageId, {
      content: newContent, // CRITICAL FIX: Store as object, not string
      lastModified: new Date().toISOString()
    });

    // Cache invalidation is now handled by useSimplePages automatically
    // Notifications functionality removed

    return true;
  } catch (error) {
    return false;
  }
};