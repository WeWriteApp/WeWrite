import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Debug API to check username lookup in production
 * This helps debug login issues with usernames
 */

export async function POST(request: NextRequest) {
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

    console.log('[Debug] Looking up username:', username);
    console.log('[Debug] Username collection:', usernamesCollection);

    // Look up the username in the usernames collection
    const usernameDoc = await firestore
      .collection(usernamesCollection)
      .doc(username.toLowerCase())
      .get();

    const result = {
      username: username,
      usernamesCollection: usernamesCollection,
      exists: usernameDoc.exists,
      data: usernameDoc.exists ? usernameDoc.data() : null
    };

    if (usernameDoc.exists) {
      const usernameData = usernameDoc.data();
      const email = usernameData?.email;

      if (email) {
        // Try to get Firebase Auth user
        try {
          const auth = admin.auth();
          const userRecord = await auth.getUserByEmail(email);
          result.firebaseUser = {
            uid: userRecord.uid,
            email: userRecord.email,
            emailVerified: userRecord.emailVerified,
            disabled: userRecord.disabled
          };
        } catch (authError) {
          result.firebaseError = authError.message;
        }

        // Check if user exists in users collection
        const usersCollection = getCollectionName('users');
        try {
          const userDoc = await firestore.collection(usersCollection).doc(usernameData.uid || 'unknown').get();
          result.firestoreUser = {
            collection: usersCollection,
            exists: userDoc.exists,
            uid: usernameData.uid
          };
        } catch (firestoreError) {
          result.firestoreError = firestoreError.message;
        }
      }
    }

    console.log('[Debug] Username lookup result:', result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('[Debug] Username lookup error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
