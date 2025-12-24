/**
 * Admin Claims Management API
 *
 * Endpoints for managing Firebase Custom Claims (admin access)
 *
 * POST /api/admin/claims - Grant or revoke admin access
 * GET /api/admin/claims - List all admins
 * POST /api/admin/claims/sync - Sync Firestore admins to custom claims (migration)
 *
 * Security:
 * - Only existing admins can modify admin claims
 * - Cannot revoke your own admin access (prevents lockout)
 * - All changes are logged for audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { setAdminClaim, getAdminClaim, getAllAdmins, revokeUserTokens } from '../../../services/adminClaimsService';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { isAdmin as isAdminByEmail } from '../../../utils/isAdmin';

/**
 * Verify the requesting user is an admin
 */
async function verifyAdminAccess(request: NextRequest): Promise<{ isAdmin: boolean; uid?: string; email?: string; error?: string }> {
  // Get user email from middleware header or session cookie
  const userEmail = request.headers.get('x-user-email');

  if (!userEmail) {
    return { isAdmin: false, error: 'Not authenticated' };
  }

  // Check if user is admin by email allowlist first (backwards compat)
  if (isAdminByEmail(userEmail)) {
    return { isAdmin: true, email: userEmail };
  }

  // Check if user has admin claim in Firestore
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
  const uid = usersSnapshot.docs[0].id;

  if (userData.isAdmin === true) {
    return { isAdmin: true, uid, email: userEmail };
  }

  // Check custom claim
  const claimResult = await getAdminClaim(uid);
  if (claimResult.isAdmin) {
    return { isAdmin: true, uid, email: userEmail };
  }

  return { isAdmin: false, error: 'Not authorized' };
}

/**
 * GET - List all admin users
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAccess(request);
    if (!authResult.isAdmin) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const admins = await getAllAdmins();

    return NextResponse.json({
      success: true,
      admins,
      count: admins.length,
    });
  } catch (error: any) {
    console.error('[Admin Claims API] Error listing admins:', error);
    return NextResponse.json({ error: 'Failed to list admins' }, { status: 500 });
  }
}

/**
 * POST - Grant or revoke admin access
 *
 * Body: { uid: string, action: 'grant' | 'revoke', revokeTokens?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAccess(request);
    if (!authResult.isAdmin) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { uid, action, revokeTokens = false } = body;

    if (!uid || !action) {
      return NextResponse.json({ error: 'uid and action are required' }, { status: 400 });
    }

    if (action !== 'grant' && action !== 'revoke') {
      return NextResponse.json({ error: 'action must be "grant" or "revoke"' }, { status: 400 });
    }

    // Prevent self-revocation (would lock out the admin)
    if (action === 'revoke' && authResult.uid === uid) {
      return NextResponse.json({ error: 'Cannot revoke your own admin access' }, { status: 400 });
    }

    // Get target user info for logging
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    let targetEmail = 'unknown';
    try {
      const targetUser = await admin.auth().getUser(uid);
      targetEmail = targetUser.email || 'unknown';
    } catch {
      // User might not exist in Auth, check Firestore
      const db = admin.firestore();
      const userDoc = await db.collection(getCollectionName('users')).doc(uid).get();
      if (userDoc.exists) {
        targetEmail = userDoc.data()?.email || 'unknown';
      }
    }

    // Set the admin claim
    const isAdmin = action === 'grant';
    const result = await setAdminClaim(uid, isAdmin);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update admin claim' }, { status: 500 });
    }

    // Optionally revoke tokens to force re-authentication
    if (revokeTokens) {
      await revokeUserTokens(uid);
    }

    // Log the action with who performed it
    const db = admin.firestore();
    await db.collection(getCollectionName('adminAuditLog')).add({
      action: isAdmin ? 'ADMIN_GRANTED' : 'ADMIN_REVOKED',
      targetUid: uid,
      targetEmail,
      performedBy: authResult.email,
      performedByUid: authResult.uid,
      tokensRevoked: revokeTokens,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: `Admin access ${isAdmin ? 'granted' : 'revoked'} for ${targetEmail}`,
      uid,
      isAdmin,
      tokensRevoked: revokeTokens,
    });
  } catch (error: any) {
    console.error('[Admin Claims API] Error:', error);
    return NextResponse.json({ error: 'Failed to update admin claim' }, { status: 500 });
  }
}
