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
    // Validate required fields to prevent empty path errors
    if (!data || !data.userId) {
      return null;
    }

    // Ensure we have the username - if not provided, fetch it from the user profile
    let username = data.username;
    if (!username && data.userId) {
      try {
        // Note: Username should be provided by the caller from the auth context
        // This fallback is for backward compatibility only

        // If still no username, fetch from Firestore
        if (!username) {
          try {
            const userDoc = await getDoc(doc(db, getCollectionName("users"), data.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data() as User;
              username = userData.username;
            }
          } catch (firestoreError) {
            // Continue with a default username rather than failing
            username = 'Missing username';
          }
        }
      } catch (error) {
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

    try {
      const collectionName = getCollectionName("pages");

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Firestore write timeout after 10 seconds')), 10000);
      });

      const writePromise = addDoc(collection(db, collectionName), pageData);

      const pageRef = await Promise.race([writePromise, timeoutPromise]) as any;

      // Ensure we have content before creating a version
      const versionData = {
        content: data.content || [{ type: "paragraph", children: [{ text: "" }] }], // Store as object array
        createdAt: now, // Using the same ISO string format
        userId: data.userId,
        username: username || "Anonymous" // Also store username in version data for consistency
      };

      // Compute initial diff so recent edits and activity cards have previews for new pages/replies
      let initialDiff: {
        added: number;
        removed: number;
        hasChanges: boolean;
        preview: any;
      } | null = null;

      try {
        const { calculateDiff } = await import('../../utils/diffService');
        const diffResult = await calculateDiff(versionData.content, '');
        initialDiff = {
          added: diffResult.added || 0,
          removed: diffResult.removed || 0,
          hasChanges: diffResult.hasChanges || (diffResult.added || 0) > 0 || (diffResult.removed || 0) > 0 || true, // new page => always treated as change
          preview: diffResult.preview
        };
        // Attach diff data to the initial version for consistency with subsequent saves
        (versionData as any).diff = {
          added: initialDiff.added,
          removed: initialDiff.removed,
          hasChanges: initialDiff.hasChanges
        };
        (versionData as any).diffPreview = diffResult.preview || null;
      } catch (diffError) {
        // Failed to calculate initial diff - non-fatal
      }

      // Fallback preview if diff service failed to produce one
      if (initialDiff?.preview === undefined) {
        try {
          const { extractTextContent } = await import('../../utils/text-extraction');
          const snippet = extractTextContent(versionData.content).slice(0, 200);
          initialDiff = initialDiff || {
            added: snippet.length,
            removed: 0,
            hasChanges: true,
            preview: null
          };
          if (!initialDiff.preview) {
            initialDiff.preview = {
              beforeContext: '',
              addedText: snippet,
              removedText: '',
              afterContext: '',
              hasAdditions: true,
              hasRemovals: false
            };
          }
        } catch (fallbackError) {
          // Failed to build fallback diff preview - non-fatal
        }
      }

      // Persist lastDiff on the page for recent edits feeds
      if (initialDiff) {
        (pageData as any).lastDiff = {
          added: initialDiff.added,
          removed: initialDiff.removed,
          hasChanges: initialDiff.hasChanges,
          preview: initialDiff.preview
        };

        // Ensure the version carries the same diff metadata (covers fallback path too)
        (versionData as any).diff = (versionData as any).diff || {
          added: initialDiff.added,
          removed: initialDiff.removed,
          hasChanges: initialDiff.hasChanges
        };
        (versionData as any).diffPreview = (versionData as any).diffPreview ?? initialDiff.preview ?? null;
      }

      try {
        // create a subcollection for versions with timeout
        const versionTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Version creation timeout after 10 seconds')), 10000);
        });

        const versionWritePromise = addDoc(collection(db, getCollectionName("pages"), pageRef.id, "versions"), versionData);
        const version = await Promise.race([versionWritePromise, versionTimeoutPromise]) as any;

        // take the version id and add it as the currentVersion on the page with timeout
        const updateTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Page update timeout after 10 seconds')), 10000);
        });

        // Include lastDiff in the update so activity cards have diff data for new pages
        const pageUpdateData: any = { currentVersion: version.id };
        if (initialDiff) {
          pageUpdateData.lastDiff = {
            added: initialDiff.added,
            removed: initialDiff.removed,
            hasChanges: initialDiff.hasChanges,
            preview: initialDiff.preview
          };
        }
        const updatePromise = setDoc(doc(db, getCollectionName("pages"), pageRef.id), pageUpdateData, { merge: true });
        await Promise.race([updatePromise, updateTimeoutPromise]);

        // Record user activity for streak tracking
        try {
          await recordUserActivity(data.userId);
        } catch (activityError) {
          // Don't fail page creation if activity recording fails
        }

        // Activity creation removed - now using recent pages with diff data stored on pages

        // Update user page count
        try {
          const { incrementUserPageCount } = await import('../counters');
          await incrementUserPageCount(data.userId, pageData.isPublic);
        } catch (counterError: any) {
          // Don't fail page creation if counter update fails
        }

        // Update what-links-here index for the new page
        try {
          const { updateWhatLinksHereIndex } = await import('./whatLinksHere');

          // Parse content to extract links
          let contentNodes = [];
          if (versionData.content && typeof versionData.content === 'string') {
            try {
              contentNodes = JSON.parse(versionData.content);
            } catch (parseError) {
              // Could not parse content for indexing
            }
          }

          await updateWhatLinksHereIndex(
            pageRef.id,
            pageData.title,
            pageData.username,
            contentNodes,
            pageData.isPublic,
            pageData.lastModified
          );
        } catch (indexError) {
          // Error updating what-links-here index - non-fatal
        }

        // Sync to Typesense for real-time search updates
        // This ensures new pages are immediately searchable
        const contentString = typeof versionData.content === 'string'
          ? versionData.content
          : JSON.stringify(versionData.content);

        const searchSyncData = {
          pageId: pageRef.id,
          title: pageData.title,
          content: contentString,
          authorId: data.userId,
          authorUsername: pageData.username || '',
          isPublic: pageData.isPublic ?? true,
          alternativeTitles: [],
          lastModified: now,
          createdAt: now,
        };

        try {
          const { syncPageToTypesense } = await import('../../lib/typesenseSync');
          await syncPageToTypesense(searchSyncData);
        } catch (typesenseError) {
          // Don't fail page creation if Typesense sync fails
        }

        return pageRef.id;
      } catch (versionError) {
        // CRITICAL FIX: If version creation fails, delete the page and return null
        // This prevents orphaned pages without currentVersion
        try {
          await deleteDoc(doc(db, getCollectionName("pages"), pageRef.id));
        } catch (deleteError) {
          // Failed to delete orphaned page
        }

        return null;
      }
    } catch (pageError) {
      return null;
    }

  } catch (e) {
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
          return { pageData: null, error: "Invalid page ID" };
        }

        // CACHING DISABLED: Always fetch fresh data for editor
        // const { pageCache } = await import('../../utils/pageCache');
        // const cachedData = pageCache.get(pageId, userId);
        // if (cachedData) {
        //   return cachedData;
        // }

      // Use API route for client-side requests - NO CACHING
      if (typeof window !== 'undefined') {
        try {
          const response = await fetch(`/api/pages/${pageId}${userId ? `?userId=${userId}` : ''}`, {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
            cache: 'no-store' // Disable fetch cache
          });

          if (response.ok) {
            const apiResponse = await response.json();

            // Transform API response to match expected format
            // The API returns { success: true, pageData: {...} }
            const result = {
              pageData: apiResponse.pageData || apiResponse,
              versionData: null, // API doesn't return version data yet
              links: [] // API doesn't return links yet
            };

            // CACHING DISABLED - do not cache the result
            return result;
          } else if (response.status === 404) {
            return { pageData: null, error: "Page not found" };
          }
        } catch (apiError) {
          // API route failed, falling back to direct Firestore
        }
      }

      // Fallback to direct Firestore access (for server-side or when API fails)

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
          return { pageData: null, error: accessCheck.error };
        }

        // Check if the page has content directly (from a save operation)
        if (pageData.content) {
          try {
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
            } catch (parseError) {
              // If we can't parse the content, try to fix it or use empty content
              parsedContent = [];
            }

            // Extract links from the validated parsed content
            const links = extractLinksFromNodes(parsedContent);

            const result = { pageData, versionData, links };

            return result;
          } catch (error) {
            // Continue to fetch from version document as fallback
          }
        }

        // Get the current version ID
        const currentVersionId = pageData.currentVersion;

        // Validate that we have a current version ID
        if (!currentVersionId) {
          // Try to recover by creating a version if the page has content
          if (pageData.content) {
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

              // Update the page with the new currentVersion
              await setDoc(doc(db, getCollectionName("pages"), pageId), {
                currentVersion: versionRef.id
              }, { merge: true });

              // Update pageData with the new currentVersion
              pageData.currentVersion = versionRef.id;
            } catch (recoveryError) {
              return { pageData: null, error: "Page version not found and recovery failed" };
            }
          } else {
            // No content to recover from
            return { pageData: null, error: "Page version not found" };
          }
        }

        // CRITICAL FIX: Use content directly from page document first
        // According to our version system, the page document should have the most recent content
        let versionData = null;
        let links = [];

        if (pageData.content) {
          // Use content directly from page document (most recent version)
          try {
            // Parse content to extract links
            const contentToParse = typeof pageData.content === 'string'
              ? JSON.parse(pageData.content)
              : pageData.content;
            links = extractLinksFromNodes(contentToParse);

            // Create version data from page data for compatibility
            versionData = {
              content: pageData.content,
              title: pageData.title,
              createdAt: pageData.lastModified || pageData.createdAt,
              userId: pageData.userId,
              username: pageData.username
            };
          } catch (parseError) {
            // Continue to try version document as fallback
          }
        }

        // Fallback: Get content from version document if page content is missing or invalid
        if (!versionData && currentVersionId) {

          const versionCollectionRef = collection(db, getCollectionName("pages"), pageId, "versions");
          const versionRef = doc(versionCollectionRef, currentVersionId);
          const versionSnap = await getDoc(versionRef);

          if (versionSnap.exists()) {
            versionData = versionSnap.data();

            try {
              // Extract links from version content
              const contentToParse = typeof versionData.content === 'string'
                ? JSON.parse(versionData.content)
                : versionData.content;
              links = extractLinksFromNodes(contentToParse);
            } catch (parseError) {
              links = [];
            }
          } else {
            return { pageData: null, error: "Version not found" };
          }
        }

        // If we still don't have version data, create a minimal one
        if (!versionData) {
          versionData = {
            content: "[]", // Empty content
            title: pageData.title || "Untitled",
            createdAt: pageData.lastModified || pageData.createdAt || new Date().toISOString(),
            userId: pageData.userId,
            username: pageData.username || "Anonymous"
          };
        }

        const result = { pageData, versionData, links };
        return result;
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
    onPageUpdate({ pageData: null, error: "Invalid page ID" });
    return () => {};
  }

  // Cache for version data to avoid unnecessary reads
  let cachedVersionData: VersionData | null = null;
  let cachedLinks: any[] | null = null;

  // Get reference to the page document - only select fields we need
  const pageRef = doc(db, getCollectionName("pages"), pageId);

  // Variables to store unsubscribe functions
  let unsubscribeVersion: Unsubscribe | null = null;

  // Real-time listeners disabled for cost optimization
  return () => {};
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
    // displayName removed - fully deprecated, only use username
    const editablePageFields = [
      'title', 'isPublic', 'userId', 'authorName', 'username',
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
    return [];
  }
};

