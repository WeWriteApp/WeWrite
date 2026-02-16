/**
 * Firebase Admin SDK - Canonical Module
 *
 * Single source of truth for Firebase Admin initialization.
 * All server-side code should import from here (or from the
 * legacy compatibility shim at firebase/admin.ts).
 *
 * Throws on initialization failure rather than returning null,
 * since callers universally need a working instance.
 */

import * as admin from 'firebase-admin';

let firebaseAdminInstance: typeof admin | null = null;
let initializationError: string | null = null;

/**
 * Parse service account credentials from environment variables.
 * Supports multiple formats: base64-encoded JSON, raw JSON, or individual env vars.
 */
function parseServiceAccount(): admin.ServiceAccount {
  // Strategy 1: GOOGLE_CLOUD_KEY_JSON (primary, base64-encoded)
  const googleCloudKey = process.env.GOOGLE_CLOUD_KEY_JSON;
  if (googleCloudKey) {
    let jsonString = googleCloudKey;

    // Detect base64 vs raw JSON
    if (!jsonString.startsWith('{')) {
      try {
        jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
      } catch {
        // Not base64, try as raw JSON
      }
    }

    const sa = JSON.parse(jsonString);
    if (sa.project_id && sa.private_key && sa.client_email) {
      return sa;
    }
    throw new Error('GOOGLE_CLOUD_KEY_JSON missing required fields');
  }

  // Strategy 2: LOGGING_CLOUD_KEY_JSON (fallback, may have newlines)
  const loggingKey = process.env.LOGGING_CLOUD_KEY_JSON;
  if (loggingKey) {
    let jsonString = loggingKey.replace(/\n/g, '').replace(/\r/g, '');
    if (!jsonString.startsWith('{')) {
      try {
        jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
      } catch {
        // Not base64, try as raw JSON
      }
    }

    const sa = JSON.parse(jsonString);
    if (sa.project_id && sa.private_key && sa.client_email) {
      return sa;
    }
    throw new Error('LOGGING_CLOUD_KEY_JSON missing required fields');
  }

  // Strategy 3: Individual environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (projectId && privateKey && clientEmail) {
    return {
      projectId,
      privateKey,
      clientEmail,
    } as admin.ServiceAccount;
  }

  throw new Error('No Firebase credentials found. Set GOOGLE_CLOUD_KEY_JSON, LOGGING_CLOUD_KEY_JSON, or individual FIREBASE_* env vars.');
}

/**
 * Get Firebase Admin instance.
 * Lazily initializes on first call. Throws if initialization fails.
 */
export function getFirebaseAdmin(): typeof admin {
  if (firebaseAdminInstance) {
    return firebaseAdminInstance;
  }

  // If we previously failed, throw the cached error
  if (initializationError) {
    throw new Error(initializationError);
  }

  try {
    // Check if Firebase Admin is already initialized by another module
    if (admin.apps.length > 0) {
      firebaseAdminInstance = admin;
      return firebaseAdminInstance;
    }

    const serviceAccount = parseServiceAccount();
    const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com';

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccount.projectId || serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
        clientEmail: serviceAccount.clientEmail || serviceAccount.client_email,
        privateKey: (serviceAccount.privateKey || serviceAccount.private_key || '').replace(/\\n/g, '\n')
      } as admin.ServiceAccount),
      databaseURL
    });

    firebaseAdminInstance = admin;
    return firebaseAdminInstance;

  } catch (error: any) {
    initializationError = `Firebase Admin initialization failed: ${error.message}`;
    console.error('[Firebase Admin]', initializationError);
    throw new Error(initializationError);
  }
}

/**
 * Get Firestore instance directly.
 */
export function getAdminFirestore() {
  return getFirebaseAdmin().firestore();
}

/**
 * Get initialization error details for debugging.
 */
export function getFirebaseAdminError(): string | null {
  return initializationError;
}

/**
 * FieldValue for server-side Firestore operations.
 * e.g. FieldValue.serverTimestamp(), FieldValue.increment()
 */
export const FieldValue = admin.firestore.FieldValue;
