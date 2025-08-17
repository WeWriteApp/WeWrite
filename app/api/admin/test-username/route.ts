import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Test API to verify username lookup works correctly
 * This helps verify the username login fix is working
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

    console.log('[Test] Testing username lookup:', username);

    // Simulate the exact same lookup logic as the login API
    const usernameDoc = await firestore
      .collection(usernamesCollection)
      .doc(username.toLowerCase())
      .get();

    if (!usernameDoc.exists) {
      return NextResponse.json({
        success: false,
        error: 'Username not found',
        username: username.toLowerCase(),
        collection: usernamesCollection
      });
    }

    const usernameData = usernameDoc.data();
    const email = usernameData?.email;

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Username found but no email field',
        username: username.toLowerCase(),
        data: usernameData
      });
    }

    // Test Firebase Auth lookup
    let firebaseUser = null;
    try {
      const auth = admin.auth();
      const userRecord = await auth.getUserByEmail(email);
      firebaseUser = {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled
      };
    } catch (authError) {
      return NextResponse.json({
        success: false,
        error: 'Email found but Firebase Auth user not found',
        email,
        authError: authError.message
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Username login should work',
      username: username.toLowerCase(),
      email,
      usernameData,
      firebaseUser
    });

  } catch (error) {
    console.error('[Test] Username test error:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error.message 
    }, { status: 500 });
  }
}
