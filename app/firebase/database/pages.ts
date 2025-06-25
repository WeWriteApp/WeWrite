import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type Unsubscribe
} from "firebase/firestore";

import { get, ref } from "firebase/database";
import { rtdb } from "../rtdb";

import {
  db,
  type CreatePageData,
  type PageData,
  type PageWithLinks,
  type VersionData,
  type PageUpdateData
} from "./core";

import { checkPageAccess } from "./access";
import { extractLinksFromNodes } from "./links";
import { generateCacheKey, getCacheItem, setCacheItem } from "../../utils/cacheUtils";
import { trackQueryPerformance } from "../../utils/queryMonitor";
import { trackQuery, trackedFirestoreQuery } from "../../utils/queryOptimizer";
import { recordUserActivity } from "../streaks";
// Notifications functionality removed

import type { User } from "../../types/database";

/**
 * Create a new page
 */
export const createPage = async (data: CreatePageData): Promise<string | null> => {
  try {
    console.log('🔵 createPage: Starting page creation with data:', { ...data, content: '(content omitted)' });

    // Validate required fields to prevent empty path errors
    if (!data || !data.userId) {
      console.error("🔴 createPage: Cannot create page: Missing required user ID");
      return null;
    }

    // Ensure we have the username - if not provided, fetch it from the user profile
    let username = data.username;
    if (!username && data.userId) {
      try {
        // First try to get from currentUser utility if we're on the client
        if (typeof window !== 'undefined') {
          try {
            const { getCurrentUser } = require('../../utils/currentUser');
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.username) {
              username = currentUser.username;
              console.log('Using username from currentUser utility:', username);
            }
          } catch (e) {
            console.error('Error getting username from currentUser:', e);
          }
        }

        // If still no username, fetch from Firestore
        if (!username) {
          try {
            const userDoc = await getDoc(doc(db, "users", data.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data() as User;
              username = userData.username;
              console.log('Using username from Firestore:', username);
            }
          } catch (firestoreError) {
            console.error("Error fetching username from Firestore:", firestoreError);
            // Continue with a default username rather than failing
            username = 'Missing username';
          }
        }
      } catch (error) {
        console.error("Error fetching username:", error);
        // Set a default username rather than failing
        username = 'Anonymous';
      }
    }

    // Import Firestore Timestamp for proper timestamp handling
    const { Timestamp } = await import('firebase/firestore');
    // CRITICAL FIX: Use ISO string format for consistent sorting across all pages
    const now = new Date().toISOString();

    const pageData = {
      title: data.title || "Untitled",
      isPublic: data.isPublic !== undefined ? data.isPublic : true,
      userId: data.userId,
      username: username || "Anonymous", // Ensure username is saved with the page
      createdAt: now,
      lastModified: now,
      // CRITICAL FIX: Explicitly set deleted to false for new pages
      deleted: false,
      // Add location data if provided
      location: data.location || null,
      // Add fundraising fields
      totalPledged: 0,
      pledgeCount: 0,
      fundraisingEnabled: true,
      fundraisingGoal: data.fundraisingGoal || 0,
      // Add reply fields if this is a reply
      isReply: data.isReply || false,
      replyTo: data.replyTo || null,
      replyToTitle: data.replyToTitle || null,
      replyToUsername: data.replyToUsername || null,
    };

    console.log("Creating page with username:", username);

    try {
      const pageRef = await addDoc(collection(db, "pages"), pageData);
      console.log("Created page with ID:", pageRef.id);

      // Ensure we have content before creating a version
      const versionData = {
        content: data.content || JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]),
        createdAt: now, // Using the same ISO string format
        userId: data.userId,
        username: username || "Anonymous" // Also store username in version data for consistency
      };

      try {
        // create a subcollection for versions
        const version = await addDoc(collection(db, "pages", pageRef.id, "versions"), versionData);
        console.log("Created version with ID:", version.id);

        // take the version id and add it as the currentVersion on the page
        await setDoc(doc(db, "pages", pageRef.id), { currentVersion: version.id }, { merge: true });
        console.log("Updated page with current version ID");

        // Record user activity for streak tracking
        try {
          await recordUserActivity(data.userId);
          console.log("Recorded user activity for streak tracking");
        } catch (activityError) {
          console.error("Error recording user activity (non-fatal):", activityError);
          // Don't fail page creation if activity recording fails
        }

        // Update user page count
        try {
          const { incrementUserPageCount } = await import('../counters');
          await incrementUserPageCount(data.userId, pageData.isPublic);
          console.log("Updated user page count");
        } catch (counterError: any) {
          // Handle permission denied errors gracefully
          if (counterError?.code === 'permission-denied') {
            console.log("Permission denied updating user page count - this is expected in some environments");
          } else {
            console.error("Error updating user page count:", counterError);
          }
          // Don't fail page creation if counter update fails
        }

        return pageRef.id;
      } catch (versionError) {
        console.error("Error creating version:", versionError);

        // CRITICAL FIX: If version creation fails, delete the page and return null
        // This prevents orphaned pages without currentVersion
        try {
          console.log(`Deleting orphaned page ${pageRef.id} due to version creation failure`);
          await deleteDoc(doc(db, "pages", pageRef.id));
          console.log(`Successfully deleted orphaned page ${pageRef.id}`);
        } catch (deleteError) {
          console.error(`Failed to delete orphaned page ${pageRef.id}:`, deleteError);
        }

        return null;
      }
    } catch (pageError) {
      console.error("Error creating page document:", pageError);
      return null;
    }

  } catch (e) {
    console.error('Error creating page:', e);
    return null;
  }
};

