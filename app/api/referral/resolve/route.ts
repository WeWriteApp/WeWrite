import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * GET /api/referral/resolve?ref={usernameOrUid}
 *
 * Resolves a referral code (username or UID) to a user ID.
 * Supports both username-based referral links (nicer URLs) and
 * UID-based links (backwards compatible).
 *
 * Returns the referrer's UID and username for display purposes.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ref = searchParams.get('ref');

    if (!ref) {
      return NextResponse.json(
        { success: false, error: 'Missing ref parameter' },
        { status: 400 }
      );
    }

    const admin = getFirebaseAdmin();
    const firestore = admin.firestore();
    const usersCollection = getCollectionName('users');

    // First, check if the ref is a UID (direct lookup)
    const userByUidDoc = await firestore.collection(usersCollection).doc(ref).get();

    if (userByUidDoc.exists) {
      const userData = userByUidDoc.data();
      return NextResponse.json({
        success: true,
        data: {
          uid: ref,
          username: userData?.username || null,
          displayName: userData?.displayName || userData?.username || null,
        }
      });
    }

    // If not found by UID, try to find by username (case-insensitive)
    const userByUsernameSnapshot = await firestore
      .collection(usersCollection)
      .where('usernameLower', '==', ref.toLowerCase())
      .limit(1)
      .get();

    if (!userByUsernameSnapshot.empty) {
      const userDoc = userByUsernameSnapshot.docs[0];
      const userData = userDoc.data();
      return NextResponse.json({
        success: true,
        data: {
          uid: userDoc.id,
          username: userData?.username || null,
          displayName: userData?.displayName || userData?.username || null,
        }
      });
    }

    // Also try exact username match (for users without usernameLower field)
    const userByExactUsernameSnapshot = await firestore
      .collection(usersCollection)
      .where('username', '==', ref)
      .limit(1)
      .get();

    if (!userByExactUsernameSnapshot.empty) {
      const userDoc = userByExactUsernameSnapshot.docs[0];
      const userData = userDoc.data();
      return NextResponse.json({
        success: true,
        data: {
          uid: userDoc.id,
          username: userData?.username || null,
          displayName: userData?.displayName || userData?.username || null,
        }
      });
    }

    // Referral code not found
    return NextResponse.json(
      { success: false, error: 'Invalid referral code' },
      { status: 404 }
    );

  } catch (error) {
    console.error('[Referral Resolve] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resolve referral code' },
      { status: 500 }
    );
  }
}
