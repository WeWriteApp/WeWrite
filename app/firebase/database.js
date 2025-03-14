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
} from "firebase/firestore";

import app from "./config";

export const db = getFirestore(app);

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
    const pageData = {
      title: data.title,
      isPublic: data.isPublic,
      userId: data.userId,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    const pageRef = await addDoc(collection(db, "pages"), pageData);
    const versionData = {
      content: data.content,
      createdAt: new Date().toISOString(),
      userId: data.userId
    };

    // create a subcollection for versions
    const version = await addDoc(collection(pageRef, "versions"), versionData);
    
    // take the version id and add it as the currentVersion on the page
    await setDoc(pageRef, { currentVersion: version.id }, { merge: true });

    return pageRef.id;

  } catch (e) {
    console.log('error', e);
    return e;
  }
}

export const listenToPageById = (pageId, onPageUpdate) => {
  try {
    // Reference to the page document
    const pageRef = doc(db, "pages", pageId);

    // Declare unsubscribeVersion outside of the inner onSnapshot callback
    let unsubscribeVersion = null;

    // Listener for the page document
    const unsubscribePage = onSnapshot(pageRef, { includeMetadataChanges: true }, async (pageSnap) => {
      if (pageSnap.exists()) {
        const pageData = {
          id: pageId,
          ...pageSnap.data()
        };


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
      } else {
        // If page document doesn't exist
        onPageUpdate(null);
      }
    });

    // Return the unsubscribe functions for cleanup
    return () => {
      unsubscribePage();
      if (unsubscribeVersion) {
        unsubscribeVersion();
      }
    };
  } catch (e) {
    console.error("Error in listenToPageById:", e);
    return e;
  }
};

export const getPageById = async (pageId) => {
  try {
    const pageRef = doc(db, "pages", pageId);
    const pageSnap = await getDoc(pageRef);
    
    if (!pageSnap.exists()) {
      console.error('Page not found:', pageId);
      return { pageData: null, versionData: null };
    }

    const pageData = {
      id: pageId,
      ...pageSnap.data()
    };

    console.log('Raw page data from Firestore:', JSON.stringify(pageData, null, 2));

    // Get the current version
    const currentVersionId = pageData.currentVersion;
    if (!currentVersionId) {
      console.error('No current version found for page:', pageId);
      return { pageData, versionData: null };
    }

    const versionRef = doc(db, "pages", pageId, "versions", currentVersionId);
    const versionSnap = await getDoc(versionRef);
    const versionData = versionSnap.exists() ? versionSnap.data() : null;

    if (!versionData) {
      console.error('No version data found for version:', currentVersionId);
    } else {
      console.log('Version data found:', JSON.stringify(versionData, null, 2));
    }

    // ALWAYS set a default author object
    pageData.author = { displayName: 'NULL' };

    // Try to get author data if userId exists
    if (pageData.userId) {
      try {
        console.log('Attempting to fetch user data for userId:', pageData.userId);
        const userRef = doc(db, "users", pageData.userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          console.log('Found user data:', JSON.stringify(userData, null, 2));
          
          // Only update author if we actually have a display name
          if (userData.displayName || userData.name) {
            pageData.author.displayName = userData.displayName || userData.name;
          }
        } else {
          console.log('No user document found - using default NULL');
        }
      } catch (userError) {
        console.error('Error fetching user data:', userError);
        // Keep the default NULL author
      }
    } else {
      console.log('No userId in page data - using default NULL');
    }

    console.log('Final page data with author:', JSON.stringify(pageData, null, 2));
    console.log('Final version data:', JSON.stringify(versionData, null, 2));

    return { pageData, versionData };
  } catch (e) {
    console.error('Error in getPageById:', e);
    return { pageData: null, versionData: null };
  }
}

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
    // return the doc data
    return docSnap;
  } catch (e) {
    return e;
  }
}

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
