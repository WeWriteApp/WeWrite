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

import type { PageVersion } from "../../types/database";

/**
 * Get all versions for a page
 */
export const getVersionsByPageId = async (pageId: string): Promise<PageVersion[] | Error> => {
  try {
    const pageRef = doc(db, "pages", pageId);
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
      console.error("getPageVersionById called with invalid parameters:", { pageId, versionId });
      return null;
    }

    const pageRef = doc(db, "pages", pageId);
    const versionRef = doc(collection(pageRef, "versions"), versionId);
    const versionSnap = await getDoc(versionRef);

    if (!versionSnap.exists()) {
      console.error(`Version ${versionId} not found for page ${pageId}`);
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
        console.error("Error fetching previous version:", prevError);
        // Continue without previous version
      }
    }

    // Debug logging for version content
    if (process.env.NODE_ENV === 'development') {
      console.log('getPageVersionById - returning version data:', {
        pageId,
        versionId,
        hasContent: !!versionData.content,
        contentType: typeof versionData.content,
        contentLength: versionData.content?.length,
        contentPreview: versionData.content?.substring(0, 100)
      });
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
    console.error("Error fetching page version:", error);
    return null;
  }
};

/**
 * Get recent versions for a page with proper sorting
 */
export const getPageVersions = async (pageId: string, versionCount: number = 10): Promise<any[]> => {
  try {
    if (!pageId) {
      console.error("getPageVersions called with invalid pageId:", pageId);
      return [];
    }

    const pageRef = doc(db, "pages", pageId);
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
          console.error(`Error processing version doc ${doc.id}:`, err);
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
        console.log(`Permission denied accessing versions for page ${pageId} - this is expected for private pages`);
        return [];
      }

      console.error("Error with simple version fetch, falling back:", innerError);

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
            console.error(`Error processing version doc ${doc.id}:`, err);
            return null;
          }
        }).filter(version => version !== null);

        return versions;
      } catch (queryError) {
        // Handle permission denied errors gracefully - this is expected for private pages
        if (queryError?.code === 'permission-denied') {
          console.log(`Permission denied accessing versions for page ${pageId} (fallback query) - this is expected for private pages`);
          return [];
        }
        console.error("Error with fallback query:", queryError);
        return [];
      }
    }
  } catch (e) {
    // Handle permission denied errors gracefully - this is expected for private pages
    if (e?.code === 'permission-denied') {
      console.log(`Permission denied accessing versions for page ${pageId} - this is expected for private pages`);
      return [];
    }
    console.error("Error fetching page versions:", e);
    return [];
  }
};

/**
 * Set a specific version as the current version (restore functionality)
 */
export const setCurrentVersion = async (pageId: string, versionId: string): Promise<boolean> => {
  try {
    if (!pageId || !versionId) {
      console.error("setCurrentVersion called with invalid parameters:", { pageId, versionId });
      return false;
    }

    // Get the version to restore
    const versionData = await getPageVersionById(pageId, versionId);
    if (!versionData) {
      console.error(`Version ${versionId} not found for page ${pageId}`);
      return false;
    }

    // Import Firestore Timestamp for proper timestamp handling
    const { Timestamp } = await import('firebase/firestore');

    // Update the page document with the new current version and content
    await setDoc(doc(db, "pages", pageId), {
      currentVersion: versionId,
      content: versionData.content, // Restore the content from this version
      lastModified: Timestamp.now()
    }, { merge: true });

    console.log(`Successfully set version ${versionId} as current for page ${pageId}`);
    return true;
  } catch (error) {
    console.error("Error setting current version:", error);
    return false;
  }
};

/**
 * Save a new version of a page
 */
