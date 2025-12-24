/**
 * Admin Claims Service
 *
 * Manages Firebase Custom Claims for admin access control.
 * Custom claims are cryptographically signed and embedded in the user's ID token,
 * making them tamper-proof and the most secure way to handle role-based access.
 *
 * Key concepts:
 * - Claims are set server-side using Firebase Admin SDK
 * - Claims propagate to the client's ID token on next token refresh
 * - User must re-authenticate OR force token refresh to get new claims
 * - Claims are limited to 1000 bytes total
 *
 * Usage:
 * - setAdminClaim(uid, true) - Grant admin access
 * - setAdminClaim(uid, false) - Revoke admin access
 * - getAdminClaim(uid) - Check if user has admin claim
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName } from '../utils/environmentConfig';

interface AdminClaimResult {
  success: boolean;
  error?: string;
}

interface ClaimsRecord {
  admin?: boolean;
  [key: string]: any;
}

/**
 * Set the admin custom claim for a user
 *
 * @param uid - Firebase Auth user ID
 * @param isAdmin - Whether to grant (true) or revoke (false) admin access
 * @returns Result indicating success or failure
 */
export async function setAdminClaim(uid: string, isAdmin: boolean): Promise<AdminClaimResult> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return { success: false, error: 'Firebase Admin not initialized' };
    }

    // Get current claims to preserve other claims
    const user = await admin.auth().getUser(uid);
    const currentClaims = user.customClaims || {};

    // Set the admin claim
    const newClaims: ClaimsRecord = {
      ...currentClaims,
      admin: isAdmin,
    };

    // Remove admin claim if false (cleaner than setting to false)
    if (!isAdmin) {
      delete newClaims.admin;
    }

    await admin.auth().setCustomUserClaims(uid, newClaims);

    // Also update Firestore for backwards compatibility and audit trail
    const db = admin.firestore();
    const userRef = db.collection(getCollectionName('users')).doc(uid);

    await userRef.update({
      isAdmin: isAdmin,
      adminClaimUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Keep a log of admin changes for audit
    });

    // Log the admin change for audit purposes
    await db.collection(getCollectionName('adminAuditLog')).add({
      action: isAdmin ? 'ADMIN_GRANTED' : 'ADMIN_REVOKED',
      targetUid: uid,
      targetEmail: user.email || 'unknown',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      // Note: In a real system, you'd want to capture who made this change
    });

    console.log(`[AdminClaims] ${isAdmin ? 'Granted' : 'Revoked'} admin claim for user ${uid}`);
    return { success: true };
  } catch (error: any) {
    console.error('[AdminClaims] Error setting admin claim:', error);
    return { success: false, error: error.message || 'Failed to set admin claim' };
  }
}

/**
 * Get the admin custom claim for a user
 *
 * @param uid - Firebase Auth user ID
 * @returns Object with admin status and any error
 */
export async function getAdminClaim(uid: string): Promise<{ isAdmin: boolean; error?: string }> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return { isAdmin: false, error: 'Firebase Admin not initialized' };
    }

    const user = await admin.auth().getUser(uid);
    const claims = user.customClaims || {};

    return { isAdmin: claims.admin === true };
  } catch (error: any) {
    console.error('[AdminClaims] Error getting admin claim:', error);
    return { isAdmin: false, error: error.message };
  }
}

/**
 * Check admin status from a decoded ID token
 * This is the fastest check as it doesn't require a database call
 *
 * @param decodedToken - Decoded Firebase ID token (from verifyIdToken)
 * @returns Whether the user has admin claim
 */
export function hasAdminClaimFromToken(decodedToken: { admin?: boolean } | null): boolean {
  return decodedToken?.admin === true;
}

/**
 * Get all users with admin claims
 * Useful for admin management UI
 *
 * @returns Array of admin user UIDs and emails
 */
export async function getAllAdmins(): Promise<{ uid: string; email: string }[]> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return [];
    }

    // Firebase doesn't have a direct way to query by custom claims,
    // so we query Firestore where we also store the isAdmin flag
    const db = admin.firestore();
    const adminsSnapshot = await db.collection(getCollectionName('users'))
      .where('isAdmin', '==', true)
      .get();

    return adminsSnapshot.docs.map(doc => ({
      uid: doc.id,
      email: doc.data().email || 'unknown',
    }));
  } catch (error) {
    console.error('[AdminClaims] Error getting all admins:', error);
    return [];
  }
}

/**
 * Revoke all refresh tokens for a user
 * Forces re-authentication and ensures claims are updated
 *
 * @param uid - Firebase Auth user ID
 */
export async function revokeUserTokens(uid: string): Promise<AdminClaimResult> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return { success: false, error: 'Firebase Admin not initialized' };
    }

    await admin.auth().revokeRefreshTokens(uid);
    console.log(`[AdminClaims] Revoked refresh tokens for user ${uid}`);
    return { success: true };
  } catch (error: any) {
    console.error('[AdminClaims] Error revoking tokens:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync Firestore admin flags to Firebase Custom Claims
 * Run this to migrate existing admins to the custom claims system
 *
 * @returns Number of users synced
 */
export async function syncFirestoreAdminsToClaims(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return { synced: 0, errors: ['Firebase Admin not initialized'] };
    }

    const db = admin.firestore();

    // Find all users with isAdmin: true in Firestore
    const adminsSnapshot = await db.collection(getCollectionName('users'))
      .where('isAdmin', '==', true)
      .get();

    console.log(`[AdminClaims] Found ${adminsSnapshot.size} admin users to sync`);

    for (const doc of adminsSnapshot.docs) {
      const uid = doc.id;
      const userData = doc.data();

      try {
        // Set the admin custom claim
        await admin.auth().setCustomUserClaims(uid, { admin: true });
        synced++;
        console.log(`[AdminClaims] Synced admin claim for ${userData.email || uid}`);
      } catch (userError: any) {
        errors.push(`Failed to sync ${uid}: ${userError.message}`);
      }
    }

    return { synced, errors };
  } catch (error: any) {
    console.error('[AdminClaims] Sync error:', error);
    return { synced, errors: [...errors, error.message] };
  }
}
