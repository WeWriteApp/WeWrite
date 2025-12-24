/**
 * Admin Claims Sync API
 *
 * POST /api/admin/claims/sync - Sync Firestore admins to Firebase Custom Claims
 *
 * This migration endpoint syncs existing isAdmin flags from Firestore
 * to Firebase Custom Claims for all admin users.
 *
 * Security:
 * - Only existing admins can run this sync
 * - All changes are logged for audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncFirestoreAdminsToClaims } from '../../../../services/adminClaimsService';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { isAdmin as isAdminByEmail } from '../../../../utils/isAdmin';

/**
 * Verify the requesting user is an admin
 */
async function verifyAdminAccess(request: NextRequest): Promise<{ isAdmin: boolean; email?: string; error?: string }> {
  const userEmail = request.headers.get('x-user-email');

  if (!userEmail) {
    return { isAdmin: false, error: 'Not authenticated' };
  }

  // Check if user is admin by email allowlist
  if (isAdminByEmail(userEmail)) {
    return { isAdmin: true, email: userEmail };
  }

  // Check if user has admin flag in Firestore
  const admin = getFirebaseAdmin();
  if (!admin) {
    return { isAdmin: false, error: 'Database not available' };
  }

  const db = admin.firestore();
  const usersSnapshot = await db.collection(getCollectionName('users'))
    .where('email', '==', userEmail)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return { isAdmin: false, error: 'User not found' };
  }

  const userData = usersSnapshot.docs[0].data();
  if (userData.isAdmin === true) {
    return { isAdmin: true, email: userEmail };
  }

  return { isAdmin: false, error: 'Not authorized' };
}

/**
 * POST - Sync all Firestore admins to Firebase Custom Claims
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAccess(request);
    if (!authResult.isAdmin) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Admin Claims Sync] Started by ${authResult.email}`);

    const result = await syncFirestoreAdminsToClaims();

    // Log the sync action
    const admin = getFirebaseAdmin();
    if (admin) {
      const db = admin.firestore();
      await db.collection(getCollectionName('adminAuditLog')).add({
        action: 'ADMIN_CLAIMS_SYNC',
        performedBy: authResult.email,
        synced: result.synced,
        errors: result.errors,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${result.synced} admin users to custom claims`,
      synced: result.synced,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error: any) {
    console.error('[Admin Claims Sync] Error:', error);
    return NextResponse.json({ error: 'Failed to sync admin claims' }, { status: 500 });
  }
}
