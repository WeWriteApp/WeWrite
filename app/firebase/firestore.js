// Mock implementation for Firestore
const mockFirestore = {
  _collections: {
    users: {},
    pages: {},
    groups: {}
  },

  collection(name) {
    return {
      doc: (id) => ({
        get: async () => ({
          exists: !!this._collections[name][id],
          data: () => this._collections[name][id],
          id
        }),
        set: async (data) => {
          this._collections[name][id] = { ...data };
        },
        update: async (data) => {
          this._collections[name][id] = {
            ...this._collections[name][id],
            ...data
          };
        },
        delete: async () => {
          delete this._collections[name][id];
        },
        onSnapshot: (callback) => {
          callback({
            exists: !!this._collections[name][id],
            data: () => this._collections[name][id],
            id
          });
          return () => {};
        }
      }),
      where: () => ({
        get: async () => ({
          docs: Object.entries(this._collections[name]).map(([id, data]) => ({
            id,
            data: () => data,
            exists: true
          }))
        }),
        onSnapshot: (callback) => {
          callback({
            docs: Object.entries(this._collections[name]).map(([id, data]) => ({
              id,
              data: () => data,
              exists: true
            }))
          });
          return () => {};
        }
      }),
      onSnapshot: (callback) => {
        callback({
          docs: Object.entries(this._collections[name]).map(([id, data]) => ({
            id,
            data: () => data,
            exists: true
          }))
        });
        return () => {};
      }
    };
  }
};

export const getFirestore = () => mockFirestore;
export const collection = (db, name) => db.collection(name);
export const doc = (collection, id) => collection.doc(id);
export const getDoc = async (docRef) => docRef.get();
export const setDoc = async (docRef, data) => docRef.set(data);
export const updateDoc = async (docRef, data) => docRef.update(data);
export const deleteDoc = async (docRef) => docRef.delete();
export const onSnapshot = (ref, callback) => ref.onSnapshot(callback);
export const query = (collection) => collection;
export const where = () => collection;
