import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const mockConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'mock-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'mock-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mock-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mock-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://mock-project-default-rtdb.firebaseio.com'
};

let app;
let db;
let rtdb;

try {
  app = getApps().length ? getApp() : initializeApp(mockConfig);
  db = getFirestore(app);
  rtdb = getDatabase(app);

  // Only use mock provider in development
  if (process.env.NODE_ENV === 'development') {
    const mockData = {
      users: new Map([
        ['test-user', {
          uid: 'test-user',
          username: 'Test User',
          email: 'test@example.com',
          createdAt: new Date().toISOString()
        }]
      ])
    };

    // Mock Firestore
    const mockFirestore = {
      _checkNotDeleted: () => true,
      collection: () => ({
        doc: () => ({
          get: () => Promise.resolve({ exists: () => false, data: () => null }),
          set: () => Promise.resolve(),
          update: () => Promise.resolve(),
          delete: () => Promise.resolve()
        }),
        add: () => Promise.resolve({ id: `mock-${Date.now()}` })
      })
    };

    // Mock Realtime Database
    const createMockRef = (path) => {
      const [collection, id] = path?.split('/') || [];
      const mockRef = {
        _checkNotDeleted: () => true,
        _path: path,
        val: () => mockData[collection]?.get(id) || null,
        once: () => Promise.resolve({
          val: () => mockData[collection]?.get(id) || null,
          exists: () => mockData[collection]?.has(id) || false,
          key: id,
          ref: mockRef
        }),
        get: () => Promise.resolve({
          val: () => mockData[collection]?.get(id) || null,
          exists: () => mockData[collection]?.has(id) || false,
          key: id,
          ref: mockRef
        }),
        onValue: (callback) => {
          callback({
            val: () => mockData[collection]?.get(id) || null,
            exists: () => mockData[collection]?.has(id) || false,
            key: id,
            ref: mockRef
          });
          return () => {};
        },
        off: () => {},
        set: (data) => {
          if (!mockData[collection]) mockData[collection] = new Map();
          mockData[collection].set(id, data);
          return Promise.resolve();
        },
        update: (data) => {
          if (!mockData[collection]) mockData[collection] = new Map();
          const existing = mockData[collection].get(id) || {};
          mockData[collection].set(id, { ...existing, ...data });
          return Promise.resolve();
        },
        remove: () => {
          mockData[collection]?.delete(id);
          return Promise.resolve();
        }
      };
      return mockRef;
    };

    const mockRtdb = {
      _checkNotDeleted: () => true,
      ref: createMockRef,
      refFromURL: createMockRef
    };

    // Override database instances
    db = mockFirestore;
    rtdb = mockRtdb;
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  if (process.env.NODE_ENV === 'development') {
    console.warn('Attempting to initialize with mock config in development');
    app = initializeApp(mockConfig);
    db = getFirestore(app);
    rtdb = getDatabase(app);
  } else {
    throw error;
  }
}

export { app };
export { db };
export { rtdb as database };
export default app;
