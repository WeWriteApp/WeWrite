/**
 * Environment-Aware Firebase Configuration
 * 
 * This module provides environment-aware Firebase app initialization that supports:
 * 1. Current: Single Firebase project with environment-specific collection prefixes
 * 2. Future: Separate Firebase projects per environment
 * 
 * The architecture is designed to enable seamless migration from prefixed collections
 * to separate Firebase projects by simply updating configuration objects.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAnalytics, type Analytics, isSupported } from 'firebase/analytics';
import { getFirebaseConfig, getEnvironmentType, validateEnvironmentConfig } from '../utils/environmentConfig';
import { DevelopmentAuthService, initializeDevelopmentAuth } from './developmentAuth';

/**
 * Firebase services interface for type safety
 */
export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  rtdb: Database;
  storage: FirebaseStorage;
  analytics?: Analytics;
}

/**
 * Singleton instance for Firebase services
 */
let firebaseServices: FirebaseServices | null = null;

/**
 * Environment-aware Firebase app initializer
 * 
 * This function returns the correct Firebase app instance based on the current environment.
 * It supports both the current single-project architecture and future multi-project setup.
 * 
 * @returns Firebase services object with all initialized services
 */
export const getEnvironmentAwareFirebase = (): FirebaseServices => {
  // Return existing instance if already initialized
  if (firebaseServices) {
    return firebaseServices;
  }

  // Validate environment configuration
  if (!validateEnvironmentConfig()) {
    throw new Error('Invalid environment configuration detected');
  }

  const envType = getEnvironmentType();
  const config = getFirebaseConfig();

  // Validate that we have all required configuration
  if (!config.apiKey || !config.projectId || !config.authDomain) {
    throw new Error('Missing required Firebase configuration. Please check your environment variables.');
  }

  // Generate environment-specific app name for potential future multi-app support
  const appName = `wewrite-${envType}`;
  
  try {
    // Check if app already exists
    let app: FirebaseApp;
    const existingApps = getApps();
    const existingApp = existingApps.find(a => a.name === appName);

    if (existingApp) {
      app = existingApp;
    } else {
      // Initialize new app with environment-specific name
      app = initializeApp(config, appName);
    }

    // Also ensure a default app exists for backward compatibility
    const defaultApp = existingApps.find(a => a.name === '[DEFAULT]');
    if (!defaultApp) {
      // Create default app with same config for backward compatibility
      initializeApp(config);
    }

    // Initialize all Firebase services
    const auth = getAuth(app);
    const db = getFirestore(app);
    const rtdb = getDatabase(app);
    const storage = getStorage(app);

    // Initialize analytics conditionally
    let analytics: Analytics | undefined;
    if (typeof window !== 'undefined') {
      isSupported().then(supported => {
        if (supported) {
          analytics = getAnalytics(app);
        }
      }).catch(error => {
        console.warn('Firebase Analytics not supported:', error);
      });
    }

    // Create services object
    firebaseServices = {
      app,
      auth,
      db,
      rtdb,
      storage,
      analytics
    };

    console.log(`[Firebase] Initialized environment-aware Firebase for ${envType} environment`);
    console.log(`[Firebase] App name: ${appName}, Project ID: ${config.projectId}`);

    // Initialize development authentication if enabled
    if (envType === 'development') {
      initializeDevelopmentAuth();
    }

    return firebaseServices;
    
  } catch (error) {
    console.error('[Firebase] Error initializing environment-aware Firebase:', error);
    throw error;
  }
};

/**
 * Get the default Firebase app instance
 * This maintains compatibility with existing code that expects the default app
 * 
 * @returns Default Firebase app instance
 */
export const getDefaultFirebaseApp = (): FirebaseApp => {
  const services = getEnvironmentAwareFirebase();
  return services.app;
};

/**
 * Get environment-aware Firestore instance
 * 
 * @returns Firestore instance for current environment
 */
export const getEnvironmentAwareFirestore = (): Firestore => {
  const services = getEnvironmentAwareFirebase();
  return services.db;
};

/**
 * Get environment-aware Auth instance
 * 
 * @returns Auth instance for current environment
 */
export const getEnvironmentAwareAuth = (): Auth => {
  const services = getEnvironmentAwareFirebase();
  return services.auth;
};

/**
 * Get environment-aware Realtime Database instance
 * 
 * @returns Realtime Database instance for current environment
 */
export const getEnvironmentAwareRTDB = (): Database => {
  const services = getEnvironmentAwareFirebase();
  return services.rtdb;
};

/**
 * Get environment-aware Storage instance
 * 
 * @returns Storage instance for current environment
 */
export const getEnvironmentAwareStorage = (): FirebaseStorage => {
  const services = getEnvironmentAwareFirebase();
  return services.storage;
};

/**
 * Get environment-aware Analytics instance
 * 
 * @returns Analytics instance for current environment (if supported)
 */
export const getEnvironmentAwareAnalytics = (): Analytics | undefined => {
  const services = getEnvironmentAwareFirebase();
  return services.analytics;
};

/**
 * Safely get Firebase services with error handling
 * This function ensures Firebase is properly initialized before returning services
 *
 * @returns Firebase services object or null if initialization fails
 */
export const getSafeFirebaseServices = (): FirebaseServices | null => {
  try {
    return getEnvironmentAwareFirebase();
  } catch (error) {
    console.error('[Firebase] Failed to get Firebase services safely:', error);
    return null;
  }
};

/**
 * Reset Firebase services (for testing purposes)
 * This should only be used in test environments
 */
export const resetFirebaseServices = (): void => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[Firebase] resetFirebaseServices should only be used in test environments');
  }
  firebaseServices = null;
};

/**
 * Log current Firebase configuration for debugging
 */
export const logFirebaseConfig = (): void => {
  const envType = getEnvironmentType();
  const config = getFirebaseConfig();
  
  console.log(`[Firebase Config] Environment: ${envType}`);
  console.log(`[Firebase Config] Project ID: ${config.projectId}`);
  console.log(`[Firebase Config] Auth Domain: ${config.authDomain}`);
  console.log(`[Firebase Config] Database URL: ${config.databaseURL}`);
  
  // Don't log sensitive information in production
  if (envType === 'development') {
    console.log(`[Firebase Config] API Key: ${config.apiKey?.substring(0, 10)}...`);
  }
};
