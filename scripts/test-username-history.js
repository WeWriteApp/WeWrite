const admin = require('firebase-admin');

// Initialize Firebase Admin with fallback for missing service account file
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

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

// Function to add a test username change record
async function addTestUsernameChange(userId, oldUsername, newUsername) {
  try {
    console.log(`Adding test username change for user ${userId}: ${oldUsername} -> ${newUsername}`);

    const result = await firestore.collection('usernameHistory').add({
      userId,
      oldUsername,
      newUsername,
      changedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Successfully added test username change with ID: ${result.id}`);
    return result.id;
  } catch (error) {
    console.error('❌ Error adding test username change:', error);
    throw error;
  }
}

// Function to get a user by username
async function getUserByUsername(username) {
  try {
    console.log(`Looking up user with username: ${username}`);

    // Query the 'usernames' collection to find the user ID
    const usernameDoc = await firestore.collection('usernames').doc(username.toLowerCase()).get();

    if (!usernameDoc.exists) {
      console.log(`❌ No user found with username: ${username}`);
      return null;
    }

    const userId = usernameDoc.data().uid;
    console.log(`✅ Found user with ID: ${userId}`);

    return userId;
  } catch (error) {
    console.error('❌ Error looking up user:', error);
    throw error;
  }
}

// Main function to run the test
async function runTest() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log('Usage:');
      console.log('  node test-username-history.js <username> [oldUsername] [newUsername]');
      console.log('  - If only username is provided, it will list the user ID');
      console.log('  - If all parameters are provided, it will add a test username change');
      return;
    }

    const username = args[0];
    const userId = await getUserByUsername(username);

    if (!userId) {
      console.log(`❌ Could not find user with username: ${username}`);
      return;
    }

    // If old and new usernames are provided, add a test record
    if (args.length >= 3) {
      const oldUsername = args[1];
      const newUsername = args[2];

      await addTestUsernameChange(userId, oldUsername, newUsername);
    } else {
      console.log(`User ID for ${username}: ${userId}`);

      // List any existing username history
      const historySnapshot = await firestore.collection('usernameHistory')
        .where('userId', '==', userId)
        .orderBy('changedAt', 'desc')
        .get();

      if (historySnapshot.empty) {
        console.log('No username history found for this user.');
      } else {
        console.log('Username history:');
        historySnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log(`- ${data.oldUsername} -> ${data.newUsername} (${doc.id})`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error running test:', error);
  } finally {
    // Ensure the process exits
    process.exit(0);
  }
}

// Run the test
runTest();
