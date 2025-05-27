// Script to test fetching a user's username from both RTDB and Firestore
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getDatabase } = require('firebase-admin/database');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with fallback for missing service account file
let serviceAccount;
let app;

try {
  // Try to load from file first (for local development)
  const serviceAccountPath = path.join(__dirname, '..', 'wewrite-ccd82-firebase-adminsdk-tmduq-90269daa53.json');

  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = require(serviceAccountPath);
    console.log('Using service account file for Firebase Admin initialization');
  } else {
    throw new Error('Service account file not found');
  }
} catch (error) {
  // Fallback to environment variables (for Vercel/production)
  console.log('Service account file not found, using environment variables...');

  if (process.env.GOOGLE_CLOUD_KEY_JSON) {
    serviceAccount = JSON.parse(process.env.GOOGLE_CLOUD_KEY_JSON);
    console.log('Using GOOGLE_CLOUD_KEY_JSON environment variable');
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
    console.log('Using individual environment variables for service account');
  }
}

// Initialize Firebase Admin
app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://wewrite-ccd82-default-rtdb.firebaseio.com"
});

// Initialize Firestore and RTDB
const db = getFirestore(app);
const rtdb = getDatabase(app);

async function fetchUsernames() {
  try {
    // Get a list of users from RTDB to test
    const usersSnapshot = await rtdb.ref('users').limitToFirst(5).get();

    if (!usersSnapshot.exists()) {
      console.log('No users found in RTDB');
      return;
    }

    const usersData = usersSnapshot.val();

    console.log(`Found ${Object.keys(usersData).length} users in RTDB`);
    console.log('----------------------------------------------------');

    // Test fetching each user's username
    for (const userId in usersData) {
      console.log(`\nTesting user: ${userId}`);
      console.log('----------------------------------------------------');

      // 1. Try fetching from RTDB
      console.log('1. Checking RTDB:');
      const rtdbUserSnapshot = await rtdb.ref(`users/${userId}`).get();
      if (rtdbUserSnapshot.exists()) {
        const rtdbUserData = rtdbUserSnapshot.val();
        console.log(`   Username from RTDB: ${rtdbUserData.username || rtdbUserData.displayName || 'Not found'}`);
        console.log(`   User data from RTDB:`, JSON.stringify(rtdbUserData, null, 2).slice(0, 300) + '...');
      } else {
        console.log('   User not found in RTDB');
      }

      // 2. Try fetching from Firestore
      console.log('\n2. Checking Firestore:');
      const firestoreUserDoc = await db.collection('users').doc(userId).get();
      if (firestoreUserDoc.exists) {
        const firestoreUserData = firestoreUserDoc.data();
        console.log(`   Username from Firestore: ${firestoreUserData.username || firestoreUserData.displayName || 'Not found'}`);
        console.log(`   User data from Firestore:`, JSON.stringify(firestoreUserData, null, 2).slice(0, 300) + '...');
      } else {
        console.log('   User not found in Firestore');
      }

      // 3. Check username history
      console.log('\n3. Checking Username History:');
      try {
        const historyQuery = await db.collection('usernameHistory')
          .where('userId', '==', userId)
          .orderBy('changedAt', 'desc')
          .limit(5)
          .get();

        if (historyQuery.empty) {
          console.log('   No username history found');
        } else {
          console.log(`   Found ${historyQuery.size} username history entries:`);
          historyQuery.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`   ${index+1}. Old: ${data.oldUsername} -> New: ${data.newUsername}, Changed: ${data.changedAt?.toDate?.() || 'Unknown date'}`);
          });
        }
      } catch (error) {
        if (error.message.includes('requires an index')) {
          console.log('   Error: Missing Firestore index. Please create the required index.');
        } else {
          console.log(`   Error fetching username history: ${error.message}`);
        }
      }

      console.log('----------------------------------------------------');
    }

    // Cleanup and exit
    process.exit(0);
  } catch (error) {
    console.error('Error in script:', error);
    process.exit(1);
  }
}

// Run the script
fetchUsernames();
