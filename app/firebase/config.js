import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "./firestore";

// Firebase configuration must be provided through environment variables
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Validate required configuration
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_DATABASE_URL'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Initialize Firebase app
let app;
try {
  app = getApps().length ? getApp() : initializeApp(config);
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error; // Don't fallback to mock in production
}

// Only set up mock providers in development
const providers = new Map();

if (process.env.NODE_ENV === 'development') {
  // Mock data for development
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

  // Set up mock database provider for development
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
}

// Only allow getProvider in development
app.getProvider = (name) => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('getProvider is only available in development mode');
  }
  return providers.get(name) || {
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
