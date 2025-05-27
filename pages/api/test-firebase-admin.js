import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
  });
}

export default async function handler(req, res) {
  try {
    // Check environment variables
    const envCheck = {
      FIREBASE_TYPE: !!process.env.FIREBASE_TYPE,
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      FIREBASE_PRIVATE_KEY_ID: !!process.env.FIREBASE_PRIVATE_KEY_ID,
      FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_CLIENT_ID: !!process.env.FIREBASE_CLIENT_ID,
    };

    console.log('Environment variables check:', envCheck);

    // Test Firestore access
    const db = admin.firestore();
    const testDoc = await db.collection('test').doc('auth-test').get();

    // Test Realtime Database access
    const rtdb = admin.database();
    const testRef = rtdb.ref('test/auth-test');
    await testRef.once('value');

    res.status(200).json({
      success: true,
      message: 'Firebase Admin SDK authentication working correctly!',
      environmentVariables: envCheck,
      timestamp: new Date().toISOString(),
      testCommit: 'Testing dev branch preview deployment'
    });

  } catch (error) {
    console.error('Firebase Admin SDK authentication failed:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      environmentVariables: {
        FIREBASE_TYPE: !!process.env.FIREBASE_TYPE,
        FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
        FIREBASE_PRIVATE_KEY_ID: !!process.env.FIREBASE_PRIVATE_KEY_ID,
        FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
        FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_CLIENT_ID: !!process.env.FIREBASE_CLIENT_ID,
      },
      timestamp: new Date().toISOString()
    });
  }
}
