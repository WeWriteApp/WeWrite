import {
  getFirestore,
  type Firestore,
  addDoc,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
  type QueryDocumentSnapshot
} from "firebase/firestore";

import { app } from "./config";
import { rtdb } from "./rtdb";
import { get, ref } from "firebase/database";

// Import utility functions
import { generateCacheKey, getCacheItem, setCacheItem } from "../utils/cacheUtils";
import { trackQueryPerformance } from "../utils/queryMonitor";
import { recordUserActivity } from "./streaks";
import { createLinkNotification, createAppendNotification } from "./notifications";

// Import types
import type {
  Page,
  User,
  Group,
  SlateContent,
  PageVersion,
  LinkData
} from "../types/database";

export const db: Firestore = getFirestore(app);

// Type definitions for database operations
interface PageAccessResult {
  hasAccess: boolean;
  error?: string;
  reason?: string;
}

type PageData = Page;

interface VersionData {
  content: string;
  createdAt: string;
  userId: string;
  username?: string;
  groupId?: string | null;
}

interface CreatePageData {
  title?: string;
  content?: string;
  isPublic?: boolean;
  userId: string;
  username?: string;
  groupId?: string | null;
  groupName?: string | null;
  location?: string | null;
  fundraisingGoal?: number;
  isReply?: boolean;
  replyTo?: string | null;
  replyToTitle?: string | null;
  replyToUsername?: string | null;
}

interface PageUpdateData {
  content: string;
  userId: string;
  username?: string;
  groupId?: string | null;
}

interface PageStats {
  totalPledged: number;
  pledgeCount: number;
  views: number;
  lastModified: string;
}

interface PageWithLinks {
  pageData?: PageData | null;
  versionData?: VersionData | null;
  links?: LinkData[];
  error?: string;
}

// Utility function to check if a user has access to a page
export const checkPageAccess = async (pageData: PageData | null, userId: string | null): Promise<PageAccessResult> => {
  // If page doesn't exist, no one has access
  if (!pageData) {
    return {
      hasAccess: false,
      error: "Page not found"
    };
  }

  // Private pages are accessible to their owners regardless of other settings
  if (userId && pageData.userId === userId) {
    return {
      hasAccess: true,
      reason: "owner"
    };
  }

  // Check if the page belongs to a group
  if (pageData.groupId) {
    try {
      const groupRef = ref(rtdb, `groups/${pageData.groupId}`);
      const groupSnapshot = await get(groupRef);

      if (groupSnapshot.exists()) {
        const groupData = groupSnapshot.val() as Group;

        // If the group is public, public pages are accessible to everyone
        if (groupData.isPublic && pageData.isPublic) {
          return {
            hasAccess: true,
            reason: "public page in public group"
          };
        }

        // If the group is public, private pages are also accessible to everyone
        // This is because adding a page to a public group makes it visible to everyone
        if (groupData.isPublic && !pageData.isPublic) {
          return {
            hasAccess: true,
            reason: "private page in public group"
          };
        }

        // For private groups, check if the user is a member
        if (!groupData.isPublic) {
          // If user is not logged in, deny access to private group content
          if (!userId) {
            return {
              hasAccess: false,
              error: "Access denied: This page belongs to a private group"
            };
          }

          // Check if the user is a member of the group
          if (groupData.members && groupData.members[userId]) {
            return {
              hasAccess: true,
              reason: "group member"
            };
          }

          // If not a member, deny access
          return {
            hasAccess: false,
            error: "Access denied: This page belongs to a private group and is only accessible to group members"
          };
        }
      }
    } catch (error) {
      console.error("Error checking group membership:", error);
      return {
        hasAccess: false,
        error: "Error checking group access"
      };
    }
  }

  // For pages not in groups, public pages are accessible to everyone
  if (pageData.isPublic) {
    return {
      hasAccess: true,
      reason: "public page"
    };
  }

  // Otherwise, access is denied (private page not in a group and user is not the owner)
  return {
    hasAccess: false,
    error: "Access denied: This page is private and can only be viewed by its owner"
  };
};

// Utility function to get user's group memberships efficiently
export const getUserGroupMemberships = async (userId: string | null): Promise<string[]> => {
  if (!userId) {
    return [];
  }

  try {
    const userGroupsRef = ref(rtdb, `users/${userId}/groups`);
    const userGroupsSnapshot = await get(userGroupsRef);

    if (!userGroupsSnapshot.exists()) {
      return [];
    }

    const userGroups = userGroupsSnapshot.val();
    return Object.keys(userGroups);
  } catch (error) {
    console.error("Error getting user group memberships:", error);
    return [];
  }
};

// Utility function to get group data for multiple groups efficiently
export const getGroupsData = async (groupIds: string[]): Promise<Record<string, Group>> => {
  if (!groupIds || groupIds.length === 0) {
    return {};
  }

  try {
    const groupsData: Record<string, Group> = {};

    // Fetch all groups in parallel
    const groupPromises = groupIds.map(async (groupId) => {
      const groupRef = ref(rtdb, `groups/${groupId}`);
      const groupSnapshot = await get(groupRef);

      if (groupSnapshot.exists()) {
        groupsData[groupId] = groupSnapshot.val() as Group;
      }
    });

    await Promise.all(groupPromises);
    return groupsData;
  } catch (error) {
    console.error("Error getting groups data:", error);
    return {};
  }
};

export const createDoc = async (collectionName: string, data: any): Promise<string | Error> => {
  try {
    const docRef = await addDoc(collection(db, collectionName), data);
    // return the id of the newly created doc
    return docRef.id;

  } catch (e) {
    return e as Error;
  }
}

