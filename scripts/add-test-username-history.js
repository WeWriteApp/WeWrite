const admin = require('firebase-admin');

// Initialize Firebase Admin with fallback for missing service account file
let serviceAccount;
try {
  // Try to load from file first (for local development)
  serviceAccount = require('../wewrite-ccd82-firebase-adminsdk-tmduq-90269daa53.json');
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
  databaseURL: 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
});

const firestore = admin.firestore();
const rtdb = admin.database();

// Function to get a user from RTDB
async function getRandomUser() {
  try {
    const snapshot = await rtdb.ref('users').limitToFirst(1).once('value');
    if (!snapshot.exists()) {
      throw new Error('No users found in RTDB');
    }

    const users = snapshot.val();
    const userId = Object.keys(users)[0];
    const username = users[userId].username || users[userId].displayName || 'unknown_user';

    console.log(`Found user: ${userId} with username: ${username}`);
    return { userId, username };
  } catch (error) {
    console.error('Error getting random user:', error);
    throw error;
  }
}

// Function to add a test username history record
async function addTestUsernameHistory(userId, username) {
  try {
    // Check if history already exists
    const historySnapshot = await firestore.collection('usernameHistory')
      .where('userId', '==', userId)
      .get();

    if (!historySnapshot.empty) {
      console.log(`Username history already exists for user ${userId}. Skipping.`);
      return null;
    }

    // Create a fictional previous username
    const oldUsername = 'original_' + username;

    console.log(`Adding test username history for user ${userId}: ${oldUsername} → ${username}`);

    // Add with a timestamp from a few days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3); // 3 days ago

    const result = await firestore.collection('usernameHistory').add({
      userId,
      oldUsername,
      newUsername: username,
      changedAt: pastDate
    });

    console.log(`✅ Successfully added test username history record with ID: ${result.id}`);
    return result.id;
  } catch (error) {
    console.error('❌ Error adding test username history:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    const { userId, username } = await getRandomUser();
    await addTestUsernameHistory(userId, username);
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
main();
