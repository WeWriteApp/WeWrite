import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  query,
  orderBy,
  limit,
  Timestamp
} from "firebase/firestore";

import { db } from "./core";
import { extractLinksFromNodes } from "./links";
// Notifications functionality removed
import { recordUserActivity } from "../streaks";
import { hasContentChangedSync } from "../../utils/diffService";
import { getCollectionName } from "../../utils/environmentConfig";
import logger from "../../utils/logger";

import type { PageVersion } from "../../types/database";

/**
 * Get all versions for a page
 */
export const getVersionsByPageId = async (pageId: string): Promise<PageVersion[] | Error> => {
  try {
    const pageRef = doc(db, getCollectionName("pages"), pageId);
    const versionsRef = collection(pageRef, "versions");
    const versionsSnap = await getDocs(versionsRef);

    // add id of each version
    const versions = versionsSnap.docs.map((doc) => {
      return {
        id: doc.id,
        ...doc.data()
      } as PageVersion;
    });

    return versions;
  } catch (e) {
    return e as Error;
  }
};

/**
 * Get a specific version by ID
 */
export const getPageVersionById = async (pageId: string, versionId: string): Promise<PageVersion | null> => {
  try {
    if (!pageId || !versionId) {
      return null;
    }

const pageRef = doc(db, getCollectionName("pages"), pageId);
    const versionRef = doc(collection(pageRef, "versions"), versionId);
    const versionSnap = await getDoc(versionRef);

    if (!versionSnap.exists()) {
      return null;
    }

    const versionData = versionSnap.data();

    // If this version has a previousVersionId, fetch the previous version as well
    let previousVersion = null;
    if (versionData.previousVersionId) {
      try {
        const prevVersionRef = doc(collection(pageRef, "versions"), versionData.previousVersionId);
        const prevVersionSnap = await getDoc(prevVersionRef);

        if (prevVersionSnap.exists()) {
          previousVersion = {
            id: prevVersionSnap.id,
            ...prevVersionSnap.data()
          };
        }
      } catch (prevError) {
        // Continue without previous version
      }
    }

    // Return version data with ID and previous version if available
    return {
      id: versionSnap.id,
      content: versionData.content || '',
      createdAt: versionData.createdAt || new Date().toISOString(),
      userId: versionData.userId || 'unknown',
      previousVersionId: versionData.previousVersionId,
      previousVersion,
      ...versionData
    } as PageVersion;
  } catch (error) {
    return null;
  }
};

/**
 * Get recent versions for a page with proper sorting
 */
export const getPageVersions = async (pageId: string, versionCount: number = 10): Promise<any[]> => {
  try {
    if (!pageId) {
      return [];
    }

const pageRef = doc(db, getCollectionName("pages"), pageId);
    const versionsRef = collection(pageRef, "versions");

    // First try to get all versions without ordering (to avoid index requirements)
    try {
      const versionsSnap = await getDocs(versionsRef);

      if (versionsSnap.empty) {
        return [];
      }

      // Convert the docs to an array of data objects
      let versions = versionsSnap.docs.map((doc) => {
        try {
          const data = doc.data();

          // Handle different timestamp formats
          let createdAt = new Date();
          if (data.createdAt) {
            if (typeof data.createdAt === 'object' && data.createdAt.toDate) {
              createdAt = data.createdAt.toDate();
            } else if (data.createdAt.seconds && data.createdAt.nanoseconds) {
              // Firestore Timestamp format
              createdAt = new Date(data.createdAt.seconds * 1000);
            } else {
              // String or number format
              createdAt = new Date(data.createdAt);
            }
          }

          return {
            id: doc.id,
            ...data,
            createdAt,
            content: data.content || ""
          };
        } catch (err) {
          return null;
        }
      }).filter(version => version !== null);

      // Sort manually by createdAt in descending order
      versions.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date();
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date();
        return dateB.getTime() - dateA.getTime();
      });

      // Limit to the requested number
      versions = versions.slice(0, versionCount);

      return versions;
    } catch (innerError) {
      // Handle permission denied errors gracefully - this is expected for private pages
      if (innerError?.code === 'permission-denied') {
        return [];
      }

      // Fallback to the original query (which might still fail if index doesn't exist)
      try {
        const versionsQuery = query(
          versionsRef,
          orderBy("createdAt", "desc"),
          limit(versionCount)
        );

        const versionsSnap = await getDocs(versionsQuery);

        if (versionsSnap.empty) {
          return [];
        }

        // add id of each version and convert timestamp strings to Date objects
        const versions = versionsSnap.docs.map((doc) => {
          try {
            const data = doc.data();

            // Handle different timestamp formats
            let createdAt = new Date();
            if (data.createdAt) {
              if (typeof data.createdAt === 'object' && data.createdAt.toDate) {
                createdAt = data.createdAt.toDate();
              } else if (data.createdAt.seconds && data.createdAt.nanoseconds) {
                // Firestore Timestamp format
                createdAt = new Date(data.createdAt.seconds * 1000);
              } else {
                // String or number format
                createdAt = new Date(data.createdAt);
              }
            }

            return {
              id: doc.id,
              ...data,
              createdAt,
              content: data.content || ""
            };
          } catch (err) {
            return null;
          }
        }).filter(version => version !== null);

        return versions;
      } catch (queryError) {
        // Handle permission denied errors gracefully - this is expected for private pages
        return [];
      }
    }
  } catch (e) {
    // Handle permission denied errors gracefully - this is expected for private pages
    return [];
  }
};

