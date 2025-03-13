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

// Initialize Firebase
const apps = getApps();
const firebase_app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];

if (!firebase_app) {
  throw new Error('Firebase initialization failed');
}

// Initialize services
const rtdb = getDatabase(firebase_app);
const db = getFirestore(firebase_app);
const auth = getAuth(firebase_app);

if (!auth || !db || !rtdb) {
  throw new Error('Firebase services initialization failed');
}

// Export everything
export { firebase_app, rtdb, db, auth }; 