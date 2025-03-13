'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

const FirebaseContext = createContext({
  app: null,
  db: null,
  rtdb: null,
  auth: null,
  initialized: false,
  error: null
});

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function FirebaseProvider({ children }) {
  const [state, setState] = useState({
    app: null,
    db: null,
    rtdb: null,
    auth: null,
    initialized: false,
    error: null
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

        setState({
          app,
          db,
          rtdb,
          auth,
          initialized: true,
          error: null
        });

        if (process.env.NODE_ENV !== 'production') {
          console.log('Firebase initialized successfully');
        }
      }
    } catch (error) {
      console.error('Firebase initialization error:', error);
      setState(prev => ({
        ...prev,
        error,
        initialized: true
      }));
    }
  }, []);

  return (
    <FirebaseContext.Provider value={state}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
} 