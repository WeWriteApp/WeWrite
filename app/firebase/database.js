import {
  getFirestore,
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
  limit
} from "firebase/firestore";

import { app } from "./config";
import { rtdb } from "./rtdb";
import { get, ref } from "firebase/database";

export const db = getFirestore(app);

// Utility function to check if a user has access to a page
export const checkPageAccess = async (pageData, userId) => {
  // If page doesn't exist, no one has access
  if (!pageData) {
    return {
      hasAccess: false,
      error: "Page not found"
    };
  }

  // Public pages are accessible to everyone
  if (pageData.isPublic) {
    return {
      hasAccess: true
    };
  }

  // Private pages are accessible to their owners
  if (userId && pageData.userId === userId) {
    return {
      hasAccess: true
    };
  }

  // Check if the page belongs to a group and if the user is a member of that group
  if (userId && pageData.groupId) {
    try {
      const groupRef = ref(rtdb, `groups/${pageData.groupId}`);
      const groupSnapshot = await get(groupRef);

      if (groupSnapshot.exists()) {
        const groupData = groupSnapshot.val();

        // Check if the user is a member of the group
        if (groupData.members && groupData.members[userId]) {
          return {
            hasAccess: true
          };
        }
      }
    } catch (error) {
      console.error("Error checking group membership:", error);
    }
  }

  // Otherwise, access is denied
  return {
    hasAccess: false,
    error: "Access denied: This page is private and can only be viewed by its owner or group members"
  };
};

export const createDoc = async (collectionName, data) => {
  try {
    const docRef = await addDoc(collection(db, collectionName), data);
    // return the id of the newly created doc
    return docRef.id;

  } catch (e) {
    return e;
  }
}

