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
  // Use the GA measurement ID for Firebase Analytics to ensure events go to the same property
  measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
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
 * 
 * @returns Firebase Analytics instance or null if not supported/initialization failed
 */
export const initializeAnalytics = async () => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('Checking analytics support...');
    }
    
    const supported = await isSupported();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics supported:', supported);
    }
    
    if (supported) {
      const analytics = getAnalytics(app);
      return analytics;
    } else {
      console.warn('Firebase Analytics is not supported in this environment');
    }
  } catch (error) {
    console.error('Error initializing Firebase Analytics:', error);
  }
  return null;
};

/**
 * Manually test Firebase Analytics by sending a test event
 * This is useful for debugging Firebase Analytics integration
 * 
 * @returns {Promise<void>}
 */
export const testFirebaseAnalytics = async () => {
  if (process.env.NODE_ENV !== 'development') {
    return; // Only run in development
  }
  
  try {
    // Check if analytics is supported
    console.log('🔍 Checking if Firebase Analytics is supported...');
    const supported = await isSupported();
    console.log('🔍 Firebase Analytics supported:', supported);
    
    if (!supported) {
      console.warn('⚠️ Firebase Analytics is not supported in this environment');
      return;
    }
    
    // Get analytics instance
    console.log('🔍 Getting Firebase Analytics instance...');
    const analytics = getAnalytics(app);
    
    if (!analytics) {
      console.warn('⚠️ Failed to get Firebase Analytics instance');
      return;
    }
    
    // Log a test page view (this is for manual testing only)
    console.log('📊 Sending page_view event to Firebase Analytics...');
    logEvent(analytics, 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname
    });
    console.log('✅ page_view event sent to Firebase Analytics');
    
  } catch (error) {
    console.error('❌ Error testing Firebase Analytics:', error);
  }
};

export default app;