export const createPage = async (data: CreatePageData): Promise<string | null> => {
  try {
    console.log('Creating page with data:', { ...data, content: '(content omitted)' });

    // Validate required fields to prevent empty path errors
    if (!data || !data.userId) {
      console.error("Cannot create page: Missing required user ID");
      return null;
    }

    // Ensure we have the username - if not provided, fetch it from the user profile
    let username = data.username;
    if (!username && data.userId) {
      try {
        // First try to get from currentUser utility if we're on the client
        if (typeof window !== 'undefined') {
          try {
            const { getCurrentUser } = require('../utils/currentUser');
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
            username = 'Anonymous';
          }
        }
      } catch (error) {
        console.error("Error fetching username:", error);
        // Set a default username rather than failing
        username = 'Anonymous';
      }
    }

    const pageData = {
      title: data.title || "Untitled",
      isPublic: data.isPublic !== undefined ? data.isPublic : true,
      userId: data.userId,
      username: username || "Anonymous", // Ensure username is saved with the page
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      // Add group ID if provided
      groupId: data.groupId || null,
      groupName: data.groupName || null,
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
        createdAt: new Date().toISOString(),
        userId: data.userId,
        username: username || "Anonymous", // Also store username in version data for consistency
        groupId: data.groupId || null // Store group ID if the page belongs to a group
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
          const { incrementUserPageCount } = await import('./counters');
          await incrementUserPageCount(data.userId, pageData.isPublic);
          console.log("Updated user page count");
        } catch (counterError) {
          console.error("Error updating user page count:", counterError);
          // Don't fail page creation if counter update fails
        }

        return pageRef.id;
      } catch (versionError) {
        console.error("Error creating version:", versionError);
        // Even if version creation fails, return the page ID
        return pageRef.id;
      }
    } catch (pageError) {
      console.error("Error creating page document:", pageError);
      return null;
    }

  } catch (e) {
    console.error('Error creating page:', e);
    return null;
  }
}

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
  let cachedLinks: LinkData[] | null = null;

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

      // Always return the page data for private pages if the user is the owner
      if (!pageData.isPublic && userId && pageData.userId === userId) {
        // User is the owner, allow access to their private page
        console.log(`Owner access granted to private page ${pageId} for user ${userId}`);
      } else {
        // Check access permissions for non-owners
        try {
          const accessCheck = await checkPageAccess(pageData, userId);
          if (!accessCheck.hasAccess) {
            console.error(`Access denied to page ${pageId} for user ${userId || 'anonymous'}`);
            onPageUpdate({ error: accessCheck.error });
            return;
          }
        } catch (error) {
          console.error(`Error checking access for page ${pageId}:`, error);
          onPageUpdate({ error: "Error checking page access" });
          return;
        }
      }

      try {
        // Get the current version ID
        const currentVersionId = pageData.currentVersion;

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
              parsedContent = JSON.parse(versionData.content);
              console.log(`Successfully parsed content for page ${pageId}, nodes:`,
                Array.isArray(parsedContent) ? parsedContent.length : 'not an array');
            } catch (parseError) {
              console.error(`Error parsing content for page ${pageId}:`, parseError);
              // If we can't parse the content, try to fix it or use empty content
              parsedContent = [];
            }

            // Extract links from the validated parsed content
            const links = extractLinksFromNodes(parsedContent);

            // Send updated page and version data immediately
            onPageUpdate({ pageData, versionData, links });

            // Update cache
            cachedVersionData = versionData;
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
            const versionData = versionSnap.data();

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
        });
      } catch (error) {
        console.error("Error checking page access:", error);
        console.error("Page access error details:", {
          pageId,
          userId,
          errorMessage: error.message,
          errorCode: error.code
        });

        // Provide more specific error messages based on error type
        let errorMessage = "Error checking page access";
        if (error.code === 'permission-denied') {
          errorMessage = "You don't have permission to view this page";
        } else if (error.code === 'not-found') {
          errorMessage = "Page not found";
        } else if (error.code === 'unavailable') {
          errorMessage = "Service temporarily unavailable. Please try again later.";
        } else if (error.message?.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        }

        onPageUpdate({ error: errorMessage });
      }
    } else {
      // If page document doesn't exist
      onPageUpdate({ error: "Page not found" });
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

export const getPageById = async (pageId: string, userId: string | null = null): Promise<PageWithLinks> => {
  return await trackQueryPerformance('getPageById', async () => {
    try {
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

        // Always allow access to private pages if the user is the owner
        if (!pageData.isPublic && userId && pageData.userId === userId) {
          // User is the owner, allow access to their private page
          console.log(`Owner access granted to private page ${pageId} for user ${userId}`);
        } else {
          // Check access permissions for non-owners
          const accessCheck = await checkPageAccess(pageData, userId);
          if (!accessCheck.hasAccess) {
            console.error(`Access denied to page ${pageId} for user ${userId || 'anonymous'}`);
            return { pageData: null, error: accessCheck.error };
          }
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
              parsedContent = JSON.parse(versionData.content);
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
      console.error("Error fetching page:", error);
      console.error("Fetch page error details:", {
        pageId,
        userId,
        errorMessage: error.message,
        errorCode: error.code
      });

      // Provide more specific error messages based on error type
      let errorMessage = "Error fetching page";
      if (error.code === 'permission-denied') {
        errorMessage = "You don't have permission to view this page";
      } else if (error.code === 'not-found') {
        errorMessage = "Page not found";
      } else if (error.code === 'unavailable') {
        errorMessage = "Service temporarily unavailable. Please try again later.";
      } else if (error.message?.includes('network')) {
        errorMessage = "Network error. Please check your connection and try again.";
      }

      return { pageData: null, error: errorMessage };
    }
  }, { pageId, userId });
};

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
}

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

    // Return version data with ID and previous version if available
    return {
      id: versionSnap.id,
      ...versionData,
      previousVersion
    };
  } catch (error) {
    console.error("Error fetching page version:", error);
    return null;
  }
}

export const getPageVersions = async (pageId, versionCount = 10) => {
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
        return dateB - dateA;
      });

      // Limit to the requested number
      versions = versions.slice(0, versionCount);

      return versions;
    } catch (innerError) {
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
        console.error("Error with fallback query:", queryError);
        return [];
      }
    }
  } catch (e) {
    console.error("Error fetching page versions:", e);
    return [];
  }
}

// Import moved to top of file to avoid circular dependencies

