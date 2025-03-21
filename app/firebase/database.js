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
  where
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
      // Add fundraising fields
      totalPledged: 0,
      pledgeCount: 0,
      fundraisingEnabled: true,
      fundraisingGoal: data.fundraisingGoal || 0,
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
  // should get the page and versions
  try {
    const pageRef = doc(db, "pages", pageId);
    const pageSnap = await getDoc(pageRef, { source: 'cache' });
    const pageData = {
      id: pageId,
      ...pageSnap.data()
    }
    // // get the current version
    // const currentVersionId = pageData.currentVersion;
    // const versionRef = doc(db, "pages", pageId, "versions", currentVersionId);
    // const versionSnap = await getDoc(versionRef, { source: 'cache' });
    // const versionData = versionSnap.data();

    // // get links
    // const links = extractLinksFromNodes(JSON.parse(versionData.content));
    return { pageData };
  } catch (e) {
    console.log(e);
    return e;
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
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      return userData.username || null;
    }
    return null;
  } catch (error) {
    console.error("Error getting username by email:", error);
    return null;
  }
};

// Get page statistics including active donors, monthly income, and total views
export const getPageStats = async (pageId) => {
  try {
    // Get the page document
    const pageDoc = await getPageById(pageId);
    
    if (!pageDoc || !pageDoc.pageData) {
      return null;
    }
    
    // Get pledges for this page to calculate active donors and monthly income
    const pledgesQuery = query(collection(db, "pledges"), where("pageId", "==", pageId));
    const pledgesSnapshot = await getDocs(pledgesQuery);
    
    const activeDonors = pledgesSnapshot.size;
    let monthlyIncome = 0;
    
    pledgesSnapshot.forEach(doc => {
      const pledgeData = doc.data();
      monthlyIncome += pledgeData.amount || 0;
    });
    
    // Get page views (stored in the page document or a related stats document)
    const totalViews = pageDoc.pageData.viewCount || 0;
    
    return {
      activeDonors,
      monthlyIncome,
      totalViews
    };
  } catch (error) {
    console.error("Error getting page stats:", error);
    return {
      activeDonors: 0,
      monthlyIncome: 0,
      totalViews: 0
    };
  }
};
