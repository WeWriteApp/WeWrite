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

  console.log('Environment variables check:');
  console.log('FIREBASE_TYPE:', process.env.FIREBASE_TYPE ? '✅' : '❌');
  console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✅' : '❌');
  console.log('FIREBASE_PRIVATE_KEY_ID:', process.env.FIREBASE_PRIVATE_KEY_ID ? '✅' : '❌');
  console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✅' : '❌');
  console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✅' : '❌');
  console.log('FIREBASE_CLIENT_ID:', process.env.FIREBASE_CLIENT_ID ? '✅' : '❌');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
  });
}

async function testFirebaseAdmin() {
  try {
    console.log('Testing Firebase Admin SDK authentication...');

    // Test Firestore access
    const db = admin.firestore();
    const testDoc = await db.collection('test').doc('auth-test').get();
    console.log('✅ Firestore access successful');

    // Test Realtime Database access
    const rtdb = admin.database();
    const testRef = rtdb.ref('test/auth-test');
    await testRef.once('value');
    console.log('✅ Realtime Database access successful');

    console.log('🎉 Firebase Admin SDK authentication working correctly!');

  } catch (error) {
    console.error('❌ Firebase Admin SDK authentication failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testFirebaseAdmin();