export const saveNewVersion = async (pageId, data) => {
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

    // Check for empty JSON structures
    if (contentString === '[]' || contentString === '{}' || contentString === '') {
      console.error("Cannot save empty content JSON");
      return null;
    }

    console.log('Content string to save:', contentString.substring(0, 100) + '...');

    // Parse content to validate it's proper JSON
    let parsedContent;
    try {
      parsedContent = JSON.parse(contentString);

      // Validate that content is not empty array or has empty paragraphs only
      // Less strict validation to allow saving
      if (Array.isArray(parsedContent) && parsedContent.length === 0) {
        console.error("Cannot save empty array content");
        return null;
      }

      // Extract links from the content to check for page links
      const links = extractLinksFromNodes(parsedContent);

      // Process links to create notifications
      if (links.length > 0 && data.userId) {
        // Get the current page info for the notification
        const pageDoc = await getDoc(doc(db, "pages", pageId));
        const sourcePageTitle = pageDoc.exists() ? pageDoc.data().title || "Untitled Page" : "Untitled Page";

        // Process each link
        for (const link of links) {
          // Check if it's a page link (internal link to another page)
          if (link.url && (link.url.startsWith('/') || link.url.startsWith('/pages/'))) {
            // Extract the page ID from the URL
            const targetPageId = link.url.replace('/pages/', '/').replace('/', '');

            if (targetPageId && targetPageId !== pageId) { // Don't notify for self-links
              try {
                // Get the target page to check its owner
                const targetPageDoc = await getDoc(doc(db, "pages", targetPageId));

                if (targetPageDoc.exists()) {
                  const targetPageData = targetPageDoc.data();
                  const targetUserId = targetPageData.userId;
                  const targetPageTitle = targetPageData.title || "Untitled Page";

                  // Create a notification if the target page belongs to another user
                  if (targetUserId && targetUserId !== data.userId) {
                    await createLinkNotification(
                      targetUserId,
                      data.userId,
                      targetPageId,
                      targetPageTitle,
                      pageId,
                      sourcePageTitle
                    );
                  }
                }
              } catch (linkError) {
                console.error("Error processing link notification:", linkError);
                // Continue processing other links
              }
            }
          }
        }
      }

      // Ensure we're using the parsed and re-stringified content for consistency
      contentString = JSON.stringify(parsedContent);
    } catch (error) {
      console.error("Error parsing content:", error);
      return null;
    }

    const pageRef = doc(db, "pages", pageId);

    // Variables to store previous content for diff generation
    let previousContent = null;
    let previousVersionId = null;

    // If skipIfUnchanged is true, check if content has changed from the most recent version
    if (data.skipIfUnchanged) {
      try {
        // Get the current version
        const pageDoc = await getDoc(pageRef);
        if (pageDoc.exists()) {
          const pageData = pageDoc.data();
          const currentVersionId = pageData.currentVersion;
          previousVersionId = currentVersionId;

          if (currentVersionId) {
            // Get the current version content
            const versionRef = doc(collection(pageRef, "versions"), currentVersionId);
            const versionDoc = await getDoc(versionRef);

            if (versionDoc.exists()) {
              const versionData = versionDoc.data();
              const currentContent = versionData.content;

              // Store previous content for diff generation
              previousContent = currentContent;

              // Compare content more carefully to avoid blank diffs
              if (currentContent === contentString) {
                console.log("Content unchanged, skipping version creation");
                return currentVersionId; // Return existing version ID
              }

              // Additional check for "empty" changes
              try {
                const currentParsed = JSON.parse(currentContent);
                const newParsed = JSON.parse(contentString);

                // Check if both are arrays and have the same structure
                if (Array.isArray(currentParsed) && Array.isArray(newParsed)) {
                  // Check if the only difference is whitespace or empty paragraphs
                  const currentText = extractTextFromContent(currentParsed);
                  const newText = extractTextFromContent(newParsed);

                  if (currentText.trim() === newText.trim()) {
                    console.log("Content effectively unchanged (only whitespace/formatting differences), skipping version creation");
                    return currentVersionId;
                  }
                }
              } catch (parseError) {
                console.error("Error comparing parsed content:", parseError);
                // Continue with version creation if comparison fails
              }
            }
          }
        }
      } catch (error) {
        console.error("Error checking for content changes:", error);
        // Continue with version creation if check fails
      }
    } else {
      // Even if skipIfUnchanged is false, we still need to get the previous content for diff generation
      try {
        const pageDoc = await getDoc(pageRef);
        if (pageDoc.exists()) {
          const pageData = pageDoc.data();
          const currentVersionId = pageData.currentVersion;
          previousVersionId = currentVersionId;

          if (currentVersionId) {
            // Get the current version content
            const versionRef = doc(collection(pageRef, "versions"), currentVersionId);
            const versionDoc = await getDoc(versionRef);

            if (versionDoc.exists()) {
              const versionData = versionDoc.data();
              previousContent = versionData.content;
            }
          }
        }
      } catch (error) {
        console.error("Error getting previous content for diff:", error);
      }
    }

    // Get the username from the user document
    let username = data.username;
    if (!username && data.userId) {
      try {
        const userDoc = await getDoc(doc(db, "users", data.userId));
        if (userDoc.exists()) {
          username = userDoc.data().username;
        }
      } catch (error) {
        console.error("Error fetching username:", error);
      }
    }

    // Get the page data to check for group ownership
    let groupId = data.groupId;
    if (!groupId) {
      try {
        const pageDoc = await getDoc(pageRef);
        if (pageDoc.exists()) {
          const pageData = pageDoc.data();
          groupId = pageData.groupId || null;
        }
      } catch (error) {
        console.error("Error fetching page data for group ID:", error);
      }
    }

    const versionData = {
      content: contentString,
      createdAt: new Date().toISOString(),
      userId: data.userId,
      username: username || "Anonymous",
      groupId: groupId || null,
      previousContent: previousContent,
      previousVersionId: previousVersionId
    };

    // CRITICAL FIX: First update the page document directly to ensure content is immediately available
    // Use the pageRef directly instead of collection/doc name strings
    const updateTime = new Date().toISOString();

    // Log the content being saved for debugging
    console.log("Saving content to page document", {
      contentLength: contentString.length,
      timestamp: updateTime
    });

    try {
      // Validate the content one more time before saving
      JSON.parse(contentString);

      await setDoc(pageRef, {
        content: contentString,
        lastModified: updateTime
      }, { merge: true });

      console.log("Page document updated with new content");
    } catch (parseError) {
      console.error("Error validating content before saving:", parseError);
      // Continue with version creation anyway, but log the error
    }

    // Then create the version
    const versionRef = await addDoc(collection(pageRef, "versions"), versionData);
    console.log("Version created with ID:", versionRef.id);

    // Set the new version as the current version
    await setCurrentVersion(pageId, versionRef.id);

    // Record user activity for streak tracking
    if (data.userId) {
      await recordUserActivity(data.userId);
      console.log("Recorded user activity for streak tracking");
    }

    // Invalidate cache for this page to ensure fresh data is loaded
    const cacheKey = generateCacheKey('page', pageId, data.userId || 'public');
    setCacheItem(cacheKey, null, 0); // Clear the cache
    console.log(`Cache invalidated for page ${pageId}`);

    console.log("Page content updated and new version saved successfully");
    return versionRef.id;
  } catch (e) {
    console.error("Error saving new version:", e);
    return null;
  }
}

