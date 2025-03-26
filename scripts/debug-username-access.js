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

async function debugUsernameAccess() {
  try {
    console.log('🔍 Starting username access debugging...');
    
    // List all users in RTDB to find a valid user ID
    console.log('\n📊 Listing users from RTDB:');
    const usersSnapshot = await rtdb.ref('users').limitToFirst(5).get();
    
    if (!usersSnapshot.exists()) {
      console.log('❌ No users found in RTDB');
      return;
    }
    
    const usersData = usersSnapshot.val();
    console.log(`✅ Found ${Object.keys(usersData).length} users in RTDB`);
    
    // Pick the first user ID
    const userId = Object.keys(usersData)[0];
    console.log(`🧪 Using user ID: ${userId}`);
    
    // Get user data from RTDB
    console.log('\n📊 Fetching user data from RTDB:');
    const userSnapshot = await rtdb.ref(`users/${userId}`).get();
    
    if (!userSnapshot.exists()) {
      console.log(`❌ User ${userId} not found in RTDB`);
      return;
    }
    
    const userData = userSnapshot.val();
    console.log('✅ User data from RTDB:');
    console.log(JSON.stringify(userData, null, 2));
    
    // Check if username exists
    if (userData.username) {
      console.log(`✅ Username found: ${userData.username}`);
    } else if (userData.displayName) {
      console.log(`✅ DisplayName found (as fallback): ${userData.displayName}`);
    } else {
      console.log('❌ No username or displayName found for this user');
    }
    
    // Get username history from Firestore
    console.log('\n📊 Fetching username history from Firestore:');
    const historySnapshot = await db.collection('usernameHistory')
      .where('userId', '==', userId)
      .orderBy('changedAt', 'desc')
      .get();
    
    if (historySnapshot.empty) {
      console.log('❌ No username history found for this user');
    } else {
      console.log(`✅ Found ${historySnapshot.size} username history entries:`);
      
      historySnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n📝 History Entry #${index + 1}:`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   Old Username: ${data.oldUsername}`);
        console.log(`   New Username: ${data.newUsername}`);
        console.log(`   Changed At: ${data.changedAt ? data.changedAt.toDate() : 'Unknown'}`);
      });
    }
    
    // Check Firestore indexes
    console.log('\n📊 Checking Firestore indexes:');
    try {
      const indexes = await db.listCollectionGroupIndexes('usernameHistory');
      console.log('✅ Available indexes for usernameHistory:');
      console.log(JSON.stringify(indexes, null, 2));
    } catch (indexErr) {
      console.log(`❌ Error checking indexes: ${indexErr.message}`);
    }
    
    console.log('\n✅ Debugging complete!');
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    process.exit(0);
  }
}

debugUsernameAccess();
