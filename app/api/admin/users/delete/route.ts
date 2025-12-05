import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';

export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 503 });
    }
    const db = admin.firestore();

    // Verify admin access using session cookie
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { uid } = body || {};
    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    // Get user email from Firestore instead of Firebase Auth (avoids jose issues)
    let targetEmail: string | null = null;
    try {
      const userDoc = await db.collection(getCollectionName('users')).doc(uid).get();
      targetEmail = userDoc.data()?.email || null;
    } catch (err) {
      // continue; may not have Firestore doc
    }

    // Delete auth user if present (this may fail in Vercel due to jose, but try anyway)
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr: any) {
      console.warn('[ADMIN] deleteUser from Auth failed (may be jose issue or user not found):', authErr.message);
    }

    // Delete user doc (dev/production handled by getCollectionName)
    await db.collection(getCollectionName('users')).doc(uid).delete().catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'User deleted',
      uid,
      email: targetEmail
    });
  } catch (error: any) {
    console.error('[ADMIN] delete user error', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete user' }, { status: 500 });
  }
}
