import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';

export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Verify admin access using session cookie
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
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

    // Propagate username to pages owned by this user for consistency in dev
    try {
      const pagesSnap = await db.collection(getCollectionName('pages'))
        .where('userId', '==', uid)
        .get();

      const batch = db.batch();
      pagesSnap.forEach((doc) => {
        batch.set(doc.ref, { username: newUsername }, { merge: true });
      });
      await batch.commit();
    } catch (pageErr) {
      console.warn('Page username propagation failed (continuing):', pageErr);
    }

    return NextResponse.json({ success: true, username: newUsername });
  } catch (error: any) {
    console.error('Failed to update username:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