/**
 * Get a page by ID with access control
 */
export const getPageById = async (pageId: string, userId: string | null = null): Promise<PageWithLinks> => {
  return await trackedFirestoreQuery('getPageById', async () => {
    return await trackQueryPerformance('getPageById', async () => {
      try {
        // Track this query for optimization analysis
        trackQuery('getPageById', { pageId, userId });

        // Validate pageId
        if (!pageId) {
          console.error("getPageById called with empty pageId");
          return { pageData: null, error: "Invalid page ID" };
        }

      // Check cache first (only for public pages or if user is the owner)
      const cacheKey = generateCacheKey('page', pageId, userId || 'public');
      const cachedData = getCacheItem(cacheKey);

      if (cachedData) {
        console.log(`Using cached data for page ${pageId}`);
        return cachedData;
      }

      // Get the page document with only the fields we need
      // Use field selection to reduce data transfer
      const pageRef = doc(db, "pages", pageId);
      // Only select the fields we actually need, excluding large content fields
      const docSnap = await getDoc(pageRef);

      if (docSnap.exists()) {
        const pageData = { id: docSnap.id, ...docSnap.data() } as PageData;

        // CRITICAL: Check access permissions including soft delete status
        const accessCheck = await checkPageAccess(pageData, userId);
        if (!accessCheck.hasAccess) {
          // Use console.log instead of console.error for access denied - this is expected behavior
          console.log(`Access denied to page ${pageId} for user ${userId || 'anonymous'}: ${accessCheck.error}`);
          return { pageData: null, error: accessCheck.error };
        }

        // If this is a deleted page and user is the owner, we allow access
        // but the calling code should determine if this is the appropriate context
        if (accessCheck.isDeleted && userId && pageData.userId === userId) {
          console.log(`Owner access granted to deleted page ${pageId} for user ${userId}`);
          // Continue with normal processing but mark as deleted
        }

        // Check if the page has content directly (from a save operation)
        if (pageData.content) {
          try {
            console.log(`getPageById: Page ${pageId} has direct content, length:`, pageData.content.length);

            // Create a version data object from the page content
            const versionData = {
              content: pageData.content,
              createdAt: pageData.lastModified || new Date().toISOString(),
              userId: pageData.userId || 'unknown'
            };

            // Validate content is proper JSON before parsing
            let parsedContent;
            try {
              const contentString = typeof versionData.content === 'string' ? versionData.content : JSON.stringify(versionData.content);
              parsedContent = JSON.parse(contentString);
              console.log(`getPageById: Successfully parsed content for page ${pageId}, nodes:`,
                Array.isArray(parsedContent) ? parsedContent.length : 'not an array');
            } catch (parseError) {
              console.error(`getPageById: Error parsing content for page ${pageId}:`, parseError);
              // If we can't parse the content, try to fix it or use empty content
              parsedContent = [];
            }

            // Extract links from the validated parsed content
            const links = extractLinksFromNodes(parsedContent);

            const result = { pageData, versionData, links };

            // Cache the result (only for public pages or if user is the owner)
            if (pageData.isPublic || (userId && pageData.userId === userId)) {
              setCacheItem(cacheKey, result, 5 * 60 * 1000); // Cache for 5 minutes
            }

            console.log("getPageById: Using content directly from page document");
            return result;
          } catch (error) {
            console.error("Error parsing page content in getPageById:", error);
            // Continue to fetch from version document as fallback
          }
        }

        // Get the current version ID
        const currentVersionId = pageData.currentVersion;

        // Validate that we have a current version ID
        if (!currentVersionId) {
          console.error(`Page ${pageId} has no currentVersion ID`);

          // Try to recover by creating a version if the page has content
          if (pageData.content) {
            console.log(`Attempting to recover page ${pageId} by creating missing version`);
            try {
              // Create a recovery version with the existing content
              const versionData = {
                content: pageData.content,
                createdAt: pageData.lastModified || new Date().toISOString(),
                userId: pageData.userId,
                username: pageData.username || "Anonymous",
                previousVersionId: null // This is a recovery version
              };

              // Create the version document
              const versionCollectionRef = collection(db, "pages", pageId, "versions");
              const versionRef = await addDoc(versionCollectionRef, versionData);
              console.log(`Created recovery version ${versionRef.id} for page ${pageId}`);

              // Update the page with the new currentVersion
              await setDoc(doc(db, "pages", pageId), {
                currentVersion: versionRef.id
              }, { merge: true });

              // Update pageData with the new currentVersion
              pageData.currentVersion = versionRef.id;
              console.log(`Successfully recovered page ${pageId} with version ${versionRef.id}`);
            } catch (recoveryError) {
              console.error(`Failed to recover page ${pageId}:`, recoveryError);
              return { pageData: null, error: "Page version not found and recovery failed" };
            }
          } else {
            // No content to recover from
            return { pageData: null, error: "Page version not found" };
          }
        }

        // Get the version document
        const versionCollectionRef = collection(db, "pages", pageId, "versions");
        const versionRef = doc(versionCollectionRef, currentVersionId);
        const versionSnap = await getDoc(versionRef);

        if (versionSnap.exists()) {
          const versionData = versionSnap.data();

          // Extract links
          const links = extractLinksFromNodes(JSON.parse(versionData.content));

          const result = { pageData, versionData, links };

          // Cache the result (only for public pages or if user is the owner)
          if (pageData.isPublic || (userId && pageData.userId === userId)) {
            setCacheItem(cacheKey, result, 5 * 60 * 1000); // Cache for 5 minutes
          }

          return result;
        } else {
          return { pageData: null, error: "Version not found" };
        }
      } else {
        return { pageData: null, error: "Page not found" };
      }
    } catch (error) {
      // Only log as error if it's not a permission denied (which is expected for private pages)
      if (error?.code !== 'permission-denied') {
        console.error("Error fetching page:", error);
        console.error("Fetch page error details:", {
          pageId,
          userId,
          errorMessage: error?.message || 'Unknown error',
          errorCode: error?.code || 'unknown',
          errorType: typeof error,
          errorString: String(error)
        });
      } else {
        console.log(`Permission denied for page ${pageId} - this is expected for private pages`);
      }

      // Provide more specific error messages based on error type
      let errorMessage = "Error fetching page";
      if (error?.code === 'permission-denied') {
        errorMessage = "You don't have permission to view this page";
      } else if (error?.code === 'not-found') {
        errorMessage = "Page not found";
      } else if (error?.code === 'unavailable') {
        errorMessage = "Service temporarily unavailable. Please try again later.";
      } else if (error?.message?.includes('network')) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error?.message?.includes('empty path')) {
        errorMessage = "Page data is corrupted. Please try refreshing the page.";
      } else if (error?.message) {
        errorMessage = `Error loading page: ${error.message}`;
      }

      return { pageData: null, error: errorMessage };
    }
    }, { pageId, userId });
  }, { collection: 'pages', pageId });
};

