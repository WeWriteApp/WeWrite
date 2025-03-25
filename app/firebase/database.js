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
    // Validate required fields to prevent empty path errors
    if (!data || !data.userId) {
      console.error("Cannot create page: Missing required user ID");
      return null;
    }

    const pageData = {
      title: data.title || "Untitled",
      isPublic: data.isPublic !== undefined ? data.isPublic : true,
      userId: data.userId,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      // Add fundraising fields
      totalPledged: 0,
      pledgeCount: 0,
      fundraisingEnabled: true,
      fundraisingGoal: data.fundraisingGoal || 0,
    };

    const pageRef = await addDoc(collection(db, "pages"), pageData);
    
    // Ensure we have content before creating a version
    const versionData = {
      content: data.content || JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]),
      createdAt: new Date().toISOString(),
      userId: data.userId
    };

    // create a subcollection for versions
    const version = await addDoc(collection(db, "pages", pageRef.id, "versions"), versionData);
    
    // take the version id and add it as the currentVersion on the page
    await setDoc(doc(db, "pages", pageRef.id), { currentVersion: version.id }, { merge: true });

    return pageRef.id;

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

        // Log the version subcollection path
        const versionCollectionRef = collection(db, "pages", pageId, "versions");
        const versionRef = doc(versionCollectionRef, currentVersionId);

        // If there's an existing unsubscribeVersion listener, remove it before setting a new one
        if (unsubscribeVersion) {
          unsubscribeVersion();
        }

        // Listener for the version document
        unsubscribeVersion = onSnapshot(versionRef,{ includeMetadataChanges: true }, async (versionSnap) => {
          if (versionSnap.exists()) {
            const versionData = versionSnap.data();

            // Extract links
            const links = extractLinksFromNodes(JSON.parse(versionData.content));

            // Send updated page and version data
            onPageUpdate({ pageData, versionData, links });
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

export const saveNewVersion = async (pageId, data) => {
  try {
    const pageRef = doc(db, "pages", pageId);
    const versionData = {
      content: data.content,
      createdAt: new Date().toISOString(),
      userId: data.userId
    };

    const versionRef = await addDoc(collection(pageRef, "versions"), versionData);
    
    // set the new version as the current version
    await setCurrentVersion(pageId, versionRef.id);

    return versionRef.id;
  } catch (e) {
    return e;
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
    const { doc, getDoc, collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
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
