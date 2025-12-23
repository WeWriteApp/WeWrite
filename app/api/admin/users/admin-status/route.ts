/**
 * Admin API: Toggle User Admin Status
 * Allows admins to grant or revoke admin access for users via the admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/admin';
import { getCollectionNameAsync } from '../../../../utils/environmentConfig';

export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }
    const db = admin.firestore();

    // Verify admin access
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { userId, isAdmin } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (typeof isAdmin !== 'boolean') {
      return NextResponse.json({ error: 'isAdmin must be a boolean' }, { status: 400 });
    }

    // Get the users collection name (respects X-Force-Production-Data header)
    const usersCollectionName = await getCollectionNameAsync('users');

    // Update the user's admin status in Firestore
    const userRef = db.collection(usersCollectionName).doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Update the admin status
    await userRef.update({
      isAdmin: isAdmin,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[Admin] ${adminCheck.userEmail} ${isAdmin ? 'granted' : 'revoked'} admin access for user ${userId} (${userData?.email})`);

    return NextResponse.json({
      success: true,
      message: `Admin status ${isAdmin ? 'granted' : 'revoked'} for user`,
      userId,
      isAdmin,
    });
  } catch (error: any) {
    console.error('[Admin Users API] Error toggling admin status:', error);
    return NextResponse.json({
      error: 'Failed to update admin status',
      details: error.message,
    }, { status: 500 });
  }
}
