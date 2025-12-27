/**
 * Set Admin Custom Claim API
 *
 * POST /api/admin/set-admin-claim
 *
 * Sets or revokes the admin custom claim on a Firebase Auth user.
 * Only existing admins can grant/revoke admin status.
 *
 * SECURITY: This endpoint uses Firebase Custom Claims which are:
 * - Stored in the Firebase Auth token
 * - Automatically included in ID tokens after refresh
 * - Cannot be tampered with client-side
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { verifyAdminAccess } from '../../../utils/adminSecurity';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

interface SetAdminClaimRequest {
  targetUserId: string;
  isAdmin: boolean;
}

export async function POST(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
    // Verify the requesting user is an admin
    const adminAuth = await verifyAdminAccess(request);
    if (!adminAuth.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required to modify admin claims' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetUserId, isAdmin } = body as SetAdminClaimRequest;

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'targetUserId is required' },
        { status: 400 }
      );
    }

    if (typeof isAdmin !== 'boolean') {
      return NextResponse.json(
        { error: 'isAdmin must be a boolean' },
        { status: 400 }
      );
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    // Get the target user to verify they exist
    let targetUser;
    try {
      targetUser = await admin.auth().getUser(targetUserId);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Set the custom claim
    await admin.auth().setCustomUserClaims(targetUserId, {
      admin: isAdmin,
      adminSetAt: isAdmin ? new Date().toISOString() : null,
      adminSetBy: adminAuth.userId,
    });

    // Also update the Firestore user document for consistency
    const db = admin.firestore();
    const usersCollection = getCollectionName('users');
    try {
      await db.collection(usersCollection).doc(targetUserId).update({
        isAdmin: isAdmin,
        adminClaimSetAt: isAdmin ? new Date().toISOString() : null,
        adminClaimSetBy: adminAuth.userId,
        lastModified: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('[Set Admin Claim] Failed to update Firestore user doc:', error);
      // Don't fail - the custom claim is the source of truth
    }

    // Log the action
    console.log('[SECURITY] Admin claim modified:', {
      targetUserId,
      targetEmail: targetUser.email,
      isAdmin,
      setBy: adminAuth.userId,
      setByEmail: adminAuth.userEmail,
      environment: getEnvironmentType(),
    });

    return NextResponse.json({
      success: true,
      message: `Admin claim ${isAdmin ? 'granted' : 'revoked'} for user ${targetUserId}`,
      user: {
        uid: targetUserId,
        email: targetUser.email,
        isAdmin,
      },
      note: 'User must sign out and back in for changes to take effect in their token',
    });

    } catch (error) {
      console.error('[Set Admin Claim] Error:', error);
      return NextResponse.json(
        { error: 'Failed to set admin claim' },
        { status: 500 }
      );
    }
  }); // End withAdminContext
}

/**
 * GET /api/admin/set-admin-claim
 *
 * Check the current admin claim status for a user
 */
export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
    // Verify the requesting user is an admin
    const adminAuth = await verifyAdminAccess(request);
    if (!adminAuth.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    // Get the target user
    let targetUser;
    try {
      targetUser = await admin.auth().getUser(targetUserId);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    const customClaims = targetUser.customClaims || {};

    return NextResponse.json({
      userId: targetUserId,
      email: targetUser.email,
      customClaims: {
        admin: customClaims.admin || false,
        adminSetAt: customClaims.adminSetAt || null,
        adminSetBy: customClaims.adminSetBy || null,
      },
    });

    } catch (error) {
      console.error('[Get Admin Claim] Error:', error);
      return NextResponse.json(
        { error: 'Failed to get admin claim' },
        { status: 500 }
      );
    }
  }); // End withAdminContext
}
