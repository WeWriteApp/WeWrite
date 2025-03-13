'use client';

import { useState, useEffect } from 'react';
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

export function useFirebase() {
  const [firebase, setFirebase] = useState({
    app: null,
    db: null,
    rtdb: null,
    auth: null,
    error: null,
    initialized: false
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const apps = getApps();
      const app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];

      if (app) {
        const rtdb = getDatabase(app);
        const db = getFirestore(app);
        const auth = getAuth(app);

        setFirebase({
          app,
          db,
          rtdb,
          auth,
          error: null,
          initialized: true
        });

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
      setFirebase(prev => ({
        ...prev,
        error,
        initialized: true
      }));
    }
  }, []);

  return firebase;
} 