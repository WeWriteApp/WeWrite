const admin = require('firebase-admin');
const serviceAccount = require('../wewrite-ccd82-firebase-adminsdk-tmduq-90269daa53.json');

// Initialize Firebase Admin
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
      errors: 0
    };
    
    // Process each user
    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      const userId = user.uid;
      const displayName = user.displayName;
      
      console.log(`\n👤 Processing user ${i+1}/${allUsers.length}: ${userId}`);
      
      try {
        // Check if user exists in RTDB
        const userSnapshot = await rtdb.ref(`users/${userId}`).get();
        
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          
          // If user has displayName in Auth but no username in RTDB, migrate it
          if (displayName && !userData.username) {
            stats.withDisplayName++;
            console.log(`   Auth displayName: ${displayName}`);
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
          // If user has username in RTDB but no displayName in Auth, we're good
          else if (userData.username && !displayName) {
            stats.withUsername++;
            console.log(`   RTDB username: ${userData.username}`);
            console.log(`   ✅ User already has username in RTDB but no displayName in Auth, no action needed`);
          }
          // If user has both username and displayName, we'll keep the username
          else if (userData.username && displayName) {
            stats.withUsername++;
            stats.withDisplayName++;
            console.log(`   RTDB username: ${userData.username}`);
            console.log(`   Auth displayName: ${displayName}`);
            
            if (userData.username !== displayName) {
              console.log(`   ⚠️ Username (${userData.username}) and displayName (${displayName}) are different`);
              console.log(`   ➡️ Keeping RTDB username: ${userData.username}`);
              
              // Record this discrepancy for reference
              await db.collection('usernameDiscrepancies').add({
                userId,
                rtdbUsername: userData.username,
                authDisplayName: displayName,
                detectedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
              console.log(`   ✅ Username and displayName match, no changes needed`);
            }
          }
          // If user has neither username nor displayName, generate a default username
          else if (!userData.username && !displayName) {
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
            
            // Add to usernames collection in Firestore for uniqueness tracking
            await db.collection('usernames').doc(defaultUsername.toLowerCase()).set({
              userId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`   ✅ Set default username in RTDB: ${defaultUsername}`);
            stats.migrated++;
          }
        } else {
          // User doesn't exist in RTDB but exists in Auth
          console.log(`   ❌ User not found in RTDB`);
          
          // Create a new user entry in RTDB
          let username = '';
          
          if (displayName) {
            stats.withDisplayName++;
            username = displayName;
            console.log(`   Auth displayName: ${displayName}`);
          } else {
            // Generate a default username based on email or uid
            if (user.email) {
              username = user.email.split('@')[0];
            } else {
              username = `user_${userId.substring(0, 8)}`;
            }
            
            console.log(`   ➡️ Generating default username: ${username}`);
            
            // Check if username is already taken
            const usernameDoc = await db.collection('usernames').doc(username.toLowerCase()).get();
            
            if (usernameDoc.exists) {
              // Username is taken, add random suffix
              username = `${username}_${Math.floor(Math.random() * 1000)}`;
              console.log(`   ⚠️ Username taken, using: ${username}`);
            }
          }
          
          // Create user in RTDB with username
          await rtdb.ref(`users/${userId}`).set({
            username: username,
            uid: userId,
            created: Date.now()
          });
          
          // Add to usernames collection in Firestore for uniqueness tracking
          await db.collection('usernames').doc(username.toLowerCase()).set({
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          console.log(`   ✅ Created new RTDB user with username: ${username}`);
          stats.migrated++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing user ${userId}:`, error);
        stats.errors++;
      }
    }
    
    // Print statistics
    console.log('\n📊 Migration Statistics:');
    console.log(`   Total users: ${stats.total}`);
    console.log(`   Users with displayName in Auth: ${stats.withDisplayName}`);
    console.log(`   Users with username in RTDB: ${stats.withUsername}`);
    console.log(`   Users migrated: ${stats.migrated}`);
    console.log(`   Errors: ${stats.errors}`);
    
    console.log('\n✅ Migration complete!');
    
    console.log('\n⚠️ IMPORTANT: Firebase Auth displayName field cannot be removed completely.');
    console.log('   However, you should update all code to only use the username field from RTDB.');
    console.log('   The displayName field in Auth will remain but should be ignored in your code.');
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    process.exit(0);
  }
}

migrateDisplayNameToUsername();
