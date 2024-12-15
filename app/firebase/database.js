import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, addDoc, getFirestore } from 'firebase/firestore';
import app from './config';

export const db = getFirestore(app);

// Mock store for development
const mockStore = {
  pages: new Map(),
  getNextId: () => `mock-${Date.now()}`
};

// Initialize test data if in development
if (process.env.NODE_ENV === 'development') {
  // Test Page One
  const pageOneId = '1';
  const versionOneId = 'v1';
  const pageOneContent = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            text: 'This is Test Page One. It will be linked to from another page to test the linking functionality.'
          }
        ]
      }
    ]
  };

  mockStore.pages.set(pageOneId, {
    id: pageOneId,
    title: 'Test Page One',
    content: JSON.stringify(pageOneContent),
    isPublic: true,
    userId: 'test-user',
    groupId: 'test-group',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    currentVersion: versionOneId,
    versions: new Map([[versionOneId, {
      id: versionOneId,
      content: JSON.stringify(pageOneContent),
      createdAt: new Date().toISOString(),
      userId: 'test-user'
    }]])
  });

  // Test Page Two
  const pageTwoId = '2';
  const versionTwoId = 'v1';
  const pageTwoContent = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            text: 'This is Test Page Two. Here is a link to '
          },
          {
            type: 'link',
            url: '/pages/1',
            children: [{ text: 'Test Page One' }]
          },
          {
            text: '.'
          }
        ]
      }
    ]
  };

  mockStore.pages.set(pageTwoId, {
    id: pageTwoId,
    title: 'Test Page Two',
    content: JSON.stringify(pageTwoContent),
    isPublic: false,
    userId: 'test-user',
    groupId: 'test-group',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    currentVersion: versionTwoId,
    versions: new Map([[versionTwoId, {
      id: versionTwoId,
      content: JSON.stringify(pageTwoContent),
      createdAt: new Date().toISOString(),
      userId: 'test-user'
    }]])
  });
}

export const createDoc = async (collectionName, data) => {
  try {
    const docId = mockStore.getNextId();
    mockStore[collectionName] = mockStore[collectionName] || new Map();
    mockStore[collectionName].set(docId, { id: docId, ...data });
    return docId;
  } catch (e) {
    return e;
  }
}

export const createPage = async (data) => {
  try {
    const pageId = mockStore.getNextId();
    const pageData = {
      id: pageId,
      title: data.title,
      isPublic: data.isPublic,
      userId: data.userId,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    // Create versions subcollection for the page
    const versionId = mockStore.getNextId();
    const versionData = {
      id: versionId,
      content: data.content,
      createdAt: new Date().toISOString(),
      userId: data.userId
    };

    // Store page with its versions
    mockStore.pages.set(pageId, {
      ...pageData,
      currentVersion: versionId,
      versions: new Map([[versionId, versionData]])
    });

    return pageId;
  } catch (e) {
    console.log('error', e);
    return null;
  }
}

export const listenToPageById = (pageId, onPageUpdate) => {
  try {
    const page = mockStore.pages.get(pageId);
    if (!page) {
      console.log('Page not found:', pageId);
      onPageUpdate(null);
      return () => {};
    }

    console.log('Found page:', page);
    const { versions, currentVersion, ...pageData } = page;
    const versionData = versions.get(currentVersion);

    if (!versionData) {
      console.log('Version not found:', currentVersion);
      onPageUpdate(null);
      return () => {};
    }

    console.log('Found version:', versionData);
    onPageUpdate({ pageData, versionData });

    // Return unsubscribe function
    return () => {};
  } catch (e) {
    console.error("Error in listenToPageById:", e);
    return () => {};
  }
};

export const getPageById = async (pageId) => {
  if (process.env.NODE_ENV === 'development') {
    try {
      const page = mockStore.pages.get(pageId);
      if (!page) {
        return { pageData: null };
      }
      const { versions, currentVersion, ...pageData } = page;
      return { pageData };
    } catch (e) {
      console.log('Error in mock getPageById:', e);
      return { pageData: null };
    }
  }

  try {
    const pageRef = doc(db, "pages", pageId);
    const pageSnap = await getDoc(pageRef);
    if (!pageSnap.exists()) {
      return { pageData: null };
    }
    const pageData = {
      id: pageId,
      ...pageSnap.data()
    };
    return { pageData };
  } catch (e) {
    console.log('Error in getPageById:', e);
    return { pageData: null };
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

// Export getPages function for page linking functionality
export const getPages = async () => {
  if (process.env.NODE_ENV === 'development') {
    try {
      // Convert mock store pages Map to array
      const pages = Array.from(mockStore.pages.values()).map(page => ({
        id: page.id,
        title: page.title,
        isPublic: page.isPublic,
        userId: page.userId,
        groupId: page.groupId,
        createdAt: page.createdAt,
        lastModified: page.lastModified
      }));
      console.log('Fetched pages from mock store:', pages);
      return pages;
    } catch (e) {
      console.error('Error getting pages from mock store:', e);
      return [];
    }
  }

  try {
    const pagesRef = collection(db, "pages");
    const pagesSnap = await getDocs(pagesRef);
    const pages = pagesSnap.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title,
      isPublic: doc.data().isPublic,
      userId: doc.data().userId,
      groupId: doc.data().groupId,
      createdAt: doc.data().createdAt,
      lastModified: doc.data().lastModified
    }));
    return pages;
  } catch (e) {
    console.error('Error getting pages:', e);
    return [];
  }
};