export const setCurrentVersion = async (pageId, versionId) => {
  try {
    const pageRef = doc(db, "pages", pageId);

    // Get the page data to check the current user ID
    const pageDoc = await getDoc(pageRef);
    let userId = null;

    if (pageDoc.exists()) {
      const pageData = pageDoc.data();
      userId = pageData.userId;
    }

    // Update the current version
    await setDoc(pageRef, { currentVersion: versionId }, { merge: true });

    // Invalidate cache for this page to ensure fresh data is loaded
    const cacheKey = generateCacheKey('page', pageId, userId || 'public');
    setCacheItem(cacheKey, null, 0); // Clear the cache
    console.log(`Cache invalidated for page ${pageId} in setCurrentVersion`);

    return true;
  } catch (e) {
    console.error("Error setting current version:", e);
    return e;
  }
}

export const setDocData = async (collectionName: string, docName: string, data: any): Promise<void | Error> => {
  try {
    await setDoc(doc(db, collectionName, docName), data);
  } catch (e) {
    return e as Error;
  }
}

export const getDocById = async (collectionName: string, docId: string): Promise<DocumentSnapshot | null> => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    // return the doc snapshot directly, so we can use exists() and data() methods
    return docSnap;
  } catch (e) {
    console.error("Error getting document:", e);
    return null;
  }
};

export const getCollection = async (collectionName: string): Promise<QuerySnapshot | Error> => {
  try {
    const collectionRef = collection(db, collectionName);
    const collectionSnap = await getDocs(collectionRef);
    return collectionSnap;
  } catch (e) {
    return e as Error;
  }
}

export const updateDoc = async (collectionName, docName, data) => {
  try {
    const docRef = doc(db, collectionName, docName);

    // If this is a page update and isPublic is being changed, track the change
    let oldPageData = null;
    if (collectionName === "pages" && data.hasOwnProperty('isPublic')) {
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          oldPageData = docSnap.data();
        }
      } catch (error) {
        console.error("Error getting old page data for counter update:", error);
      }
    }

    await setDoc(docRef, data, { merge: true });

    // If this is a page update, invalidate the cache
    if (collectionName === "pages") {
      // Get the user ID from the data or try to get it from the page
      let userId = data.userId;

      if (!userId) {
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            userId = docSnap.data().userId;
          }
        } catch (error) {
          console.error("Error getting userId for cache invalidation:", error);
        }
      }

      // Update page count if visibility changed
      if (oldPageData && data.hasOwnProperty('isPublic') && oldPageData.userId) {
        try {
          const { updateUserPageCountForVisibilityChange } = await import('./counters');
          await updateUserPageCountForVisibilityChange(
            oldPageData.userId,
            oldPageData.isPublic,
            data.isPublic
          );
          console.log("Updated user page count for visibility change");
        } catch (counterError) {
          console.error("Error updating user page count for visibility change:", counterError);
          // Don't fail update if counter update fails
        }
      }

      // Invalidate cache for this page
      const cacheKey = generateCacheKey('page', docName, userId || 'public');
      setCacheItem(cacheKey, null, 0); // Clear the cache
      console.log(`Cache invalidated for page ${docName} in updateDoc`);
    }

    return docRef;
  } catch (e) {
    console.error("Error updating document:", e);
    return e;
  }
}

export const removeDoc = async (collectionName: string, docName: string): Promise<boolean | Error> => {
  try {
    await deleteDoc(doc(db, collectionName, docName));
    return true;
  } catch (e) {
    return e as Error;
  }
}

export const deletePage = async (pageId: string): Promise<{ success: boolean; error?: string } | Error> => {
  // remove page and the versions subcollection
  try {
    console.log(`Starting deletion process for page: ${pageId}`);

    const pageRef = doc(db, "pages", pageId);

    // Get page data before deletion to update counters
    let pageData = null;
    try {
      const pageSnap = await getDoc(pageRef);
      if (pageSnap.exists()) {
        pageData = pageSnap.data();
      }
    } catch (error) {
      console.error("Error getting page data before deletion:", error);
    }

    const versionsRef = collection(pageRef, "versions");
    const versionsSnap = await getDocs(versionsRef);

    // delete all versions
    versionsSnap.forEach(async (doc) => {
      await deleteDoc(doc.ref);
    });

    // delete the page
    await deleteDoc(pageRef);
    console.log(`Page ${pageId} deleted from Firestore`);

    // Update user page count if we have the page data
    if (pageData && pageData.userId) {
      try {
        const { decrementUserPageCount } = await import('./counters');
        await decrementUserPageCount(pageData.userId, pageData.isPublic);
        console.log("Updated user page count after deletion");
      } catch (counterError) {
        console.error("Error updating user page count after deletion:", counterError);
        // Don't fail deletion if counter update fails
      }
    }

    // Clean up related notifications
    try {
      const { deleteNotificationsForPage } = await import('./notifications');
      const deletedNotifications = await deleteNotificationsForPage(pageId);
      console.log(`Cleaned up ${deletedNotifications} notifications for page ${pageId}`);
    } catch (notificationError) {
      console.error('Error cleaning up notifications:', notificationError);
      // Don't fail the entire deletion if notification cleanup fails
    }

    console.log(`Page deletion completed successfully for: ${pageId}`);
    return true;
  } catch (e) {
    console.error(`Error deleting page ${pageId}:`, e);
    return e;
  }
}

// create subcollection
export const createSubcollection = async (collectionName, docId, subcollectionName, data) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const subcollectionRef = collection(docRef, subcollectionName);
    const subcollectionDocRef = await addDoc(subcollectionRef, data);
    return subcollectionDocRef.id;
  } catch (e) {
    console.log(e);
    return e;
  }
}

