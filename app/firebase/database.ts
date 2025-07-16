/**
 * Database Module - Modular Structure
 *
 * This file has been refactored from a single 2,385-line file into a modular structure
 * for better maintainability and organization. The original large file has been split into:
 *
 * - core.ts: Core database setup, types, and generic utilities
 * - access.ts: Access control and permission checking
 * - pages.ts: Page CRUD operations and listeners
 * - versions.ts: Version management and history
 * - links.ts: Link extraction and management
 * - search.ts: Search functionality for users and pages
 * - users.ts: User-related operations and profile management
 *
 * All functions are re-exported here to maintain backward compatibility.
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
export * from './database/analytics';

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
      console.error('⚠️ Error getting original page data (non-fatal):', pageDataError);
    }

    const result = await updateDoc('pages', pageId, data);

    // Get the updated page data for cache invalidation and backlinks
    let pageData = null;
    try {
      pageData = await getPageById(pageId);
    } catch (pageDataError) {
      console.error('⚠️ Error getting page data for post-update operations (non-fatal):', pageDataError);
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
            console.warn('Could not parse content for backlinks indexing:', parseError);
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

        console.log('✅ Backlinks index updated for page update');
      } catch (backlinkError) {
        console.error('⚠️ Error updating backlinks index (non-fatal):', backlinkError);
      }
    }

    // Create activity record if title changed
    if (result && originalPageData && pageData?.pageData && data.title && data.title !== originalPageData.title) {
      try {
        console.log('Title changed, creating activity record:', {
          oldTitle: originalPageData.title,
          newTitle: data.title,
          pageId
        });

        // Import required functions
        const { collection, addDoc, Timestamp } = await import('firebase/firestore');
        const { db } = await import('./database/core');

        // Create activity record for title change
        const activityData = {
          pageId,
          pageName: data.title, // Use the new title
          userId: pageData.pageData.userId,
          username: pageData.pageData.username || 'Anonymous',
          timestamp: Timestamp.now(),
          diff: {
            added: 0, // Title changes don't add/remove characters in content
            removed: 0,
            hasChanges: true // Always true for title changes
          },
          // No diff preview for title changes
          diffPreview: null,
          isPublic: pageData.pageData.isPublic || false,
          isNewPage: false,
          isTitleChange: true // Flag to identify title-only changes
        };

const activitiesRef = collection(db, getCollectionName('activities'));
        const activityDocRef = await addDoc(activitiesRef, activityData);

        console.log('Created activity record for title change', {
          activityId: activityDocRef.id,
          pageId,
          oldTitle: originalPageData.title,
          newTitle: data.title
        });
      } catch (activityError) {
        console.error('Error creating activity record for title change (non-fatal):', activityError);
        // Don't fail page update if activity recording fails
      }
    }

    // Trigger cache invalidation for page updates
    if (result && pageData?.pageData?.userId) {
      try {
        const { invalidateUserPagesCache } = await import('../utils/cacheInvalidation');
        invalidateUserPagesCache(pageData.pageData.userId);
        console.log('✅ Cache invalidation triggered after page update for user:', pageData.pageData.userId);
      } catch (cacheError) {
        console.error('Error triggering cache invalidation (non-fatal):', cacheError);
      }
    }

    return result;
  } catch (error) {
    console.error('Error updating page:', error);
    return false;
  }
};

/**
 * Delete a page using soft delete approach
 * Marks the page as deleted but preserves data for recovery and audit trails
 */
export const deletePage = async (pageId: string): Promise<boolean> => {
  try {
    console.log(`Starting soft delete for page ${pageId}`);

    // Get the page data first to check if it exists
    const pageRef = doc(db, getCollectionName('pages'), pageId);
    const pageDoc = await getDoc(pageRef);

    if (!pageDoc.exists()) {
      console.warn(`Page ${pageId} not found for deletion`);
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
      console.log(`Successfully soft deleted page ${pageId}`);

      // Update user page count
      try {
        const { decrementUserPageCount } = await import('./counters');
        await decrementUserPageCount(pageData.userId, pageData.isPublic);
        console.log("Updated user page count for deletion");
      } catch (counterError) {
        console.error("Error updating user page count for deletion:", counterError);
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
      console.warn('Cannot delete page while offline. Please check your internet connection and try again.');
      throw new Error('Cannot delete page while offline. Please check your internet connection and try again.');
    } else {
      console.error('Error deleting page:', error);
      throw new Error('Failed to delete page. Please try again.');
    }
  }
};

/**
 * Get page metadata for SEO and analytics
 */
export const getPageMetadata = async (pageId: string): Promise<any> => {
  try {
    const pageRef = doc(db, getCollectionName("pages"), pageId);
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

    // CRITICAL FIX: Invalidate caches after content update
    try {
      // Invalidate request cache
      const { invalidatePageCache } = await import('../utils/requestCache');
      invalidatePageCache(targetPageId);

      // Clear page cache
      const { clearPagesCache } = await import('../lib/pageCache');
      clearPagesCache(pageData.userId);

      // Clear optimized pages cache
      const { clearPageCaches } = await import('./optimizedPages');
      clearPageCaches();

      console.log('✅ Caches invalidated after page content append');
    } catch (cacheError) {
      console.error('⚠️ Error invalidating caches after append (non-fatal):', cacheError);
    }

    // Notifications functionality removed

    return true;
  } catch (error) {
    console.error("Error appending page reference:", error);
    return false;
  }
};