// ============================================================================
// ALTERNATIVE TITLES FUNCTIONS
// ============================================================================

/**
 * Get alternative titles for a page
 */
export const getAlternativeTitles = async (pageId: string): Promise<string[]> => {
  try {
    const pageRef = doc(db, getCollectionName("pages"), pageId);
    const pageDoc = await getDoc(pageRef);

    if (!pageDoc.exists()) {
      return [];
    }

    const data = pageDoc.data();
    return data.alternativeTitles || [];
  } catch (error) {
    return [];
  }
};

/**
 * Add an alternative title to a page
 * @returns true if successful, false if title already exists or is same as primary
 */
export const addAlternativeTitle = async (
  pageId: string,
  newTitle: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const trimmedTitle = newTitle.trim();

    if (!trimmedTitle) {
      return { success: false, error: 'Title cannot be empty' };
    }

    const pageRef = doc(db, getCollectionName("pages"), pageId);
    const pageDoc = await getDoc(pageRef);

    if (!pageDoc.exists()) {
      return { success: false, error: 'Page not found' };
    }

    const data = pageDoc.data();

    // Check ownership
    if (data.userId !== userId) {
      return { success: false, error: 'You do not have permission to edit this page' };
    }

    // Check if title matches primary title (case-insensitive)
    if (data.title?.toLowerCase() === trimmedTitle.toLowerCase()) {
      return { success: false, error: 'Alternative title cannot be the same as the primary title' };
    }

    const currentAlternatives = data.alternativeTitles || [];

    // Check if title already exists (case-insensitive)
    if (currentAlternatives.some((t: string) => t.toLowerCase() === trimmedTitle.toLowerCase())) {
      return { success: false, error: 'This alternative title already exists' };
    }

    // Add the new alternative title
    await setDoc(pageRef, {
      alternativeTitles: [...currentAlternatives, trimmedTitle],
      lastModified: new Date().toISOString()
    }, { merge: true });

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to add alternative title' };
  }
};

