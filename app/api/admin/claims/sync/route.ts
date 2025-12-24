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
import { getCollectionName, getEnvironmentType } from '../../../../utils/environmentConfig';

interface SessionData {
  uid?: string;
  email?: string;
  isAdmin?: boolean;
}

/**
 * Verify the requesting user is an admin using session cookie
 */
async function verifyAdminAccess(request: NextRequest): Promise<{ isAdmin: boolean; email?: string; error?: string }> {
  // Get session data from cookie
  const simpleSessionCookie = request.cookies.get('simpleUserSession')?.value;
  if (!simpleSessionCookie) {
    return { isAdmin: false, error: 'Not authenticated' };
  }

  let sessionData: SessionData;
  try {
    sessionData = JSON.parse(simpleSessionCookie);
  } catch {
    return { isAdmin: false, error: 'Invalid session' };
  }

  if (!sessionData.email) {
    return { isAdmin: false, error: 'Invalid session data' };
  }

  // Check session's isAdmin flag (set by /api/auth/session from Custom Claims + Firestore)
  if (sessionData.isAdmin === true) {
    return { isAdmin: true, email: sessionData.email };
  }

  // In development, allow access for all authenticated users
  const env = getEnvironmentType();
  if (env === 'development') {
    return { isAdmin: true, email: sessionData.email };
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
