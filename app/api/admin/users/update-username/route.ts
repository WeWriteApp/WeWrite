import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { isAdminServer } from '../../../admin-auth-helper';
import { getCollectionName } from '../../../../utils/environmentConfig';

export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const requesterId = await getUserIdFromRequest(request);
    if (!requesterId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requesterRecord = await admin.auth().getUser(requesterId);
    const requesterEmail = requesterRecord.email;
    const devBypass = process.env.NODE_ENV === 'development';

    if (!requesterEmail || (!isAdminServer(requesterEmail) && !devBypass)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { uid, username } = await request.json();
    if (!uid || !username || typeof username !== 'string') {
      return NextResponse.json({ error: 'uid and username are required' }, { status: 400 });
    }

    // Trim and sanitize basic username input
    const newUsername = username.trim();
    if (newUsername.length < 3 || newUsername.length > 32) {
      return NextResponse.json({ error: 'Username must be between 3 and 32 characters.' }, { status: 400 });
    }

    // Update Firestore user document
    await db.collection(getCollectionName('users')).doc(uid).set(
      { username: newUsername },
      { merge: true }
    );

    // Also update Firebase Auth displayName for consistency
    try {
      await admin.auth().updateUser(uid, { displayName: newUsername });
    } catch (authErr) {
      console.warn('Auth displayName update failed (continuing):', authErr);
    }

    return NextResponse.json({ success: true, username: newUsername });
  } catch (error: any) {
    console.error('Failed to update username:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
