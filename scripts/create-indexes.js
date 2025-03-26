const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK with service account
async function createIndexes() {
  try {
    console.log('Creating Firestore indexes for WeWrite app...');
    
    // Initialize Firebase Admin with the service account
    const serviceAccount = require('../service-account-key.json');
    
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