/**
 * Set a specific version as the current version (restore functionality)
 */
export const setCurrentVersion = async (pageId: string, versionId: string): Promise<boolean> => {
  try {
    if (!pageId || !versionId) {
      return false;
    }

    // Get the version to restore
    const versionData = await getPageVersionById(pageId, versionId);
    if (!versionData) {
      return false;
    }

    // Import Firestore Timestamp for proper timestamp handling
    const { Timestamp } = await import('firebase/firestore');

    // Update the page document with the new current version and content
await setDoc(doc(db, getCollectionName("pages"), pageId), {
      currentVersion: versionId,
      content: versionData.content, // Restore the content from this version
      lastModified: Timestamp.now()
    }, { merge: true });

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Save a new version of a page
 */
export const saveNewVersion = async (pageId: string, data: any): Promise<any> => {
  try {
    logger.info('Starting version save process', {
      pageId,
      userId: data.userId,
      username: data.username,
      hasContent: !!data.content
    }, 'VERSION_SAVE');

    // Validate content to prevent saving empty versions
    if (!data.content) {
      logger.error("Cannot save empty content", { pageId }, 'VERSION_SAVE');
      return null;
    }

    // Ensure content is a string
    let contentString = typeof data.content === 'string'
      ? data.content
      : JSON.stringify(data.content);

    // CRITICAL FIX: Allow empty content structures to be saved
    // Users should be able to save pages with just a title
    if (contentString === '{}' || contentString === '') {
      contentString = JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]);
    } else if (contentString === '[]') {
      contentString = JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]);
    }

    // Parse content to validate it's proper JSON
    let parsedContent;
    try {
      parsedContent = JSON.parse(contentString);

      // CRITICAL FIX: Allow empty content to be saved
      // Users should be able to save pages with just a title and no content
      if (Array.isArray(parsedContent)) {
        // If content is empty, create a default paragraph structure
        if (parsedContent.length === 0) {
          parsedContent = [{ type: "paragraph", children: [{ text: "" }] }];
          contentString = JSON.stringify(parsedContent);
        }
      }

      // Notifications functionality removed - links are still extracted for other purposes
      // but no notifications are created

    } catch (parseError) {
      return null;
    }

    // Get the current page to find the current version
