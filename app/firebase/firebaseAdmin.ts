/**
 * Firebase Admin SDK Initialization
 * Environment-aware Firebase Admin setup with robust error handling
 *
 * This module ensures Firebase Admin is properly initialized across all environments
 * and provides detailed error information for debugging initialization issues.
 */

import * as admin from 'firebase-admin';
import { getEnvironmentType } from '../utils/environmentConfig';

let firebaseAdminInstance: typeof admin | null = null;
let initializationError: string | null = null;

/**
 * Get Firebase Admin instance with comprehensive error handling
 * Returns null if initialization fails, with detailed error logging
 */
export function getFirebaseAdmin(): typeof admin | null {
  if (firebaseAdminInstance) {
    return firebaseAdminInstance;
  }

  // If we previously failed to initialize, don't keep trying
  if (initializationError) {
    console.warn('[Firebase Admin] Previous initialization failed:', initializationError);
    return null;
  }

  try {
    const envType = getEnvironmentType();
    console.log('[Firebase Admin] Initializing for environment:', envType);

    // Check if Firebase Admin is already initialized
    if (admin.apps.length > 0) {
      console.log('[Firebase Admin] Found existing app, marking as initialized');
      firebaseAdminInstance = admin;

      // Verify the app is actually working by testing firestore access
      try {
        const testDb = admin.firestore();
        console.log('[Firebase Admin] Verified existing app is functional');
        return firebaseAdminInstance;
      } catch (testError) {
        console.error('[Firebase Admin] Existing app is not functional, reinitializing:', testError.message);
        // Delete existing apps and reinitialize
        admin.apps.forEach(app => app?.delete());
      }
    }

    // Validate required environment variables
    const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
    if (!base64Json) {
      initializationError = 'Missing GOOGLE_CLOUD_KEY_JSON environment variable';
      console.error('[Firebase Admin] Critical:', initializationError);
      return null;
    }

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PID;
    if (!projectId) {
      initializationError = 'Missing NEXT_PUBLIC_FIREBASE_PID environment variable';
      console.error('[Firebase Admin] Critical:', initializationError);
      return null;
    }

    // Decode and parse service account credentials
    let serviceAccount;
    try {
      console.log('[Firebase Admin] Decoding service account credentials');
      const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decodedJson);

      if (!serviceAccount.client_email || !serviceAccount.private_key) {
        throw new Error('Service account missing required fields (client_email, private_key)');
      }

      console.log('[Firebase Admin] Service account validated:', serviceAccount.client_email);
    } catch (parseError: any) {
      initializationError = `Failed to parse service account credentials: ${parseError.message}`;
      console.error('[Firebase Admin] Critical:', initializationError);
      return null;
    }

    // Initialize Firebase Admin with validated credentials
    const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com';

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccount.project_id || projectId,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, '\n')
      }),
      databaseURL
    });

    firebaseAdminInstance = admin;
    console.log('[Firebase Admin] Initialized successfully:', {
      projectId: serviceAccount.project_id || projectId,
      clientEmail: serviceAccount.client_email,
      environment: envType
    });

    return firebaseAdminInstance;

  } catch (error: any) {
    initializationError = `Firebase Admin initialization failed: ${error.message}`;
    console.error('[Firebase Admin] Critical error:', {
      error: error.message,
      code: error.code,
      environment: getEnvironmentType(),
      hasGoogleCloudKey: !!process.env.GOOGLE_CLOUD_KEY_JSON,
      hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PID
    });
    return null;
  }
}

/**
 * Get initialization error details for debugging
 */
export function getFirebaseAdminError(): string | null {
  return initializationError;
}

/**
 * Export FieldValue for server-side Firestore operations
 * Allows using FieldValue.serverTimestamp(), FieldValue.increment(), etc.
 */
export const FieldValue = admin.firestore.FieldValue;
