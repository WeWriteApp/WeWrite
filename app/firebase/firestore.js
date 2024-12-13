// Mock Firestore implementation
const mockCollections = {
  users: {
    'mock-user-1': { id: 'mock-user-1', email: 'test@example.com', displayName: 'Test User' },
    'mock-user-2': { id: 'mock-user-2', email: 'other@example.com', displayName: 'Other User' }
  },
  pages: {
    'page-1': { id: 'page-1', title: 'Getting Started', content: 'Welcome to WeWrite', isPublic: true, userId: 'mock-user-1' },
    'page-2': { id: 'page-2', title: 'User Guide', content: 'How to use WeWrite', isPublic: true, userId: 'mock-user-2' },
    'page-3': { id: 'page-3', title: 'Private Notes', content: 'My private notes', isPublic: false, userId: 'mock-user-1' }
  },
  groups: {
    'group-1': { id: 'group-1', name: 'Test Group', members: ['mock-user-1'] }
  }
};

class MockFirestore {
  constructor(app) {
    this.app = app;
    this._collections = mockCollections;
  }

  collection(name) {
    return {
      type: 'collection-ref',
      id: name,
      path: name,
      doc: (id) => this._createDocRef(name, id),
      where: () => this._createQuery(name),
      onSnapshot: (callback) => this._createCollectionSnapshot(name, callback)
    };
  }

  _createDocRef(collectionName, docId) {
    return {
      type: 'document-ref',
      id: docId,
      path: `${collectionName}/${docId}`,
      get: async () => this._createDocSnapshot(collectionName, docId),
      set: async (data) => this._setDoc(collectionName, docId, data),
      update: async (data) => this._updateDoc(collectionName, docId, data),
      delete: async () => this._deleteDoc(collectionName, docId),
      onSnapshot: (callback) => this._createDocSnapshot(collectionName, docId, callback)
    };
  }

  _createQuery(collectionName) {
    return {
      type: 'query',
      get: async () => ({
        docs: Object.entries(this._collections[collectionName]).map(([id, data]) => ({
          id,
          data: () => data,
          exists: true
        }))
      }),
      onSnapshot: (callback) => this._createCollectionSnapshot(collectionName, callback)
    };
  }

  _createDocSnapshot(collectionName, docId) {
    const data = this._collections[collectionName]?.[docId];
    return {
      exists: !!data,
      data: () => data,
      id: docId
    };
  }

  _createCollectionSnapshot(collectionName, callback) {
    const docs = Object.entries(this._collections[collectionName]).map(([id, data]) => ({
      id,
      data: () => data,
      exists: true
    }));
    callback({ docs });
    return () => {}; // Unsubscribe function
  }

  _setDoc(collectionName, docId, data) {
    this._collections[collectionName][docId] = { ...data, id: docId };
  }

  _updateDoc(collectionName, docId, data) {
    this._collections[collectionName][docId] = {
      ...this._collections[collectionName][docId],
      ...data
    };
  }

  _deleteDoc(collectionName, docId) {
    delete this._collections[collectionName][docId];
  }
}

export const getFirestore = (app) => new MockFirestore(app);
export const collection = (db, name) => db.collection(name);
export const doc = (collectionRef, id) => collectionRef.doc(id);
export const getDoc = async (docRef) => docRef.get();
export const setDoc = async (docRef, data) => docRef.set(data);
export const updateDoc = async (docRef, data) => docRef.update(data);
export const deleteDoc = async (docRef) => docRef.delete();
export const onSnapshot = (ref, callback) => {
  if (ref.type === 'collection-ref') {
    return ref.onSnapshot(callback);
  } else if (ref.type === 'document-ref') {
    return ref.onSnapshot(callback);
  }
  return () => {};
};
export const query = (collectionRef) => collectionRef;
export const where = () => ({
  type: 'query-mock'
});
