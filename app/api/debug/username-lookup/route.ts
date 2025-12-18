import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { requireDevelopmentEnvironment } from '../debugHelper';

/**
 * Debug API to check username lookup
 * This helps debug login issues with usernames
 *
 * NOTE: Uses Firestore instead of admin.auth() to avoid jose dependency issues in Vercel
 */

export async function POST(request: NextRequest) {
  // SECURITY: Only allow in local development
  const devCheck = requireDevelopmentEnvironment();
  if (devCheck) return devCheck;

  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    const firestore = admin.firestore();
    const usernamesCollection = getCollectionName('usernames');
    const usersCollection = getCollectionName('users');

    console.log('[Debug] Looking up username:', username);
    console.log('[Debug] Username collection:', usernamesCollection);

    // Look up the username in the usernames collection
    const usernameDoc = await firestore
      .collection(usernamesCollection)
      .doc(username.toLowerCase())
      .get();

    const result: any = {
      username: username,
      usernamesCollection: usernamesCollection,
      exists: usernameDoc.exists,
      data: usernameDoc.exists ? usernameDoc.data() : null
    };

    if (usernameDoc.exists) {
      const usernameData = usernameDoc.data();
      const uid = usernameData?.uid;

      if (uid) {
        // Get user info from Firestore users collection (avoids jose issues)
        try {
          const userDoc = await firestore.collection(usersCollection).doc(uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            result.firestoreUser = {
              collection: usersCollection,
              exists: true,
              uid: uid,
              email: userData?.email,
              emailVerified: userData?.emailVerified,
              username: userData?.username,
              createdAt: userData?.createdAt
            };
          } else {
            result.firestoreUser = {
              collection: usersCollection,
              exists: false,
              uid: uid
            };
          }
        } catch (firestoreError: any) {
          result.firestoreError = firestoreError.message;
        }
      }
    }

    console.log('[Debug] Username lookup result:', result);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[Debug] Username lookup error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
