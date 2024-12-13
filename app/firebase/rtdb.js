// Mock implementation for testing without Firebase
const mockDb = {
  users: {
    'mock-user-1': {
      uid: 'mock-user-1',
      email: 'test@example.com',
      displayName: 'Test User',
      username: 'Test User'
    }
  },
  pages: {
    'page-1': { id: 'page-1', name: 'Getting Started', isPublic: true, userId: 'mock-user-1' },
    'page-2': { id: 'page-2', name: 'User Guide', isPublic: true, userId: 'mock-user-2' },
    'page-3': { id: 'page-3', name: 'Private Notes', isPublic: false, userId: 'mock-user-1' },
    'page-4': { id: 'page-4', name: 'Project Ideas', isPublic: false, userId: 'mock-user-1' }
  },
  groups: {}
};

// Mock Firebase Database Reference
class MockDatabaseRef {
  constructor(path) {
    this.path = path;
    this._checkNotDeleted = () => true;
  }

  val() {
    return this.getData();
  }

  getData() {
    const pathParts = this.path.split('/');
    let current = mockDb;
    for (const part of pathParts) {
      if (part && current) {
        current = current[part];
      }
    }
    return current;
  }
}

// Mock Firebase Database
class MockDatabase {
  ref(path) {
    return new MockDatabaseRef(path);
  }
}

// Export mock database instance
export const rtdb = new MockDatabase();

// Mock database operations using the new classes
export const ref = (db, path) => db.ref(path);

export const onValue = (ref, callback) => {
  callback(ref);
  return () => {};
};

export const add = async (path, data) => {
  const pathParts = path.split('/');
  const collection = pathParts[0];
  const id = `${collection}-${Date.now()}`;
  mockDb[collection] = mockDb[collection] || {};
  mockDb[collection][id] = { id, ...data };
  return { key: id };
};

export const updateData = async (path, data) => {
  const pathParts = path.split('/');
  const collection = pathParts[0];
  const id = pathParts[1];
  if (mockDb[collection] && mockDb[collection][id]) {
    mockDb[collection][id] = { ...mockDb[collection][id], ...data };
  }
};

export const getDoc = async (path) => {
  const pathParts = path.split('/');
  const collection = pathParts[0];
  const id = pathParts[1];
  return mockDb[collection]?.[id] || null;
};

export const setDoc = async (path, data) => {
  const pathParts = path.split('/');
  const collection = pathParts[0];
  const id = pathParts[1];
  if (data === null) {
    delete mockDb[collection]?.[id];
  } else {
    mockDb[collection] = mockDb[collection] || {};
    mockDb[collection][id] = data;
  }
};

export const removeDoc = async (path) => {
  await setDoc(path, null);
};

export const fetchGroupFromFirebase = async (groupId) => {
  try {
    const group = await getDoc(`groups/${groupId}`);
    return group ? { id: groupId, ...group } : null;
  } catch (error) {
    console.error("Error fetching group from mock database", error);
    return null;
  }
};

export const fetchProfileFromFirebase = async (userId) => {
  try {
    const profile = await getDoc(`users/${userId}`);
    return profile ? { uid: userId, ...profile } : null;
  } catch (error) {
    console.error("Error fetching profile from mock database", error);
    return null;
  }
};