export const createPage = async (data) => {
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
              username = userDoc.data().username;
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
        username: username || "Anonymous" // Also store username in version data for consistency
      };

      try {
        // create a subcollection for versions
        const version = await addDoc(collection(db, "pages", pageRef.id, "versions"), versionData);
        console.log("Created version with ID:", version.id);

        // take the version id and add it as the currentVersion on the page
        await setDoc(doc(db, "pages", pageRef.id), { currentVersion: version.id }, { merge: true });
        console.log("Updated page with current version ID");

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

export const listenToPageById = (pageId, onPageUpdate, userId = null) => {
  // Validate pageId
  if (!pageId) {
    console.error("listenToPageById called with empty pageId");
    onPageUpdate({ error: "Invalid page ID" });
    return () => {};
  }

  // Get reference to the page document
  const pageRef = doc(db, "pages", pageId);

  // Variables to store unsubscribe functions
  let unsubscribeVersion = null;

  // Listen for changes to the page document
  const unsubscribe = onSnapshot(pageRef, async (docSnap) => {
    if (docSnap.exists()) {
      const pageData = { id: docSnap.id, ...docSnap.data() };
      console.log("Page document updated:", { id: pageData.id, title: pageData.title });

      // Check access permissions (now async)
      try {
        const accessCheck = await checkPageAccess(pageData, userId);
        if (!accessCheck.hasAccess) {
          console.error(`Access denied to page ${pageId} for user ${userId || 'anonymous'}`);
          onPageUpdate({ error: accessCheck.error });
          return;
        }

        // Get the current version ID
        const currentVersionId = pageData.currentVersion;

        // Check if the page has content directly (from a save operation)
        if (pageData.content) {
          try {
            // Create a version data object from the page content
            const versionData = {
              content: pageData.content,
              createdAt: pageData.lastModified || new Date().toISOString(),
              userId: pageData.userId || 'unknown'
            };

            // Extract links
            const links = extractLinksFromNodes(JSON.parse(versionData.content));

            // Send updated page and version data immediately
            console.log("Using content directly from page document");
            onPageUpdate({ pageData, versionData, links });
            return; // Skip version listener since we already have the content
          } catch (error) {
            console.error("Error parsing page content:", error);
            // Continue to fetch from version document as fallback
          }
        }

        // If we don't have content in the page document or parsing failed, get it from the version
        const versionCollectionRef = collection(db, "pages", pageId, "versions");
        const versionRef = doc(versionCollectionRef, currentVersionId);

        // If there's an existing unsubscribeVersion listener, remove it before setting a new one
        if (unsubscribeVersion) {
          unsubscribeVersion();
        }

        // Listener for the version document
        unsubscribeVersion = onSnapshot(versionRef, { includeMetadataChanges: true }, async (versionSnap) => {
          if (versionSnap.exists()) {
            const versionData = versionSnap.data();
            console.log("Version document updated:", versionSnap.id);

            // Extract links
            const links = extractLinksFromNodes(JSON.parse(versionData.content));

            // Send updated page and version data
            onPageUpdate({ pageData, versionData, links });
          } else {
            console.error("Version document does not exist:", currentVersionId);
          }
        });
      } catch (error) {
        console.error("Error checking page access:", error);
        onPageUpdate({ error: "Error checking page access" });
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

export const getPageById = async (pageId, userId = null) => {
  try {
    // Validate pageId
    if (!pageId) {
      console.error("getPageById called with empty pageId");
      return { pageData: null, error: "Invalid page ID" };
    }

    // Get the page document
    const pageRef = doc(db, "pages", pageId);
    const docSnap = await getDoc(pageRef);

    if (docSnap.exists()) {
      const pageData = { id: docSnap.id, ...docSnap.data() };

      // Check if user has access to this page
      const accessCheck = await checkPageAccess(pageData, userId);
      if (!accessCheck.hasAccess) {
        console.error(`Access denied to page ${pageId} for user ${userId || 'anonymous'}`);
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

          // Extract links
          const links = extractLinksFromNodes(JSON.parse(versionData.content));

          console.log("getPageById: Using content directly from page document");
          return { pageData, versionData, links };
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

        return { pageData, versionData, links };
      } else {
        return { pageData: null, error: "Version not found" };
      }
    } else {
      return { pageData: null, error: "Page not found" };
    }
  } catch (error) {
    console.error("Error fetching page:", error);
    return { pageData: null, error: "Error fetching page" };
  }
};

export const getVersionsByPageId = async (pageId) => {
  try {
    const pageRef = doc(db, "pages", pageId);
    const versionsRef = collection(pageRef, "versions");
    const versionsSnap = await getDocs(versionsRef);

    // add id of each version
    const versions = versionsSnap.docs.map((doc) => {
      return {
        id: doc.id,
        ...doc.data()
      }
    });

    return versions;
  } catch (e) {
    return e;
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

      // Ensure we're using the parsed and re-stringified content for consistency
      contentString = JSON.stringify(parsedContent);
    } catch (error) {
      console.error("Error parsing content:", error);
      return null;
    }

    const pageRef = doc(db, "pages", pageId);

    // If skipIfUnchanged is true, check if content has changed from the most recent version
    if (data.skipIfUnchanged) {
      try {
        // Get the current version
        const pageDoc = await getDoc(pageRef);
        if (pageDoc.exists()) {
          const pageData = pageDoc.data();
          const currentVersionId = pageData.currentVersion;

          if (currentVersionId) {
            // Get the current version content
            const versionRef = doc(collection(pageRef, "versions"), currentVersionId);
            const versionDoc = await getDoc(versionRef);

            if (versionDoc.exists()) {
              const versionData = versionDoc.data();
              const currentContent = versionData.content;

              // Compare content
              if (currentContent === contentString) {
                console.log("Content unchanged, skipping version creation");
                return currentVersionId; // Return existing version ID
              }
            }
          }
        }
      } catch (error) {
        console.error("Error checking for content changes:", error);
        // Continue with version creation if check fails
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

    const versionData = {
      content: contentString,
      createdAt: new Date().toISOString(),
      userId: data.userId,
      username: username || "Anonymous"
    };

    // First update the page document directly to ensure content is immediately available
    // Use the pageRef directly instead of collection/doc name strings
    const updateTime = new Date().toISOString();
    await setDoc(pageRef, {
      content: contentString,
      lastModified: updateTime
    }, { merge: true });

    console.log("Page document updated with new content");

    // Then create the version
    const versionRef = await addDoc(collection(pageRef, "versions"), versionData);
    console.log("Version created with ID:", versionRef.id);

    // Set the new version as the current version
    await setCurrentVersion(pageId, versionRef.id);

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
    await setDoc(pageRef, { currentVersion: versionId }, { merge: true });
    return true;
  } catch (e) {
    return e;
  }
}

export const setDocData = async (collectionName, docName, data) => {
  try {
    const docRef = await setDoc(doc(db, collectionName, docName), data);
    return docRef;
  } catch (e) {
    return e;
  }
}

export const getDocById = async (collectionName, docId) => {
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

export const getCollection = async (collectionName) => {
  try {
    const collectionRef = collection(db, collectionName);
    const collectionSnap = await getDocs(collectionRef);
    return collectionSnap;
  } catch (e) {
    return e;
  }
}

export const updateDoc = async (collectionName, docName, data) => {
  try {
    const docRef = doc(db, collectionName, docName);
    await setDoc(docRef, data, { merge: true });
    return docRef;
  } catch (e) {
    return e;
  }
}

export const removeDoc = async (collectionName, docName) => {
  try {
    await deleteDoc(doc(db, collectionName, docName));
    return true;
  } catch (e) {
    return e;
  }
}

export const deletePage = async (pageId) => {
  // remove page and the versions subcollection
  try {
    const pageRef = doc(db, "pages", pageId);
    const versionsRef = collection(pageRef, "versions");
    const versionsSnap = await getDocs(versionsRef);

    // delete all versions
    versionsSnap.forEach(async (doc) => {
      await deleteDoc(doc.ref);
    });

    // delete the page
    await deleteDoc(pageRef);

    return true;
  } catch (e) {
    console.log(e);
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

function extractLinksFromNodes(nodes) {
  let links = [];

  function traverse(node) {
    // Check if the node is a link
    if (node.type === 'link' && node.url) {
      links.push(node.url);
    }

    // Recursively check children if they exist
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }

  // Start traversal
  nodes.forEach(traverse);

  return links;
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
    const { doc, getDoc } = await import('firebase/firestore');
    const pageRef = doc(db, 'pages', pageId);
    const pageSnapshot = await getDoc(pageRef);

    if (!pageSnapshot.exists()) {
      return null;
    }

    const pageData = {
      id: pageSnapshot.id,
      ...pageSnapshot.data()
    };

    // If we have a currentVersion, fetch it to get the content for OG image
    if (pageData.currentVersion) {
      try {
        const versionsRef = collection(db, 'pages', pageId, 'versions');
        const versionDoc = doc(versionsRef, pageData.currentVersion);
        const versionSnapshot = await getDoc(versionDoc);

        if (versionSnapshot.exists()) {
          pageData.content = versionSnapshot.data().content;
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
const pageTitleCache = new Map();

export async function getCachedPageTitle(pageId) {
  // Check if title is in cache
  if (pageTitleCache.has(pageId)) {
    return pageTitleCache.get(pageId);
  }

  try {
    const metadata = await getPageMetadata(pageId);
    const title = metadata?.title || 'Untitled';

    // Cache the title
    pageTitleCache.set(pageId, title);

    return title;
  } catch (error) {
    console.error('Error fetching page title:', error);
    return 'Untitled';
  }
}

// Function to prefetch and cache multiple page titles at once
export async function prefetchPageTitles(pageIds) {
  if (!pageIds || pageIds.length === 0) return;

  try {
    const { getDocs, query, collection, where } = await import('firebase/firestore');

    // Filter out IDs that are already cached
    const uncachedIds = pageIds.filter(id => !pageTitleCache.has(id));

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

      // Cache each page title
      querySnapshot.forEach(doc => {
        const data = doc.data();
        pageTitleCache.set(doc.id, data.title || 'Untitled');
      });
    }
  } catch (error) {
    console.error('Error prefetching page titles:', error);
  }
}

// Append a reference to a page at the end of another page's content
export const appendPageReference = async (targetPageId, sourcePageData) => {
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

    // Create a reference paragraph to append
    const referenceNode = {
      type: "paragraph",
      children: [
        { text: "Referenced page: " },
        {
          type: "link",
          href: `/pages/${sourcePageData.id}`,
          displayText: sourcePageData.title,
          children: [{ text: sourcePageData.title }]
        }
      ]
    };

    // Append the reference to the content
    const newContent = [
      ...currentContent,
      { type: "paragraph", children: [{ text: "" }] }, // Empty line for spacing
      referenceNode
    ];

    // Update the page with the new content
    await updatePage(targetPageId, {
      content: JSON.stringify(newContent),
      lastModified: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error("Error appending page reference:", error);
    return false;
  }
};

// Search for users by username or email
export const searchUsers = async (searchQuery, limit = 10) => {
  if (!searchQuery || searchQuery.trim().length < 2) {
    return [];
  }

  try {
    const usersRef = collection(db, "users");

    // Search by username (case insensitive)
    const usernameQuery = query(
      usersRef,
      where("usernameLower", ">=", searchQuery.toLowerCase()),
      where("usernameLower", "<=", searchQuery.toLowerCase() + "\uf8ff"),
      limit(limit)
    );

    // Search by email (case insensitive)
    const emailQuery = query(
      usersRef,
      where("email", ">=", searchQuery.toLowerCase()),
      where("email", "<=", searchQuery.toLowerCase() + "\uf8ff"),
      limit(limit)
    );

    // Execute both queries
    const [usernameResults, emailResults] = await Promise.all([
      getDocs(usernameQuery),
      getDocs(emailQuery)
    ]);

    // Combine and deduplicate results
    const results = new Map();

    usernameResults.forEach(doc => {
      const userData = doc.data();
      results.set(doc.id, {
        id: doc.id,
        username: userData.username || "Anonymous",
        email: userData.email || "",
        photoURL: userData.photoURL || null
      });
    });

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

    return Array.from(results.values());
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};

export async function getUserPages(userId, includePrivate = false, currentUserId = null) {
  try {
    // Get user's own pages from Firestore
    const pagesRef = collection(db, "pages");
    let pageQuery;

    if (includePrivate && userId === currentUserId) {
      // If viewing own profile and includePrivate is true, get all pages
      pageQuery = query(
        pagesRef,
        where("userId", "==", userId),
        orderBy("lastModified", "desc")
      );
    } else {
      // If viewing someone else's profile, only get public pages
      pageQuery = query(
        pagesRef,
        where("userId", "==", userId),
        where("isPublic", "==", true),
        orderBy("lastModified", "desc")
      );
    }

    const pagesSnapshot = await getDocs(pageQuery);
    const pages = [];

    pagesSnapshot.forEach((doc) => {
      pages.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Get pages from groups the user is a member of
    const rtdb = getDatabase();
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
        // Skip private groups if the current user is not a member or owner
        if (!group.isPublic && currentUserId !== userId) {
          // If current user is not the group owner and not a member, skip this group
          if (group.owner !== currentUserId &&
              (!group.members || !group.members[currentUserId])) {
            continue;
          }
        }

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

    return pages;
  } catch (error) {
    console.error("Error getting user pages:", error);
    return [];
  }
};
