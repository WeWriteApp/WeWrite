'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let firebase_app;
let db = null;
let rtdb = null;
let auth = null;

// Only initialize Firebase on the client side
if (typeof window !== 'undefined') {
  try {
    const apps = getApps();
    firebase_app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];

    if (firebase_app) {
      // Initialize services
      rtdb = getDatabase(firebase_app);
      db = getFirestore(firebase_app);
      auth = getAuth(firebase_app);

      // Add debug logging for environment variables in development
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
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    // Reset variables on error
    firebase_app = null;
    db = null;
    rtdb = null;
    auth = null;
  }
}

export { firebase_app, rtdb, db, auth }; 