/**
 * Listen to page changes with real-time updates
 */
export const listenToPageById = (
  pageId: string,
  onPageUpdate: (data: PageWithLinks) => void,
  userId: string | null = null
): Unsubscribe => {
  // Validate pageId
  if (!pageId) {
    console.error("listenToPageById called with empty pageId");
    onPageUpdate({ pageData: null, error: "Invalid page ID" });
    return () => {};
  }

  console.log(`Setting up listener for page ${pageId} with userId ${userId || 'anonymous'}`);

  // Cache for version data to avoid unnecessary reads
  let cachedVersionData: VersionData | null = null;
  let cachedLinks: any[] | null = null;

  // Get reference to the page document - only select fields we need
  const pageRef = doc(db, "pages", pageId);

  // Variables to store unsubscribe functions
  let unsubscribeVersion: Unsubscribe | null = null;

  // Listen for changes to the page document
  const unsubscribe = onSnapshot(pageRef, async (docSnap) => {
    if (docSnap.exists()) {
      const pageData = { id: docSnap.id, ...docSnap.data() } as PageData;
      console.log(`Page data received for ${pageId}:`, {
        isPublic: pageData.isPublic,
        userId: pageData.userId,
        currentUserId: userId
      });

      // Check access permissions including soft delete status
      try {
        const accessCheck = await checkPageAccess(pageData, userId);
        if (!accessCheck.hasAccess) {
          // Use console.log instead of console.error for access denied - this is expected behavior
          console.log(`Access denied to page ${pageId} for user ${userId || 'anonymous'}: ${accessCheck.error}`);
          onPageUpdate({ error: accessCheck.error });
          return;
        }

        // If this is a deleted page and user is the owner, we allow access
        // but the calling code should determine if this is the appropriate context
        if (accessCheck.isDeleted && userId && pageData.userId === userId) {
          console.log(`Owner access granted to deleted page ${pageId} for user ${userId}`);
          // Continue with normal processing but mark as deleted
        }
      } catch (error) {
        console.error(`Error checking access for page ${pageId}:`, error);
        onPageUpdate({ error: "Error checking page access" });
        return;
      }

      try {
        // Get the current version ID
        const currentVersionId = pageData.currentVersion;

        // Validate that we have a current version ID
        if (!currentVersionId) {
          console.error(`Page ${pageId} has no currentVersion ID`);

          // Try to recover by creating a version if the page has content
          if (pageData.content) {
            console.log(`Attempting to recover page ${pageId} by creating missing version`);
            try {
              // Create a recovery version with the existing content
              const versionData = {
                content: pageData.content,
                createdAt: pageData.lastModified || new Date().toISOString(),
                userId: pageData.userId,
                username: pageData.username || "Anonymous",
                previousVersionId: null // This is a recovery version
              };

              // Create the version document
              const versionCollectionRef = collection(db, "pages", pageId, "versions");
              const versionRef = await addDoc(versionCollectionRef, versionData);
              console.log(`Created recovery version ${versionRef.id} for page ${pageId}`);

              // Update the page with the new currentVersion
              await setDoc(doc(db, "pages", pageId), {
                currentVersion: versionRef.id
              }, { merge: true });

              // Update pageData with the new currentVersion and continue processing
              pageData.currentVersion = versionRef.id;
              console.log(`Successfully recovered page ${pageId} with version ${versionRef.id}`);

              // Continue with the normal flow using the recovered version
              // Don't return here, let the function continue
            } catch (recoveryError) {
              console.error(`Failed to recover page ${pageId}:`, recoveryError);
              onPageUpdate({ error: "Page version not found and recovery failed" });
              return;
            }
          } else {
            // No content to recover from
            onPageUpdate({ error: "Page version not found" });
            return;
          }
        }

        // Check if the page has content directly (from a save operation)
        if (pageData.content) {
          try {
            console.log(`Page ${pageId} has direct content, length:`, pageData.content.length);

            // Create a version data object from the page content
            const versionData = {
              content: pageData.content,
              createdAt: pageData.lastModified || new Date().toISOString(),
              userId: pageData.userId || 'unknown'
            };

            // Validate content is proper JSON before parsing
            let parsedContent;
            try {
              const contentString = typeof versionData.content === 'string' ? versionData.content : JSON.stringify(versionData.content);
              parsedContent = JSON.parse(contentString);
              console.log(`Successfully parsed content for page ${pageId}, nodes:`,
                Array.isArray(parsedContent) ? parsedContent.length : 'not an array');
            } catch (parseError) {
              console.error(`Error parsing content for page ${pageId}:`, parseError);
              // If we can't parse the content, try to fix it or use empty content
              parsedContent = [];
            }

            // Extract links from the validated parsed content
            const links = extractLinksFromNodes(parsedContent);

            // Create properly typed version data
            const typedVersionData: VersionData = {
              content: typeof versionData.content === 'string' ? versionData.content : JSON.stringify(versionData.content),
              createdAt: typeof versionData.createdAt === 'string' ? versionData.createdAt : versionData.createdAt.toString(),
              userId: versionData.userId
            };

            // Send updated page and version data immediately
            onPageUpdate({ pageData, versionData: typedVersionData, links });

            // Update cache
            cachedVersionData = typedVersionData;
            cachedLinks = links;

            // If we have a version listener, remove it since we have the content directly
            if (unsubscribeVersion) {
              unsubscribeVersion();
              unsubscribeVersion = null;
            }

            return; // Skip version listener since we already have the content
          } catch (error) {
            console.error("Error parsing page content:", error);
            // Continue to fetch from version document as fallback
          }
        }

        // Check if the version ID has changed
        const versionChanged = !cachedVersionData || pageData.currentVersion !== currentVersionId;

        // If version hasn't changed and we have cached data, use it
        if (!versionChanged && cachedVersionData && cachedLinks) {
          onPageUpdate({ pageData, versionData: cachedVersionData, links: cachedLinks });
          return;
        }

        // If we don't have content in the page document or parsing failed, get it from the version
        const versionCollectionRef = collection(db, "pages", pageId, "versions");
        const versionRef = doc(versionCollectionRef, currentVersionId);

        // If there's an existing unsubscribeVersion listener, remove it before setting a new one
        if (unsubscribeVersion) {
          unsubscribeVersion();
        }

        // Listener for the version document - only set up if needed
        unsubscribeVersion = onSnapshot(versionRef, { includeMetadataChanges: true }, async (versionSnap) => {
          if (versionSnap.exists()) {
            const rawVersionData = versionSnap.data();

            // Create properly typed version data
            const versionData: VersionData = {
              content: typeof rawVersionData.content === 'string' ? rawVersionData.content : JSON.stringify(rawVersionData.content),
              createdAt: rawVersionData.createdAt,
              userId: rawVersionData.userId
            };

            // Extract links
            const links = extractLinksFromNodes(JSON.parse(versionData.content));

            // Update cache
            cachedVersionData = versionData;
            cachedLinks = links;

            // Send updated page and version data
            onPageUpdate({ pageData, versionData, links });
          } else {
            console.error("Version document does not exist:", currentVersionId);
          }
        }, (error) => {
          // Handle permission denied errors gracefully - this is expected for private pages
          if (error?.code === 'permission-denied') {
            console.log(`Permission denied accessing version ${currentVersionId} for page ${pageId} - this is expected for private pages`);
            onPageUpdate({ error: "You don't have permission to view this page" });
          } else {
            console.error(`Error in version listener for page ${pageId}:`, error);
            onPageUpdate({ error: "Error loading page content" });
          }
        });
      } catch (error) {
        // Handle permission denied errors gracefully - this is expected for private pages
        if (error?.code === 'permission-denied') {
          console.log(`Permission denied checking page access for ${pageId} - this is expected for private pages`);
          onPageUpdate({ error: "You don't have permission to view this page" });
          return;
        }

        console.error("Error checking page access:", error);
        console.error("Page access error details:", {
          pageId,
          userId,
          errorMessage: error?.message || 'Unknown error',
          errorCode: error?.code || 'unknown',
          errorType: typeof error,
          errorString: String(error)
        });

        // Provide more specific error messages based on error type
        let errorMessage = "Error checking page access";
        if (error?.code === 'not-found') {
          errorMessage = "Page not found";
        } else if (error?.code === 'unavailable') {
          errorMessage = "Service temporarily unavailable. Please try again later.";
        } else if (error?.message?.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error?.message?.includes('empty path')) {
          errorMessage = "Page data is corrupted. Please try refreshing the page.";
        } else if (error?.message) {
          errorMessage = `Error loading page: ${error.message}`;
        }

        onPageUpdate({ error: errorMessage });
      }
    } else {
      // If page document doesn't exist
      onPageUpdate({ error: "Page not found" });
    }
  }, (error) => {
    // Handle permission denied errors gracefully - this is expected for private pages
    if (error?.code === 'permission-denied') {
      console.log(`Permission denied accessing page ${pageId} - this is expected for private pages`);
      onPageUpdate({ error: "You don't have permission to view this page" });
    } else {
      console.error(`Error in page listener for ${pageId}:`, error);
      onPageUpdate({ error: "Error loading page" });
    }
  });

  // Return the unsubscribe functions for cleanup
  return () => {
    unsubscribe();
    if (unsubscribeVersion) {
      unsubscribeVersion();
    }
  };
};

/**
 * Get all pages that a user can edit (their own pages)
 */
export const getEditablePagesByUser = async (userId: string): Promise<any[]> => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Dynamic import to match the pattern used elsewhere
    const { db } = await import('../database');
    const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');

    // Query for user's pages (exclude deleted pages)
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId),
      where('deleted', '!=', true),
      orderBy('lastModified', 'desc')
    );

    const snapshot = await getDocs(pagesQuery);
    const pages: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      pages.push({
        id: doc.id,
        title: data.title || 'Untitled',
        isPublic: data.isPublic || false,
        userId: data.userId,
        authorName: data.authorName || data.displayName,
        lastModified: data.lastModified,
        createdAt: data.createdAt
      });
    });

    return pages;
  } catch (error) {
    console.error('Error fetching editable pages:', error);
    return [];
  }
};
