import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { isAdminServer } from '../../../admin-auth-helper';
import { getCollectionName } from '../../../../utils/environmentConfig';

export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 503 });
    }
    const db = admin.firestore();

    const actorId = await getUserIdFromRequest(request);
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actorRecord = await admin.auth().getUser(actorId);
    const actorEmail = actorRecord.email;
    const devBypass = process.env.NODE_ENV === 'development';
    if (!actorEmail || (!isAdminServer(actorEmail) && !devBypass)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { uid } = body || {};
    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    let targetEmail: string | null = null;
    try {
      const userRec = await admin.auth().getUser(uid);
      targetEmail = userRec.email;
    } catch (err) {
      // continue; may be already deleted in auth
    }

    // Delete auth user if present
    if (targetEmail) {
      await admin.auth().deleteUser(uid);
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
