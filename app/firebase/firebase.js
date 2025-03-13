import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Add debug logging for environment variables
if (process.env.NODE_ENV !== 'production') {
  console.log('Firebase Config:', {
    apiKey: firebaseConfig.apiKey ? '✓' : '✗',
    authDomain: firebaseConfig.authDomain ? '✓' : '✗',
    databaseURL: firebaseConfig.databaseURL ? '✓' : '✗',
    projectId: firebaseConfig.projectId ? '✓' : '✗',
    storageBucket: firebaseConfig.storageBucket ? '✓' : '✗',
    messagingSenderId: firebaseConfig.messagingSenderId ? '✓' : '✗',
    appId: firebaseConfig.appId ? '✓' : '✗',
  });
}

// Initialize Firebase - with singleton pattern
let firebase_app;
let db;
let rtdb;
let auth;

// Only initialize Firebase if we're in the browser or if all required config is present
const isBrowser = typeof window !== 'undefined';
const hasRequiredConfig = firebaseConfig.projectId && firebaseConfig.apiKey;

if (isBrowser || hasRequiredConfig) {
  try {
    const apps = getApps();
    firebase_app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];

    if (!firebase_app) {
      throw new Error('Firebase initialization failed');
    }

    // Initialize services
    rtdb = getDatabase(firebase_app);
    db = getFirestore(firebase_app);
    auth = getAuth(firebase_app);

    if (!auth || !db || !rtdb) {
      throw new Error('Firebase services initialization failed');
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    // During build, we'll just set these to null instead of throwing
    if (!isBrowser) {
      firebase_app = null;
      db = null;
      rtdb = null;
      auth = null;
    } else {
      throw error;
    }
  }
} else {
  // During build time, set these to null
  firebase_app = null;
  db = null;
  rtdb = null;
  auth = null;
}

// Export everything
export { firebase_app, rtdb, db, auth }; 