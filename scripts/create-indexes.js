const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK with service account
async function createIndexes() {
  try {
    console.log('Creating Firestore indexes for WeWrite app...');

    // Initialize Firebase Admin with the service account
    let serviceAccount;
    try {
      // Try to load from file first (for local development)
      serviceAccount = require('../service-account-key.json');
    } catch (error) {
      // Fallback to environment variables (for Vercel/production)
      if (process.env.GOOGLE_CLOUD_KEY_JSON) {
        serviceAccount = JSON.parse(process.env.GOOGLE_CLOUD_KEY_JSON);
      } else {
        // Create service account from individual environment variables
        serviceAccount = {
          type: 'service_account',
          project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82',
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
        };
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'wewrite-ccd82'
    });

    // Get Firestore instance
    const firestore = admin.firestore();

    console.log('Connected to Firestore. Creating index...');

    // Unfortunately, Firebase Admin SDK doesn't provide a direct way to create indexes
    // We'll need to use the Firebase CLI or Firebase Console to create the index

    console.log(`
✅ Firebase Admin SDK initialized successfully!

To create the required index, please follow one of these options:

1. Use the Firebase Console:
   - Go to: https://console.firebase.google.com/project/wewrite-ccd82/firestore/indexes
   - Click "Add Index"
   - Collection ID: usernameHistory
   - Fields to index:
     - userId (Ascending)
     - changedAt (Descending)
   - Query scope: Collection

2. Use the Firebase CLI:
   - Install Firebase CLI: npm install -g firebase-tools
   - Login: firebase login
   - Create a firestore.indexes.json file with the index configuration
   - Deploy: firebase deploy --only firestore:indexes

The index creation process may take a few minutes to complete.
    `);

    // Let's check if we can query the collection to see if it exists
    try {
      const snapshot = await firestore.collection('usernameHistory').limit(1).get();
      console.log(`Collection 'usernameHistory' ${snapshot.empty ? 'is empty' : 'has documents'}.`);
    } catch (error) {
      console.log(`Could not query 'usernameHistory' collection: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createIndexes();