// get subcollection
export const getSubcollection = async (collectionName, docName, subcollectionName) => {
  try {
    const docRef = doc(db, collectionName, docName);
    const subcollectionRef = collection(docRef, subcollectionName);
    const subcollectionSnap = await getDocs(subcollectionRef);
    return subcollectionSnap;
  } catch (e) {
    return e;
  }
}

export const updatePage = async (pageId, data) => {
  try {
    const pageRef = doc(db, "pages", pageId);
    await setDoc(pageRef, { ...data, lastModified: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) {
    console.error("Error updating page:", e);
    throw e;
  }
}

/**
 * Extract all links from a Slate document
 *
 * @param {Array} nodes - The Slate document nodes
 * @returns {Array} - Array of link objects
 */
function extractLinksFromNodes(nodes) {
  let links = [];

  function traverse(node) {
    // Check if the node is a link
    if (node.type === 'link' && node.url) {
      // Create a link object with all relevant properties
      const linkObj = {
        url: node.url,
        pageId: node.pageId,
        pageTitle: node.pageTitle
      };

      // Add additional properties if they exist
      if (node.isExternal) linkObj.isExternal = true;
      if (node.className) linkObj.className = node.className;
      if (node.isPageLink) linkObj.isPageLink = true;
      if (node.isUser) linkObj.isUser = true;
      if (node.userId) linkObj.userId = node.userId;

      // Add the link to the array
      links.push(linkObj);

      // Log the extracted link for debugging
      console.log('Extracted link:', linkObj);
    }

    // Recursively check children if they exist
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }

  // Start traversal
  if (Array.isArray(nodes)) {
    nodes.forEach(traverse);
  } else if (nodes && typeof nodes === 'object') {
    // Handle case where nodes is a single object
    traverse(nodes);
  }

  return links;
}

/**
 * Extract all text from a Slate document
 *
 * @param {Array} nodes - The Slate document nodes
 * @returns {string} - The extracted text
 */
function extractTextFromContent(nodes) {
  let text = '';

  function traverse(node) {
    // If the node has text, add it to the result
    if (typeof node.text === 'string') {
      text += node.text;
    }

    // Recursively check children if they exist
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }

  // Start traversal
  if (Array.isArray(nodes)) {
    nodes.forEach(traverse);
  }

  return text;
}

/**
 * Find pages that link to a specific page (backlinks)
 *
 * @param {string} targetPageId - The ID of the page to find backlinks for
 * @param {number} limit - Maximum number of backlinks to return
 * @returns {Promise<Array>} - Array of page objects that link to the target page
 */
export async function findBacklinks(targetPageId, limit = 10) {
  try {
    if (!targetPageId) {
      console.error("findBacklinks called with empty targetPageId");
      return [];
    }

    // Ensure we're in a browser environment
    if (typeof window === 'undefined') {
      console.log('findBacklinks called in server context, returning empty array');
      return [];
    }

    // Normalize the targetPageId to handle any format inconsistencies
    const normalizedTargetId = targetPageId.trim();

    console.log(`Finding backlinks for page ${normalizedTargetId}`);

    // CRITICAL FIX: Disable cache completely to ensure real-time backlink updates
    // This fixes the issue where recent navigation doesn't appear in "What Links Here"

    // Dynamically import Firestore functions to avoid SSR issues
    const { collection, query, where, orderBy, limit: firestoreLimit, getDocs } = await import('firebase/firestore');

    // Get all pages from Firestore, ordered by last modified date
    // CRITICAL FIX: Increase limit significantly to catch recent navigation links
    const pagesRef = collection(db, 'pages');
    const pagesQuery = query(
      pagesRef,
      orderBy('lastModified', 'desc'),
      firestoreLimit(500) // Significantly increased limit for real-time backlink detection
    );

    const pagesSnapshot = await getDocs(pagesQuery);
    const backlinkPages = [];

    // Process each page to check if it links to the target page
    for (const docSnapshot of pagesSnapshot.docs) {
      const pageData = { id: docSnapshot.id, ...docSnapshot.data() };

      // Skip the target page itself
      if (pageData.id === normalizedTargetId) continue;

      // Skip if the page doesn't have content
      if (!pageData.content) continue;

      try {
        // Parse the content to check for links
        const content = JSON.parse(pageData.content);

        console.log(`Checking page ${pageData.id} (${pageData.title || 'Untitled'}) for links to ${normalizedTargetId}`);

        // Check if this page links to the target page
        if (pageContainsLinkTo(content, normalizedTargetId)) {
          console.log(`Found backlink in page ${pageData.id} (${pageData.title || 'Untitled'})`);
          backlinkPages.push(pageData);

          // Break early if we've found enough backlinks
          if (backlinkPages.length >= limit) break;
        }
      } catch (error) {
        console.error(`Error parsing content for page ${pageData.id}:`, error);
      }
    }

    console.log(`Found ${backlinkPages.length} backlinks for page ${normalizedTargetId}`);

    // Re-enable caching once we confirm the feature is working
    // setCacheItem(cacheKey, backlinkPages, 5 * 60 * 1000);

    return backlinkPages;
  } catch (error) {
    console.error("Error finding backlinks:", error);
    return [];
  }
}

/**
 * Check if a page's content contains a link to the target page
 *
 * @param {Array} content - The page content as a Slate document
 * @param {string} targetPageId - The ID of the page to check for links to
 * @returns {boolean} - True if the content contains a link to the target page
 */
function pageContainsLinkTo(content, targetPageId) {
  // Normalize the target page ID for consistent comparison
  const normalizedTargetId = targetPageId.trim();

  // Set to track found links
  const foundLinks = new Set();

  // Debug logging
  console.log(`Checking if content contains link to page: ${normalizedTargetId}`);

  // Recursive function to traverse nodes and find links
  const traverseNodes = (node) => {
    // Check if the node is a link
    if (node.type === 'link') {
      // First check if pageId property is directly available
      if (node.pageId) {
        const normalizedNodePageId = node.pageId.trim();
        if (normalizedNodePageId === normalizedTargetId) {
          console.log(`Found direct pageId match: ${normalizedNodePageId}`);
          foundLinks.add(normalizedNodePageId);
          return true;
        }
      }

      // Then check URL if available
      if (node.url) {
        // Check if it's an internal page link - handle all possible URL formats
        if (node.url.startsWith('/') || node.url.startsWith('/pages/')) {
          // Extract the page ID from the URL - handle all possible formats
          let pageId = node.url;

          // Remove leading slashes and 'pages/' prefix
          pageId = pageId.replace(/^\/+/, ''); // Remove all leading slashes
          pageId = pageId.replace(/^pages\//, ''); // Remove 'pages/' prefix if present
          pageId = pageId.trim(); // Trim any whitespace

          if (pageId === normalizedTargetId) {
            console.log(`Found URL match: ${pageId} from URL ${node.url}`);
            foundLinks.add(pageId);
            return true;
          }
        }
      }
    }

    // Recursively check children if they exist
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (traverseNodes(child)) return true;
      }
    }

    return false;
  };

  // Start traversal on each top-level node
  if (Array.isArray(content)) {
    for (const node of content) {
      if (traverseNodes(node)) return true;
    }
  }

  return foundLinks.size > 0;
}

export const getUsernameByEmail = async (email) => {
  try {
    const q = query(collection(db, "users"), where("email", "==", email), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    const userDoc = querySnapshot.docs[0];
    return userDoc.data().username;
  } catch (error) {
    console.error("Error getting username:", error);
    return null;
  }
};

// Get page statistics including active donors, monthly income, and total views
export const getPageStats = async (pageId) => {
  try {
    if (!pageId) return null;

    const pageRef = doc(db, "pages", pageId);
    const pageSnapshot = await getDoc(pageRef);

    if (!pageSnapshot.exists()) {
      return null;
    }

    const pageData = pageSnapshot.data();

    // Here we would fetch additional statistics from other subcollections
    // For now, return the basic stats from the page document
    return {
      totalPledged: pageData.totalPledged || 0,
      pledgeCount: pageData.pledgeCount || 0,
      views: pageData.views || 0,
      lastModified: pageData.lastModified,
      // Add more stats as needed
    };
  } catch (error) {
    console.error("Error getting page stats:", error);
    return null;
  }
};

// Get pages that the user has edit access to (they own or are in groups they belong to)
export const getEditablePagesByUser = async (userId, searchQuery = "") => {
  try {
    if (!userId) return [];

    let pages = [];

    // First get all pages owned by the user
    const userPagesQuery = query(
      collection(db, "pages"),
      where("userId", "==", userId),
      orderBy("lastModified", "desc"),
      limit(50)
    );

    const userPagesSnapshot = await getDocs(userPagesQuery);

    // Add user's own pages to the result
    userPagesSnapshot.forEach((doc) => {
      const data = doc.data();
      pages.push({
        id: doc.id,
        ...data
      });
    });

    // Get all groups the user is a member of
    const groupsRef = ref(rtdb, 'groups');
    const groupsSnapshot = await get(groupsRef);

    if (groupsSnapshot.exists()) {
      const groups = groupsSnapshot.val();

      // Find groups where user is a member
      const userGroups = Object.entries(groups)
        .filter(([_, groupData]) =>
          groupData.members && groupData.members[userId]
        )
        .map(([groupId, groupData]) => ({
          id: groupId,
          ...groupData
        }));

      // For each group, get all pages
      for (const group of userGroups) {
        if (group.pages) {
          // Get detailed page data for each page in the group
          const groupPageIds = Object.keys(group.pages);

          for (const pageId of groupPageIds) {
            // Check if we already have this page (user might own pages in their groups)
            if (!pages.some(p => p.id === pageId)) {
              // Get the page data from Firestore
              const pageRef = doc(db, "pages", pageId);
              const pageSnap = await getDoc(pageRef);

              if (pageSnap.exists()) {
                const pageData = pageSnap.data();
                pages.push({
                  id: pageId,
                  ...pageData,
                  // Add group information
                  groupId: group.id,
                  groupName: group.name
                });
              }
            }
          }
        }
      }
    }

    // Sort all pages by last modified date
    pages.sort((a, b) => {
      const dateA = new Date(a.lastModified || a.createdAt || 0);
      const dateB = new Date(b.lastModified || b.createdAt || 0);
      return dateB - dateA; // Descending order (newest first)
    });

    // Client-side filtering for search
    if (searchQuery) {
      const normalizedQuery = searchQuery.toLowerCase();
      pages = pages.filter(page => {
        const normalizedTitle = page.title.toLowerCase();
        return normalizedTitle.includes(normalizedQuery);
      });
    }

    console.log(`Found ${pages.length} pages matching query "${searchQuery}" (including group pages)`);
    return pages;
  } catch (error) {
    console.error("Error getting editable pages:", error);
    return [];
  }
};

// Add a new function to fetch only page metadata (title, lastModified, etc.)
export async function getPageMetadata(pageId) {
  try {
    const { doc, getDoc, collection } = await import('firebase/firestore');
    const pageRef = doc(db, 'pages', pageId);
    const pageSnapshot = await getDoc(pageRef);

    if (!pageSnapshot.exists()) {
      return null;
    }

    const pageData = {
      id: pageSnapshot.id,
      ...pageSnapshot.data()
    };

    // Ensure we have a valid username
    if (!pageData.username || pageData.username === 'Anonymous' || pageData.username === 'Missing username') {
      if (pageData.userId) {
        try {
          // Import the utility function to get username
          const { getUsernameById } = await import('../utils/userUtils');
          const username = await getUsernameById(pageData.userId);

          if (username && username !== 'Anonymous' && username !== 'Missing username') {
            pageData.username = username;
          }
        } catch (error) {
          console.error('Error fetching username for page metadata:', error);
        }
      }
    }

    // If we have a currentVersion, fetch it to get the content for OG image and description
    if (pageData.currentVersion) {
      try {
        const versionsRef = collection(db, 'pages', pageId, 'versions');
        const versionDoc = doc(versionsRef, pageData.currentVersion);
        const versionSnapshot = await getDoc(versionDoc);

        if (versionSnapshot.exists()) {
          pageData.content = versionSnapshot.data().content;

          // Extract the first paragraph of content for description
          try {
            const contentNodes = JSON.parse(versionSnapshot.data().content);
            if (Array.isArray(contentNodes) && contentNodes.length > 0) {
              // Find the first paragraph with actual text content
              const firstTextParagraph = contentNodes.find(node =>
                node.type === 'paragraph' &&
                node.children &&
                node.children.some(child => child.text && child.text.trim().length > 0)
              );

              if (firstTextParagraph) {
                // Extract text from all children
                const paragraphText = firstTextParagraph.children
                  .map(child => child.text || '')
                  .join('')
                  .trim();

                if (paragraphText.length > 0) {
                  // Limit description to ~160 characters for SEO best practices
                  pageData.description = paragraphText.length > 160
                    ? paragraphText.substring(0, 157) + '...'
                    : paragraphText;
                }
              }
            }
          } catch (parseError) {
            console.error('Error parsing content for description:', parseError);
          }
        }
      } catch (versionError) {
        console.error('Error fetching page content for OG image:', versionError);
      }
    }

    return pageData;
  } catch (error) {
    console.error('Error fetching page metadata:', error);
    throw error;
  }
}

// Add a function to cache and retrieve page titles
// Use a global cache that persists between function calls
const pageTitleCache = new Map();

/**
 * Get a page title from cache or database
 *
 * @param {string} pageId - The page ID to get the title for
 * @returns {Promise<string>} The page title
 */
export async function getCachedPageTitle(pageId) {
  // Validate input
  if (!pageId) return 'Untitled';

  // Check if title is in cache
  if (pageTitleCache.has(pageId)) {
    return pageTitleCache.get(pageId);
  }

  try {
    // Try to get from database
    const metadata = await getPageMetadata(pageId);
    const title = metadata?.title || 'Untitled';

    // Only cache non-empty, meaningful titles
    if (title && title !== 'Untitled') {
      pageTitleCache.set(pageId, title);
    }

    return title;
  } catch (error) {
    console.error('Error fetching page title:', error);
    return 'Untitled';
  }
}

/**
 * Prefetch and cache multiple page titles at once
 * This is useful for optimizing performance when displaying lists of pages
 *
 * @param {string[]} pageIds - Array of page IDs to prefetch titles for
 * @returns {Promise<void>}
 */
export async function prefetchPageTitles(pageIds) {
  if (!pageIds || pageIds.length === 0) return;

  try {
    const { getDocs, query, collection, where } = await import('firebase/firestore');

    // Filter out IDs that are already cached and ensure we have valid IDs
    const uncachedIds = pageIds.filter(id => id && typeof id === 'string' && !pageTitleCache.has(id));

    if (uncachedIds.length === 0) return;

    // Batch fetch pages in chunks of 10 (Firestore limit for 'in' queries)
    const batchSize = 10;
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize);

      // Create a query for this batch
      const q = query(
        collection(db, 'pages'),
        where('__name__', 'in', batch)
      );

      const querySnapshot = await getDocs(q);

      // Cache each page title, but only if it's meaningful
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const title = data.title || 'Untitled';

        // Only cache non-empty, meaningful titles
        if (title && title !== 'Untitled') {
          pageTitleCache.set(doc.id, title);
        }
      });

      // Log the number of titles fetched in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`Prefetched ${querySnapshot.size} page titles (batch ${i/batchSize + 1})`);
      }
    }
  } catch (error) {
    console.error('Error prefetching page titles:', error);
  }
}

