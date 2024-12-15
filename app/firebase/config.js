import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "./firestore";

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
try {
  app = getApps().length ? getApp() : initializeApp(mockConfig);
} catch (error) {
  console.error('Error initializing Firebase:', error);
  app = initializeApp(mockConfig);
}

const providers = new Map();

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

providers.set('database', {
  initialize: () => {},
  isInitialized: () => true,
  getImmediate: () => ({
    ref: (path) => {
      const [collection, id] = path.split('/');
      return {
        val: () => mockData[collection]?.get(id) || null,
        once: () => Promise.resolve({
          val: () => mockData[collection]?.get(id) || null
        }),
        get: () => Promise.resolve({
          val: () => mockData[collection]?.get(id) || null
        })
      };
    }
  })
});

app.getProvider = (name) => {
  const provider = providers.get(name);
  if (provider) return provider;

  return {
    initialize: () => {},
    isInitialized: () => true,
    getImmediate: () => ({
      collection: () => ({}),
      doc: () => ({}),
      onSnapshot: () => () => {},
      set: () => Promise.resolve(),
      update: () => Promise.resolve(),
      delete: () => Promise.resolve()
    })
  };
};

export { app };
export const db = getFirestore(app);
export default app;
