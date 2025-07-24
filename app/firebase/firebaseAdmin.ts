import * as admin from 'firebase-admin';
import { initAdmin } from './admin';

// COMPATIBILITY LAYER: Use the same Firebase Admin instance as admin.ts
// This ensures both systems share the same initialized instance
export function getFirebaseAdmin(): typeof admin | null {
  try {
    // Use the initAdmin function from admin.ts to ensure consistency
    const adminInstance = initAdmin();
    console.log('[Firebase Admin] Using shared Firebase Admin instance from admin.ts');
    return adminInstance;
  } catch (error) {
    console.error('[Firebase Admin] Failed to get shared Firebase Admin instance:', error);
    return null;
  }
}
