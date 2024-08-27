import { 
  getFirestore,
  addDoc,
  collection,
  doc,
  setDoc,
  getDoc,
  where,
  query,
  getDocs,
  deleteDoc
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
      createdAt: new Date().toISOString()
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

export const getPageById = async (pageId) => {
  // should get the page and versions
  try {
    const pageRef = doc(db, "pages", pageId);
    const pageSnap = await getDoc(pageRef);
    const pageData = {
      id: pageSnap.id,
      ...pageSnap.data()
    }
    // get the current version
    const currentVersionId = pageData.currentVersion;
    const versionRef = doc(db, "pages", pageId, "versions", currentVersionId);
    const versionSnap = await getDoc(versionRef);
    const versionData = versionSnap.data();

    // if the version data is null, remove the page
    if (versionData.content === "null") {
      await deleteDoc(pageRef);
      return null;
    } else if (JSON.parse(versionData.content).history) {
      console.log('history exists');

      // Migrate to existing data model without
      let content = JSON.parse(versionData.content).children;
      let json = JSON.stringify(content);

      // Update the version with the new content
      await setDoc(versionRef, { content: json }, { merge: true });
    } else {
      console.log('history does not exist');
    }

    // get links
    const links = extractLinksFromNodes(JSON.parse(versionData.content));
    return { pageData, versionData, links };
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

