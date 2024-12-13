import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  addDoc,
} from "../firebase/firestore";

import app from "./config";

export const db = getFirestore(app);

export const createDoc = async (collectionName, data) => {
  try {
    const docRef = await addDoc(collection(db, collectionName), data);
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

    const version = await addDoc(collection(pageRef, "versions"), versionData);
    await setDoc(pageRef, { currentVersion: version.id }, { merge: true });

    return pageRef.id;
  } catch (e) {
    console.log('error', e);
    return e;
  }
}

export const listenToPageById = (pageId, onPageUpdate) => {
  try {
    const pageRef = doc(db, "pages", pageId);
    let unsubscribeVersion = null;

    const unsubscribePage = onSnapshot(pageRef, { includeMetadataChanges: true }, async (pageSnap) => {
      if (pageSnap.exists()) {
        const pageData = {
          id: pageId,
          ...pageSnap.data()
        };

        const currentVersionId = pageData.currentVersion;
        const versionCollectionRef = collection(db, "pages", pageId, "versions");
        const versionRef = doc(versionCollectionRef, currentVersionId);

        if (unsubscribeVersion) {
          unsubscribeVersion();
        }

        unsubscribeVersion = onSnapshot(versionRef, { includeMetadataChanges: true }, async (versionSnap) => {
          if (versionSnap.exists()) {
            const versionData = versionSnap.data();
            const links = extractLinksFromNodes(JSON.parse(versionData.content));
            onPageUpdate({ pageData, versionData, links });
          }
        });
      } else {
        onPageUpdate(null);
      }
    });

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
    const pageSnap = await getDoc(pageRef, { source: 'cache' });
    const pageData = {
      id: pageId,
      ...pageSnap.data()
    }
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
  try {
    const pageRef = doc(db, "pages", pageId);
    const versionsRef = collection(pageRef, "versions");
    const versionsSnap = await getDocs(versionsRef);

    versionsSnap.forEach(async (doc) => {
      await deleteDoc(doc.ref);
    });

    await deleteDoc(pageRef);

    return true;
  } catch (e) {
    console.log(e);
    return e;
  }
}

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
    if (node.type === 'link' && node.url) {
      links.push(node.url);
    }

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }

  nodes.forEach(traverse);

  return links;
}
