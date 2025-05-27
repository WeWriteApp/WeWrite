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

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://wewrite-ccd82-default-rtdb.firebaseio.com"
  });
}

// Get database references
const db = admin.firestore();
const rtdb = admin.database();
const auth = admin.auth();

async function migrateDisplayNameToUsername() {
  try {
    console.log('🔄 Starting migration of displayName to username...');

    // Get all users from Firebase Auth
    console.log('\n📊 Fetching users from Firebase Auth...');

    // We need to handle pagination for large user bases
    let allUsers = [];
    let nextPageToken;

    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      allUsers = allUsers.concat(listUsersResult.users);
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`✅ Found ${allUsers.length} users in Firebase Auth`);

    // Track statistics
    let stats = {
      total: allUsers.length,
      withDisplayName: 0,
      withUsername: 0,
      migrated: 0,
      errors: 0,
      noChangesNeeded: 0
    };

    // Process each user
    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      const userId = user.uid;
      const displayName = user.displayName;

      console.log(`\n👤 Processing user ${i+1}/${allUsers.length}: ${userId}`);

      // Check if user has displayName in Auth
      if (displayName) {
        stats.withDisplayName++;
        console.log(`   Auth displayName: ${displayName}`);

        // Check if user exists in RTDB
        const userSnapshot = await rtdb.ref(`users/${userId}`).get();

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();

          // Check if user already has username in RTDB
          if (userData.username) {
            stats.withUsername++;
            console.log(`   RTDB username: ${userData.username}`);

            // If username and displayName are different, update username history
            if (userData.username !== displayName) {
              console.log(`   ⚠️ Username (${userData.username}) and displayName (${displayName}) are different`);
              console.log(`   ➡️ Keeping existing username: ${userData.username}`);

              // Record this discrepancy for manual review
              await db.collection('usernameDiscrepancies').add({
                userId,
                rtdbUsername: userData.username,
                authDisplayName: displayName,
                detectedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              // Update Auth displayName to match RTDB username
              await auth.updateUser(userId, {
                displayName: userData.username
              });
              console.log(`   ✅ Updated Auth displayName to match RTDB username: ${userData.username}`);
              stats.migrated++;
            } else {
              console.log(`   ✅ Username and displayName match, no changes needed`);
              stats.noChangesNeeded++;
            }
          } else {
            // User has no username in RTDB, migrate displayName to username
            console.log(`   ❌ No username in RTDB, migrating displayName: ${displayName}`);

            // Update RTDB with username from Auth displayName
            await rtdb.ref(`users/${userId}`).update({
              username: displayName
            });

            // Add to usernames collection in Firestore for uniqueness tracking
            await db.collection('usernames').doc(displayName.toLowerCase()).set({
              userId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`   ✅ Migrated Auth displayName to RTDB username: ${displayName}`);
            stats.migrated++;
          }
        } else {
          // User doesn't exist in RTDB, create new entry
          console.log(`   ❌ User not found in RTDB, creating new entry`);

          // Create user in RTDB with username from Auth displayName
          await rtdb.ref(`users/${userId}`).set({
            username: displayName,
            uid: userId,
            created: Date.now()
          });

          // Add to usernames collection in Firestore for uniqueness tracking
          await db.collection('usernames').doc(displayName.toLowerCase()).set({
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`   ✅ Created new RTDB user with username: ${displayName}`);
          stats.migrated++;
        }
      } else {
        // User has no displayName in Auth
        console.log(`   ❌ No displayName in Auth`);

        // Check if user exists in RTDB
        const userSnapshot = await rtdb.ref(`users/${userId}`).get();

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();

          // Check if user has username in RTDB
          if (userData.username) {
            stats.withUsername++;
            console.log(`   RTDB username: ${userData.username}`);

            // Update Auth displayName to match RTDB username
            await auth.updateUser(userId, {
              displayName: userData.username
            });

            console.log(`   ✅ Updated Auth displayName to match RTDB username: ${userData.username}`);
            stats.migrated++;
          } else {
            console.log(`   ⚠️ No username in RTDB and no displayName in Auth`);

            // Generate a default username based on email or uid
            let defaultUsername = '';
            if (user.email) {
              defaultUsername = user.email.split('@')[0];
            } else {
              defaultUsername = `user_${userId.substring(0, 8)}`;
            }

            console.log(`   ➡️ Generating default username: ${defaultUsername}`);

            // Check if username is already taken
            const usernameDoc = await db.collection('usernames').doc(defaultUsername.toLowerCase()).get();

            if (usernameDoc.exists) {
              // Username is taken, add random suffix
              defaultUsername = `${defaultUsername}_${Math.floor(Math.random() * 1000)}`;
              console.log(`   ⚠️ Username taken, using: ${defaultUsername}`);
            }

            // Update RTDB with default username
            await rtdb.ref(`users/${userId}`).update({
              username: defaultUsername
            });

            // Update Auth displayName to match default username
            await auth.updateUser(userId, {
              displayName: defaultUsername
            });

            // Add to usernames collection in Firestore for uniqueness tracking
            await db.collection('usernames').doc(defaultUsername.toLowerCase()).set({
              userId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`   ✅ Set default username in both Auth and RTDB: ${defaultUsername}`);
            stats.migrated++;
          }
        } else {
          console.log(`   ⚠️ User not found in RTDB and no displayName in Auth`);

          // Generate a default username based on email or uid
          let defaultUsername = '';
          if (user.email) {
            defaultUsername = user.email.split('@')[0];
          } else {
            defaultUsername = `user_${userId.substring(0, 8)}`;
          }

          console.log(`   ➡️ Generating default username: ${defaultUsername}`);

          // Check if username is already taken
          const usernameDoc = await db.collection('usernames').doc(defaultUsername.toLowerCase()).get();

          if (usernameDoc.exists) {
            // Username is taken, add random suffix
            defaultUsername = `${defaultUsername}_${Math.floor(Math.random() * 1000)}`;
            console.log(`   ⚠️ Username taken, using: ${defaultUsername}`);
          }

          // Create user in RTDB with default username
          await rtdb.ref(`users/${userId}`).set({
            username: defaultUsername,
            uid: userId,
            created: Date.now()
          });

          // Update Auth displayName to match default username
          await auth.updateUser(userId, {
            displayName: defaultUsername
          });

          // Add to usernames collection in Firestore for uniqueness tracking
          await db.collection('usernames').doc(defaultUsername.toLowerCase()).set({
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`   ✅ Created new RTDB user with default username: ${defaultUsername}`);
          stats.migrated++;
        }
      }
    }

    // Print statistics
    console.log('\n📊 Migration Statistics:');
    console.log(`   Total users: ${stats.total}`);
    console.log(`   Users with displayName in Auth: ${stats.withDisplayName}`);
    console.log(`   Users with username in RTDB: ${stats.withUsername}`);
    console.log(`   Users migrated: ${stats.migrated}`);
    console.log(`   Users with no changes needed: ${stats.noChangesNeeded}`);
    console.log(`   Errors: ${stats.errors}`);

    console.log('\n✅ Migration complete!');

    // Note: We're not actually deleting the displayName field from Auth
    // as it's a standard field in Firebase Auth that can't be removed.
    // Instead, we're ensuring it always matches the username field in RTDB.
    console.log('\n⚠️ Note: displayName field in Firebase Auth cannot be deleted.');
    console.log('   Instead, we\'ve ensured it matches the username field in RTDB.');
    console.log('   Going forward, always update both fields when changing usernames.');
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    process.exit(0);
  }
}

migrateDisplayNameToUsername();
