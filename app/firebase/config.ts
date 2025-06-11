// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import { getDatabase, type Database } from "firebase/database";

/**
 * Firebase Configuration & Initialization
 *
 * This module handles the initialization of Firebase services including:
 * - Core Firebase App
 * - Authentication
 * - Firestore Database
 * - Firebase Analytics
 * - Realtime Database
 *
 * For analytics specifically, we initialize conditionally based on browser
 * support and add instrumentation to track page titles properly.
 */

// Firebase configuration interface
interface FirebaseConfig {
  apiKey: string | undefined;
  authDomain: string | undefined;
  databaseURL: string | undefined;
  projectId: string | undefined;
  storageBucket: string | undefined;
  messagingSenderId: string | undefined;
  appId: string | undefined;
  measurementId: string | undefined;
}

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
const newConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // Use the GA measurement ID for Firebase Analytics to ensure events go to the same property
  measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};



// Initialize Firebase
export const app: FirebaseApp = initializeApp(newConfig);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Initialize Firestore
export const db: Firestore = getFirestore(app);

// Initialize Realtime Database
export const rtdb: Database = getDatabase(app);

/**
 * Initialize Firebase Analytics
 *
 * This function handles:
 * 1. Checking if analytics is supported in the current environment
 * 2. Initializing analytics if supported
 *
 * @returns Firebase Analytics instance or null if not supported/initialization failed
 */
export const initializeAnalytics = async (): Promise<Analytics | null> => {
  if (typeof window !== 'undefined') {
    try {
      // Firebase 11 changes: isSupported is now a property, not a function
      if (isSupported) {
        const analytics: Analytics = getAnalytics(app);

        if (process.env.NODE_ENV === 'development') {
          console.log('Firebase Analytics initialized successfully');
        }

        return analytics;
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Firebase Analytics is not supported in this environment');
        }
      }
    } catch (error) {
      console.error('Error initializing Firebase Analytics:', error);
    }
  }

  return null;
};

/**
 * Manually test Firebase Analytics by sending a test event
 * This is useful for debugging Firebase Analytics integration
 *
 * @returns {Promise<boolean>} - True if test was successful, false otherwise
 */
export const testFirebaseAnalytics = async (): Promise<boolean> => {
  try {
    // Check if analytics is supported
    console.log('🔍 Checking if Firebase Analytics is supported...');
    const supported = isSupported;
    console.log('🔍 Firebase Analytics supported:', supported);

    if (!supported) {
      console.warn('❌ Firebase Analytics is not supported in this environment');
      return false;
    }

    // Get analytics instance
    console.log('🔄 Initializing Firebase Analytics...');
    const analytics: Analytics = getAnalytics(app);
    console.log('✅ Firebase Analytics initialized successfully');

    // Log a test event
    console.log('📊 Sending test event...');
    logEvent(analytics, 'test_event', {
      test_param: 'test_value',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Test event sent successfully');

    return true;
  } catch (error) {
    console.error('❌ Error testing Firebase Analytics:', error);
    return false;
  }
};

export default app;
