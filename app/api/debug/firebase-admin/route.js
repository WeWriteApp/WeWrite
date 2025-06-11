import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getUserIdFromRequest } from '../../auth-helper';

export async function GET(request) {
  try {
    // Check if Firebase Admin is initialized
    const admin = getFirebaseAdmin();
    
    if (!admin) {
      return NextResponse.json({
        error: 'Firebase Admin not initialized',
        details: 'getFirebaseAdmin() returned null',
        suggestions: [
          'Check environment variables',
          'Verify service account credentials',
          'Check Firebase project configuration'
        ]
      }, { status: 500 });
    }

    // Test basic admin functionality
    const testResults = {
      adminInitialized: !!admin,
      hasAuth: !!admin.auth,
      hasFirestore: !!admin.firestore,
      projectId: admin.options?.projectId || 'unknown'
    };

    // Test user authentication
    let authTest = null;
    try {
      const userId = await getUserIdFromRequest(request);
      authTest = {
        userIdFound: !!userId,
        userId: userId ? `${userId.substring(0, 8)}...` : null
      };

      // If we have a user ID, test Firebase Auth access
      if (userId) {
        try {
          const userRecord = await admin.auth().getUser(userId);
          authTest.userRecordFound = true;
          authTest.userEmail = userRecord.email;
        } catch (userError) {
          authTest.userRecordError = userError.message;
        }
      }
    } catch (authError) {
      authTest = {
        error: authError.message
      };
    }

    // Test Firestore access
    let firestoreTest = null;
    try {
      const db = admin.firestore();
      // Try to read a simple document (this will test permissions)
      const testDoc = await db.collection('test').doc('permissions-test').get();
      firestoreTest = {
        canAccessFirestore: true,
        testDocExists: testDoc.exists
      };
    } catch (firestoreError) {
      firestoreTest = {
        error: firestoreError.message,
        code: firestoreError.code
      };
    }

    return NextResponse.json({
      status: 'Firebase Admin Debug Info',
      timestamp: new Date().toISOString(),
      admin: testResults,
      auth: authTest,
      firestore: firestoreTest,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasGoogleCloudKey: !!process.env.GOOGLE_CLOUD_KEY_JSON
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Debug endpoint failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
