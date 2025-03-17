// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";

/**
 * Firebase Configuration & Initialization
 * 
 * This module handles the initialization of Firebase services including:
 * - Core Firebase App
 * - Authentication
 * - Firestore Database
 * - Firebase Analytics
 * 
 * For analytics specifically, we initialize conditionally based on browser
 * support and add instrumentation to track page titles properly.
 */

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
const newConfig =  {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Debug config values (without sensitive data)
console.log('Firebase config:', {
  projectId: newConfig.projectId,
  measurementId: newConfig.measurementId,
  hasApiKey: !!newConfig.apiKey,
  hasAppId: !!newConfig.appId
});

// Initialize Firebase
export const app = initializeApp(newConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

/**
 * Initialize Firebase Analytics
 * 
 * This function handles:
 * 1. Checking if analytics is supported in the current environment
 * 2. Initializing analytics if supported
 * 3. Logging a test event to verify it's working
 * 4. Handling errors gracefully
 * 
 * Important: We include page titles with analytics events to make data
 * analysis easier for the data science team since our URLs use UUIDs.
 * 
 * @returns Firebase Analytics instance or null if not supported/initialization failed
 */
export const initializeAnalytics = async () => {
  try {
    console.log('Checking analytics support...');
    const supported = await isSupported();
    console.log('Analytics supported:', supported);
    
    if (supported) {
      const analytics = getAnalytics(app);
      
      // Test event logging
      if (analytics) {
        try {
          // Log initial event with timestamp for verification
          logEvent(analytics, 'analytics_initialized', {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'unknown',
            url: typeof window !== 'undefined' ? window.location.pathname : 'server-side'
          });
          console.log('Analytics initialized successfully with test event');
        } catch (error) {
          console.error('Error logging test analytics event:', error);
        }
      }
      
      return analytics;
    } else {
      console.warn('Firebase Analytics is not supported in this environment');
    }
  } catch (error) {
    console.error('Error initializing Firebase Analytics:', error);
  }
  return null;
};

export default app;
