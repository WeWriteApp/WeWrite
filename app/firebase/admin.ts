/**
 * Legacy compatibility shim.
 * All exports delegate to the canonical module at firebase/firebaseAdmin.ts.
 */

import admin from 'firebase-admin';
export { admin };

export {
  getFirebaseAdmin,
  getFirebaseAdmin as initAdmin,
  getAdminFirestore,
  getFirebaseAdminError,
  FieldValue,
} from './firebaseAdmin';