// Append a reference to a page at the end of another page's content
export const appendPageReference = async (targetPageId, sourcePageData, userId = null) => {
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

    // Create a notification for the source page owner
    if (sourcePageData.userId && sourcePageData.userId !== (userId || pageData.userId)) {
      try {
        await createAppendNotification(
          sourcePageData.userId, // Target user (owner of the source page)
          userId || pageData.userId, // Source user (person doing the append)
          sourcePageData.id, // Source page ID
          sourcePageData.title, // Source page title
          targetPageId, // Target page ID
          pageData.title // Target page title
        );
      } catch (notificationError) {
        console.error("Error creating append notification:", notificationError);
        // Don't fail the append operation if notification creation fails
      }
    }

    return true;
  } catch (error) {
    console.error("Error appending page reference:", error);
    return false;
  }
};

// Search for users by username or email
export const searchUsers = async (searchQuery, limitCount = 10) => {
  if (!searchQuery || searchQuery.trim().length < 2) {
    return [];
  }

  try {
    const usersRef = collection(db, "users");

    // Import limit function from Firestore
    const { limit } = await import('firebase/firestore');

    const searchLower = searchQuery.toLowerCase();
    const results = new Map();

    // Search by usernameLower field (for users who have it)
    try {
      const usernameQuery = query(
        usersRef,
        where("usernameLower", ">=", searchLower),
        where("usernameLower", "<=", searchLower + "\uf8ff"),
        limit(limitCount)
      );

      const usernameResults = await getDocs(usernameQuery);
      usernameResults.forEach(doc => {
        const userData = doc.data();
        results.set(doc.id, {
          id: doc.id,
          username: userData.username || "Anonymous",
          email: userData.email || "",
          photoURL: userData.photoURL || null
        });
      });
    } catch (error) {
      console.warn("Error searching by usernameLower field:", error);
    }

    // Search by email (case insensitive)
    try {
      const emailQuery = query(
        usersRef,
        where("email", ">=", searchLower),
        where("email", "<=", searchLower + "\uf8ff"),
        limit(limitCount)
      );

      const emailResults = await getDocs(emailQuery);
      emailResults.forEach(doc => {
        if (!results.has(doc.id)) {
          const userData = doc.data();
          results.set(doc.id, {
            id: doc.id,
            username: userData.username || "Anonymous",
            email: userData.email || "",
            photoURL: userData.photoURL || null
          });
        }
      });
    } catch (error) {
      console.warn("Error searching by email field:", error);
    }

    // If we have few results, do a broader search by fetching more users and filtering client-side
    // This helps find users who don't have usernameLower field or have indexing issues
    if (results.size < 3) {
      try {
        const broadQuery = query(usersRef, limit(100));
        const broadResults = await getDocs(broadQuery);

        broadResults.forEach(doc => {
          if (!results.has(doc.id)) {
            const userData = doc.data();
            const username = userData.username || "";
            const email = userData.email || "";

            // Client-side filtering for partial matches
            if (username.toLowerCase().includes(searchLower) ||
                email.toLowerCase().includes(searchLower)) {
              results.set(doc.id, {
                id: doc.id,
                username: username || "Anonymous",
                email: email,
                photoURL: userData.photoURL || null
              });
            }
          }
        });
      } catch (error) {
        console.warn("Error in broad search:", error);
      }
    }

    // Sort results by relevance (exact matches first, then partial matches)
    const sortedResults = Array.from(results.values()).sort((a, b) => {
      const aUsernameExact = a.username.toLowerCase() === searchLower;
      const bUsernameExact = b.username.toLowerCase() === searchLower;
      const aEmailExact = a.email.toLowerCase() === searchLower;
      const bEmailExact = b.email.toLowerCase() === searchLower;

      // Exact matches first
      if (aUsernameExact || aEmailExact) return -1;
      if (bUsernameExact || bEmailExact) return 1;

      // Then by username starts with
      const aUsernameStarts = a.username.toLowerCase().startsWith(searchLower);
      const bUsernameStarts = b.username.toLowerCase().startsWith(searchLower);
      if (aUsernameStarts && !bUsernameStarts) return -1;
      if (bUsernameStarts && !aUsernameStarts) return 1;

      // Finally alphabetical
      return a.username.localeCompare(b.username);
    });

    return sortedResults.slice(0, limitCount);
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};

export async function getUserPages(userId, includePrivate = false, currentUserId = null, lastVisible = null, pageSize = 200) {
  return await trackQueryPerformance('getUserPages', async () => {
    try {
      // Check cache first (only for public pages)
      if (!includePrivate && !lastVisible) {
        const cacheKey = generateCacheKey('userPages', userId, 'public');
        const cachedData = getCacheItem(cacheKey);

        if (cachedData) {
          console.log(`Using cached data for user pages (${userId})`);
          return cachedData;
        }
      }

      // Get user's own pages from Firestore with field selection
      const pagesRef = collection(db, "pages");
      let pageQuery;

      // Define the fields we need to reduce data transfer
      // This significantly reduces the amount of data transferred from Firestore
      const requiredFields = ["title", "lastModified", "isPublic", "userId", "groupId", "createdAt"];

      // Build the query with cursor-based pagination
      if (includePrivate && userId === currentUserId) {
        // If viewing own profile and includePrivate is true, get all pages
        pageQuery = query(
          pagesRef,
          where("userId", "==", userId),
          orderBy("lastModified", "desc"),
          select(...requiredFields)
        );
      } else {
        // If viewing someone else's profile, only get public pages
        pageQuery = query(
          pagesRef,
          where("userId", "==", userId),
          where("isPublic", "==", true),
          orderBy("lastModified", "desc"),
          select(...requiredFields)
        );
      }

      // Add pagination
      if (lastVisible) {
        pageQuery = query(pageQuery, startAfter(lastVisible), limit(pageSize));
      } else {
        pageQuery = query(pageQuery, limit(pageSize));
      }

      // Execute the query with field selection
      const pagesSnapshot = await getDocs(pageQuery);
      const pages = [];

      // Store the last document for pagination
      const lastDoc = pagesSnapshot.docs.length > 0 ?
        pagesSnapshot.docs[pagesSnapshot.docs.length - 1] : null;

      pagesSnapshot.forEach((doc) => {
        pages.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Get pages from groups the user is a member of
      const groupsRef = ref(rtdb, 'groups');
      const groupsSnapshot = await get(groupsRef);

      if (groupsSnapshot.exists()) {
        const groups = groupsSnapshot.val();

        // Find groups where user is a member
        const userGroups = Object.entries(groups)
          .filter(([_, groupData]) =>
            groupData.members && groupData.members[userId]
          )
          .map(([groupId, groupData]) => ({
            id: groupId,
            ...groupData
          }));

        // For each group, get all pages using batch operations
        if (userGroups.length > 0) {
          // Collect all group page IDs
          const groupPageIds = [];
          const groupInfoByPageId = {};

          for (const group of userGroups) {
            // Skip private groups if the current user is not a member or owner
            if (!group.isPublic && currentUserId !== userId) {
              if (group.owner !== currentUserId &&
                  (!group.members || !group.members[currentUserId])) {
                continue;
              }
            }

            if (group.pages) {
              // Get page IDs from this group
              const pageIds = Object.keys(group.pages);

              for (const pageId of pageIds) {
                // Check if we already have this page
                if (!pages.some(p => p.id === pageId) && !groupPageIds.includes(pageId)) {
                  groupPageIds.push(pageId);
                  groupInfoByPageId[pageId] = {
                    groupId: group.id,
                    groupName: group.name
                  };
                }
              }
            }
          }

          // Batch fetch pages in chunks of 10 (Firestore limit for 'in' queries)
          const batchSize = 10;
          for (let i = 0; i < groupPageIds.length; i += batchSize) {
            const batch = groupPageIds.slice(i, i + batchSize);

            if (batch.length === 0) continue;

            // Create a query for this batch
            const batchQuery = query(
              collection(db, 'pages'),
              where('__name__', 'in', batch)
            );

            const batchSnapshot = await getDocs(batchQuery);

            batchSnapshot.forEach(doc => {
              const pageData = doc.data();
              const groupInfo = groupInfoByPageId[doc.id];

              pages.push({
                id: doc.id,
                ...pageData,
                // Add group information
                groupId: groupInfo.groupId,
                groupName: groupInfo.groupName
              });
            });
          }
        }
      }

      // Sort all pages by last modified date
      pages.sort((a, b) => {
        const dateA = new Date(a.lastModified || a.createdAt || 0);
        const dateB = new Date(b.lastModified || b.createdAt || 0);
        return dateB - dateA; // Descending order (newest first)
      });

      // Create result object with pagination info
      const result = {
        pages,
        lastVisible: lastDoc,
        hasMore: pages.length === pageSize
      };

      // Cache the result (only for public pages and first page)
      if (!includePrivate && !lastVisible) {
        const cacheKey = generateCacheKey('userPages', userId, 'public');
        setCacheItem(cacheKey, result, 5 * 60 * 1000); // Cache for 5 minutes
      }

      return result;
    } catch (error) {
      console.error("Error getting user pages:", error);
      return { pages: [], lastVisible: null, hasMore: false };
    }
  }, { userId, includePrivate, currentUserId, pageSize });
};