const pageDoc = await getDoc(doc(db, getCollectionName("pages"), pageId));
    if (!pageDoc.exists()) {
      return null;
    }

    const pageData = pageDoc.data();
    const currentVersionId = pageData.currentVersion;
    const isNewPage = !currentVersionId; // True if this is the first version of the page

    // Enhanced no-op detection: Check if content has changed using centralized logic
    let isNoOpEdit = false;
    if (pageData.content) {
      if (!hasContentChangedSync(contentString, pageData.content)) {
        isNoOpEdit = true;

        // If skipIfUnchanged is true, skip version creation entirely
        if (data.skipIfUnchanged) {
          return { success: false, message: 'Content unchanged' };
        }
      }
    }

    // CRITICAL FIX: Use ISO string instead of Firestore Timestamp for consistent format
    // This ensures lastModified is always stored as an ISO string across all save operations
    const now = new Date().toISOString();

    // Create the new version data
    const versionData = {
      content: contentString,
      createdAt: now,
      userId: data.userId,
      username: data.username || "Anonymous",
      groupId: data.groupId || null,
      previousVersionId: currentVersionId || null, // Link to the previous version
      isNoOp: isNoOpEdit, // Flag to identify no-op edits for filtering
      isNewPage // Flag to identify page creation (first version) for "created by" display
    };

    // Calculate diff data BEFORE updating the page
    let diffResult = null;
    try {
      const { calculateDiff } = await import('../../utils/diffService');
      // Get current page content for diff calculation
      const pageRef = doc(db, getCollectionName("pages"), pageId);
      const pageSnap = await getDoc(pageRef);
      const currentPageContent = pageSnap.exists() ? pageSnap.data().content || '' : '';

      diffResult = await calculateDiff(contentString, currentPageContent);
    } catch (diffError) {
      // Error calculating diff - non-fatal
    }

    // Create the new version document
    let versionRef;
    try {
      versionRef = await addDoc(collection(db, getCollectionName("pages"), pageId, "versions"), versionData);
    } catch (versionError) {
      throw versionError;
    }

    // Update the page document with the new current version and content
    const pageUpdateData = {
      currentVersion: versionRef.id,
      content: parsedContent, // CRITICAL FIX: Store content as object, not string
      lastModified: now,
      // Store diff information for recent activity display (with safety checks)
      lastDiff: diffResult ? {
        added: diffResult.added || 0,
        removed: diffResult.removed || 0,
        hasChanges: (diffResult.added > 0 || diffResult.removed > 0) || isNewPage,
        preview: diffResult.preview || null,
        isNewPage: isNewPage // Flag for new page creation to show all content as additions
      } : (isNewPage ? {
        added: 0,
        removed: 0,
        hasChanges: true,
        preview: null,
        isNewPage: true
      } : null)
    };

    try {
      await setDoc(doc(db, getCollectionName("pages"), pageId), pageUpdateData, { merge: true });
    } catch (pageUpdateError) {
      throw pageUpdateError;
    }

    // Note: User activity for streak tracking is handled on the client side

    // Activity creation removed - now using recent pages with diff data stored on pages

    // CRITICAL FIX: Invalidate cache after saving new version
    try {
      // Import cache invalidation utilities
      const { invalidateCache } = await import('../../utils/serverCache');

      // Invalidate unified cache
      invalidateCache.page(pageId);
      if (data.userId) invalidateCache.user(data.userId);
    } catch (cacheError) {
      // Cache invalidation failed - non-fatal
    }

    // Sync to search engines for real-time search updates
    try {
      // Get the page data for search sync
      const pageRefForSync = doc(db, getCollectionName("pages"), pageId);
      const pageSyncSnap = await getDoc(pageRefForSync);

      if (pageSyncSnap.exists()) {
        const pageSyncData = pageSyncSnap.data();
        const searchSyncData = {
          pageId,
          title: pageSyncData.title || '',
          content: contentString,
          authorId: data.userId,
          authorUsername: data.username || pageSyncData.username || '',
          isPublic: pageSyncData.isPublic ?? true,
          alternativeTitles: pageSyncData.alternativeTitles || [],
          lastModified: now,
          createdAt: pageSyncData.createdAt,
        };

        // Sync to Algolia (primary)
        try {
          const { syncPageToAlgolia } = await import('../../lib/algoliaSync');
          await syncPageToAlgolia(searchSyncData);
        } catch (algoliaError) {
          // Don't fail the save if Algolia sync fails
        }

        // Sync to Typesense (secondary)
        try {
          const { syncPageToTypesense } = await import('../../lib/typesenseSync');
          await syncPageToTypesense(searchSyncData);
        } catch (typesenseError) {
          // Don't fail the save if Typesense sync fails
        }
      }
    } catch (syncError) {
      // Don't fail the save if search sync fails
    }

    return {
      success: true,
      versionId: versionRef.id
    };

  } catch (error) {
    // Enhanced error logging for production debugging
    const errorContext = {
      pageId,
      userId: data.userId,
      username: data.username,
      hasContent: !!data.content,
      contentType: typeof data.content,
      contentLength: data.content ? JSON.stringify(data.content).length : 0,
      groupId: data.groupId,
      environment: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      collectionName: getCollectionName("pages"),
      timestamp: new Date().toISOString()
    };

    logger.critical("Version save failed", {
      error: error.message,
      stack: error.stack,
      context: errorContext
    }, 'VERSION_SAVE');

    return {
      success: false,
      error: error.message
    };
  }
};