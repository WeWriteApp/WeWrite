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
import { getCollectionName } from "../../utils/environmentConfig";
import { logEnhancedFirebaseError, createUserFriendlyErrorMessage } from "../../utils/firebase-error-handler";

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
            const userDoc = await getDoc(doc(db, getCollectionName("users"), data.userId));
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
      isPublic: true, // All pages are public
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
      // Add custom date field for daily notes
      customDate: data.customDate || null
    };

    console.log("Creating page with username:", username);
    console.log("🔍 DEBUG: Page data being saved:", { ...pageData, content: '(omitted)' });

    try {
      const collectionName = getCollectionName("pages");
      console.log("🔍 DEBUG: Writing page to collection:", collectionName);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Firestore write timeout after 10 seconds')), 10000);
      });

      const writePromise = addDoc(collection(db, collectionName), pageData);

      console.log("🔍 DEBUG: Starting Firestore write operation...");
      const pageRef = await Promise.race([writePromise, timeoutPromise]) as any;
      console.log("Created page with ID:", pageRef.id);
      console.log("🔍 DEBUG: Page created successfully with customDate:", pageData.customDate);

      // Ensure we have content before creating a version
      const versionData = {
        content: data.content || JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]),
        createdAt: now, // Using the same ISO string format
        userId: data.userId,
        username: username || "Anonymous" // Also store username in version data for consistency
      };

      try {
        // create a subcollection for versions with timeout
        console.log("🔍 DEBUG: Creating version document...");
        const versionTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Version creation timeout after 10 seconds')), 10000);
        });

        const versionWritePromise = addDoc(collection(db, getCollectionName("pages"), pageRef.id, "versions"), versionData);
        const version = await Promise.race([versionWritePromise, versionTimeoutPromise]) as any;
        console.log("Created version with ID:", version.id);

        // take the version id and add it as the currentVersion on the page with timeout
        console.log("🔍 DEBUG: Updating page with current version ID...");
        const updateTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Page update timeout after 10 seconds')), 10000);
        });

        const updatePromise = setDoc(doc(db, getCollectionName("pages"), pageRef.id), { currentVersion: version.id }, { merge: true });
        await Promise.race([updatePromise, updateTimeoutPromise]);
        console.log("Updated page with current version ID");

        // Record user activity for streak tracking
        try {
          await recordUserActivity(data.userId);
          console.log("Recorded user activity for streak tracking");
        } catch (activityError) {
          console.error("Error recording user activity (non-fatal):", activityError);
          // Don't fail page creation if activity recording fails
        }

        // Activity creation removed - now using recent pages with diff data stored on pages

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

        // Update backlinks index for the new page
        try {
          const { updateBacklinksIndex } = await import('./backlinks');

          // Parse content to extract links
          let contentNodes = [];
          if (versionData.content && typeof versionData.content === 'string') {
            try {
              contentNodes = JSON.parse(versionData.content);
            } catch (parseError) {
              console.warn('Could not parse content for backlinks indexing:', parseError);
            }
          }

          await updateBacklinksIndex(
            pageRef.id,
            pageData.title,
            pageData.username,
            contentNodes,
            pageData.isPublic,
            pageData.lastModified
          );

          console.log('✅ Backlinks index updated for new page');
        } catch (backlinkError) {
          console.error('⚠️ Error updating backlinks index (non-fatal):', backlinkError);
        }

        return pageRef.id;
      } catch (versionError) {
        console.error("Error creating version:", versionError);

        // CRITICAL FIX: If version creation fails, delete the page and return null
        // This prevents orphaned pages without currentVersion
        try {
          console.log(`Deleting orphaned page ${pageRef.id} due to version creation failure`);
          await deleteDoc(doc(db, getCollectionName("pages"), pageRef.id));
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



      // Use API route for client-side requests to avoid Firebase connectivity issues
      if (typeof window !== 'undefined') {
        try {
          console.log(`getPageById: Using API route for client-side request: ${pageId}`);
          const response = await fetch(`/api/pages/${pageId}${userId ? `?userId=${userId}` : ''}`);

          if (response.ok) {
            const pageData = await response.json();

            // Transform API response to match expected format
            const result = {
              pageData: pageData,
              versionData: null, // API doesn't return version data yet
              links: [] // API doesn't return links yet
            };



            console.log("getPageById: Successfully used API route for client-side request");
            return result;
          } else if (response.status === 404) {
            return { pageData: null, error: "Page not found" };
          } else {
            console.warn(`API route failed with status ${response.status}, falling back to direct Firestore`);
          }
        } catch (apiError) {
          console.warn('API route failed, falling back to direct Firestore:', apiError);
        }
      }

      // Fallback to direct Firestore access (for server-side or when API fails)
      console.log(`getPageById: Using direct Firestore access for: ${pageId}`);

      // Get the page document with only the fields we need
      // Use field selection to reduce data transfer
      const pageRef = doc(db, getCollectionName("pages"), pageId);
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
          console.warn(`Page ${pageId} has no currentVersion ID, attempting recovery`);

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
              const versionCollectionRef = collection(db, getCollectionName("pages"), pageId, "versions");
              const versionRef = await addDoc(versionCollectionRef, versionData);
              console.log(`Created recovery version ${versionRef.id} for page ${pageId}`);

              // Update the page with the new currentVersion
              await setDoc(doc(db, getCollectionName("pages"), pageId), {
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
        const versionCollectionRef = collection(db, getCollectionName("pages"), pageId, "versions");
        const versionRef = doc(versionCollectionRef, currentVersionId);
        const versionSnap = await getDoc(versionRef);

        if (versionSnap.exists()) {
          const versionData = versionSnap.data();

          // Extract links
          const links = extractLinksFromNodes(JSON.parse(versionData.content));

          const result = { pageData, versionData, links };



          return result;
        } else {
          return { pageData: null, error: "Version not found" };
        }
      } else {
        return { pageData: null, error: "Page not found" };
      }
    } catch (error) {
      // Use enhanced error handling for better debugging and user messages
      logEnhancedFirebaseError(error, `fetchPage(pageId: ${pageId}, userId: ${userId})`);

      const userFriendlyMessage = createUserFriendlyErrorMessage(error, 'page access');

      return { pageData: null, error: userFriendlyMessage };
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
  const pageRef = doc(db, getCollectionName("pages"), pageId);

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
          console.warn(`Page ${pageId} has no currentVersion ID, attempting recovery`);

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
              const versionCollectionRef = collection(db, getCollectionName("pages"), pageId, "versions");
              const versionRef = await addDoc(versionCollectionRef, versionData);
              console.log(`Created recovery version ${versionRef.id} for page ${pageId}`);

              // Update the page with the new currentVersion
              await setDoc(doc(db, getCollectionName("pages"), pageId), {
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
        const versionCollectionRef = collection(db, getCollectionName("pages"), pageId, "versions");
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

    // Define editable page fields to reduce document size by 60-70%
    const editablePageFields = [
      'title', 'isPublic', 'userId', 'authorName', 'displayName',
      'lastModified', 'createdAt'
    ];

    // Query for user's pages with field selection (exclude deleted pages)
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
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
        authorName: data.authorName || data.username,
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