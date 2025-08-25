// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, type Firestore, connectFirestoreEmulator, initializeFirestore } from "firebase/firestore";
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import { getDatabase, type Database } from "firebase/database";
import { initializeErrorSuppression } from '../utils/errorSuppression';

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
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Validate required environment variables
const requiredEnvVars = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('[Firebase Config] Missing required environment variables:', missingVars);
  console.error('[Firebase Config] Available env vars:', Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_FIREBASE')));
  throw new Error(`Missing Firebase configuration: ${missingVars.join(', ')}`);
}

// Firebase configuration
const newConfig: FirebaseConfig = {
  apiKey: requiredEnvVars.apiKey!,
  authDomain: requiredEnvVars.authDomain!,
  databaseURL: requiredEnvVars.databaseURL!,
  projectId: requiredEnvVars.projectId!,
  storageBucket: requiredEnvVars.storageBucket!,
  messagingSenderId: requiredEnvVars.messagingSenderId!,
  appId: requiredEnvVars.appId!,
  // Use the GA measurement ID for Firebase Analytics to ensure events go to the same property
  measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID};

// Initialize Firebase using environment-aware configuration
// This maintains backward compatibility while supporting future multi-project architecture
// Simplified Firebase config - no more environment-aware complexity

// Initialize error suppression early
initializeErrorSuppression();

// Initialize Firebase with simple configuration
console.log('[Firebase Config] Initializing Firebase with simple configuration');
export const app: FirebaseApp = initializeApp(newConfig);
export const auth: Auth = getAuth(app);

// Initialize Firestore with standard configuration
// Use getFirestore for better compatibility and fewer connection issues
export const firestore: Firestore = getFirestore(app);

export const rtdb: Database = getDatabase(app);

console.log('[Firebase Config] Configured Firestore with minimal connection settings');

// Connect to Firebase emulators if enabled
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || 'localhost';
  const firestorePort = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT || '8080';
  const authPort = process.env.NEXT_PUBLIC_AUTH_EMULATOR_PORT || '9099';

  try {
    // Connect Firestore to emulator
    connectFirestoreEmulator(firestore, emulatorHost, parseInt(firestorePort));
    console.log(`[Firebase Config] Connected Firestore to emulator at ${emulatorHost}:${firestorePort}`);

    // Connect Auth to emulator
    connectAuthEmulator(auth, `http://${emulatorHost}:${authPort}`);
    console.log(`[Firebase Config] Connected Auth to emulator at ${emulatorHost}:${authPort}`);
  } catch (error) {
    console.warn('[Firebase Config] Failed to connect to emulators:', error);
  }
}

// Legacy exports for backward compatibility
export const db: Firestore = firestore;

console.log('[Firebase Config] Successfully initialized Firebase services');

/**
 * Initialize Firebase Analytics
 *
 * This function handles:
 * 1. Checking if analytics is supported in the current environment
 * 2. Initializing analytics if supported
 * 3. Suppressing Firebase installations errors
 *
 * @returns Firebase Analytics instance or null if not supported/initialization failed
 */
export const initializeAnalytics = async (): Promise<Analytics | null> => {
  if (typeof window !== 'undefined') {
    try {
      // Check if analytics is supported in this environment
      const supported = await isSupported();
      if (supported) {
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
    const supported = await isSupported();
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