export const saveNewVersion = async (pageId: string, data: any): Promise<any> => {
  try {
    console.log('saveNewVersion called with pageId:', pageId);

    // Validate content to prevent saving empty versions
    if (!data.content) {
      console.error("Cannot save empty content");
      return null;
    }

    // Ensure content is a string
    let contentString = typeof data.content === 'string'
      ? data.content
      : JSON.stringify(data.content);

    // CRITICAL FIX: Allow empty content structures to be saved
    // Users should be able to save pages with just a title
    if (contentString === '{}' || contentString === '') {
      console.log("Empty content detected, creating default structure");
      contentString = JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]);
    } else if (contentString === '[]') {
      console.log("Empty array content detected, creating default structure");
      contentString = JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]);
    }

    console.log('Content string to save:', contentString.substring(0, 100) + '...');

    // Parse content to validate it's proper JSON
    let parsedContent;
    try {
      parsedContent = JSON.parse(contentString);

      // CRITICAL FIX: Allow empty content to be saved
      // Users should be able to save pages with just a title and no content
      if (Array.isArray(parsedContent)) {
        // Content is valid if it's an array (even if empty)
        console.log("Content validation passed - array format is valid, length:", parsedContent.length);

        // If content is empty, create a default paragraph structure
        if (parsedContent.length === 0) {
          parsedContent = [{ type: "paragraph", children: [{ text: "" }] }];
          contentString = JSON.stringify(parsedContent);
          console.log("Created default content structure for empty page");
        }
      }

      // Notifications functionality removed - links are still extracted for other purposes
      // but no notifications are created

    } catch (parseError) {
      console.error("Error parsing content JSON:", parseError);
      return null;
    }

    // Get the current page to find the current version
    const pageDoc = await getDoc(doc(db, "pages", pageId));
    if (!pageDoc.exists()) {
      console.error("Page not found:", pageId);
      return null;
    }

    const pageData = pageDoc.data();
    const currentVersionId = pageData.currentVersion;

    // Enhanced no-op detection: Check if content has changed using centralized logic
    let isNoOpEdit = false;
    if (pageData.content) {
      console.log('Checking if content has changed before creating version...');

      if (!hasContentChangedSync(contentString, pageData.content)) {
        isNoOpEdit = true;
        console.log('Content unchanged after normalization - this is a no-op edit');

        // If skipIfUnchanged is true, skip version creation entirely
        if (data.skipIfUnchanged) {
          console.log('Skipping version creation for no-op edit');
          return { success: false, message: 'Content unchanged' };
        } else {
          console.log('Creating version for no-op edit (skipIfUnchanged=false) but marking as no-op');
        }
      } else {
        console.log('Content has changed, proceeding with version creation');
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
      isNoOp: isNoOpEdit // Flag to identify no-op edits for filtering
    };

    // Create the new version document
    const versionRef = await addDoc(collection(db, "pages", pageId, "versions"), versionData);
    console.log("Created new version with ID:", versionRef.id);

    // Update the page document with the new current version and content
    await setDoc(doc(db, "pages", pageId), {
      currentVersion: versionRef.id,
      content: contentString, // Store content directly on page for faster access
      lastModified: now
    }, { merge: true });

    // Record user activity for streak tracking
    try {
      await recordUserActivity(data.userId);
      console.log("Recorded user activity for streak tracking");
    } catch (activityError) {
      console.error("Error recording user activity (non-fatal):", activityError);
      // Don't fail save operation if activity recording fails
    }

    // Create activity record with pre-computed diff data
    try {
      // Get page data for activity creation
      const pageRef = doc(db, "pages", pageId);
      const pageSnap = await getDoc(pageRef);

      if (pageSnap.exists()) {
        const pageData = pageSnap.data();

        // Calculate diff data using the centralized diff service
        const { diff } = await import('../../utils/diffService');
        const diffResult = await diff(contentString, pageData.content || '');

        // Skip if no changes and this isn't a new page
        const isNewPage = !currentVersionId;
        console.log("Activity creation debug:", {
          isNewPage,
          diffAdded: diffResult.added,
          diffRemoved: diffResult.removed,
          hasChanges: diffResult.added > 0 || diffResult.removed > 0,
          currentVersionId
        });

        if (!isNewPage && !diffResult.added && !diffResult.removed) {
          console.log("Skipping activity creation - no meaningful changes detected");
        } else {
          // Create activity record directly in Firestore
          const activityData = {
            pageId,
            pageName: pageData.title || 'Untitled',
            userId: data.userId,
            username: data.username || 'Anonymous',
            timestamp: Timestamp.now(),
            diff: {
              added: diffResult.added,
              removed: diffResult.removed,
              hasChanges: diffResult.added > 0 || diffResult.removed > 0 || isNewPage
            },
            isPublic: pageData.isPublic || false,
            isNewPage,
            versionId: versionRef.id
          };

          // Store in activities collection
          const activitiesRef = collection(db, 'activities');
          const activityDocRef = await addDoc(activitiesRef, activityData);

          console.log("Created activity record for version save", {
            activityId: activityDocRef.id,
            pageId,
            added: diffResult.added,
            removed: diffResult.removed,
            hasChanges: activityData.diff.hasChanges
          });
        }
      }
    } catch (activityError) {
      console.error("Error creating activity record (non-fatal):", activityError);
      // Don't fail save operation if activity recording fails
    }

    console.log("Successfully saved new version and updated page");
    return versionRef.id;

  } catch (error) {
    console.error("Error saving new version:", error);
    return null;
  }
};