/**
 * Remove an alternative title from a page
 */
export const removeAlternativeTitle = async (
  pageId: string,
  titleToRemove: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const pageRef = doc(db, getCollectionName("pages"), pageId);
    const pageDoc = await getDoc(pageRef);

    if (!pageDoc.exists()) {
      return { success: false, error: 'Page not found' };
    }

    const data = pageDoc.data();

    // Check ownership
    if (data.userId !== userId) {
      return { success: false, error: 'You do not have permission to edit this page' };
    }

    const currentAlternatives = data.alternativeTitles || [];
    const updatedAlternatives = currentAlternatives.filter(
      (t: string) => t.toLowerCase() !== titleToRemove.toLowerCase()
    );

    if (updatedAlternatives.length === currentAlternatives.length) {
      return { success: false, error: 'Alternative title not found' };
    }

    await setDoc(pageRef, {
      alternativeTitles: updatedAlternatives,
      lastModified: new Date().toISOString()
    }, { merge: true });

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to remove alternative title' };
  }
};

/**
 * Promote an alternative title to primary (swaps with current primary)
 */
export const promoteAlternativeTitle = async (
  pageId: string,
  titleToPromote: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const pageRef = doc(db, getCollectionName("pages"), pageId);
    const pageDoc = await getDoc(pageRef);

    if (!pageDoc.exists()) {
      return { success: false, error: 'Page not found' };
    }

    const data = pageDoc.data();

    // Check ownership
    if (data.userId !== userId) {
      return { success: false, error: 'You do not have permission to edit this page' };
    }

    const currentAlternatives = data.alternativeTitles || [];
    const currentPrimary = data.title;

    // Find the alternative title to promote (case-insensitive search)
    const titleIndex = currentAlternatives.findIndex(
      (t: string) => t.toLowerCase() === titleToPromote.toLowerCase()
    );

    if (titleIndex === -1) {
      return { success: false, error: 'Alternative title not found' };
    }

    // Get the exact title (preserving case)
    const exactTitle = currentAlternatives[titleIndex];

    // Create new alternatives array: remove promoted title, add old primary
    const newAlternatives = [
      ...currentAlternatives.slice(0, titleIndex),
      ...currentAlternatives.slice(titleIndex + 1),
      currentPrimary
    ];

    await setDoc(pageRef, {
      title: exactTitle,
      alternativeTitles: newAlternatives,
      lastModified: new Date().toISOString()
    }, { merge: true });

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to promote alternative title' };
  }
};

/**
 * Set all alternative titles at once (for bulk operations)
 */
export const setAlternativeTitles = async (
  pageId: string,
  titles: string[],
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const pageRef = doc(db, getCollectionName("pages"), pageId);
    const pageDoc = await getDoc(pageRef);

    if (!pageDoc.exists()) {
      return { success: false, error: 'Page not found' };
    }

    const data = pageDoc.data();

    // Check ownership
    if (data.userId !== userId) {
      return { success: false, error: 'You do not have permission to edit this page' };
    }

    // Clean and validate titles
    const cleanedTitles = titles
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .filter(t => t.toLowerCase() !== data.title?.toLowerCase()); // Remove any that match primary

    // Remove duplicates (case-insensitive)
    const uniqueTitles: string[] = [];
    const seenLower = new Set<string>();
    for (const title of cleanedTitles) {
      const lower = title.toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        uniqueTitles.push(title);
      }
    }

    await setDoc(pageRef, {
      alternativeTitles: uniqueTitles,
      lastModified: new Date().toISOString()
    }, { merge: true });

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to set alternative titles' };
  }
};
