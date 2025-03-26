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

async function checkSpecificUser() {
  try {
    // User ID to check
    const userId = 'nhEjIBP5SSc7KWcDXzuS5zpEjiE3';
    
    console.log(`🔍 Checking user ID: ${userId}`);
    
    // Check RTDB
    console.log('\n📊 Checking user in RTDB:');
    const userSnapshot = await rtdb.ref(`users/${userId}`).get();
    
    if (!userSnapshot.exists()) {
      console.log(`❌ User ${userId} not found in RTDB`);
    } else {
      const userData = userSnapshot.val();
      console.log('✅ User data from RTDB:');
      console.log(JSON.stringify(userData, null, 2));
      
      // Check if username exists
      if (userData.username) {
        console.log(`✅ Username found: ${userData.username}`);
      } else {
        console.log('❌ No username field found for this user');
        console.log('Available fields:', Object.keys(userData).join(', '));
      }
    }
    
    // Check Firestore Auth
    console.log('\n📊 Checking user in Firestore Auth:');
    try {
      const userRecord = await admin.auth().getUser(userId);
      console.log('✅ User found in Firebase Auth:');
      console.log(JSON.stringify(userRecord.toJSON(), null, 2));
      
      if (userRecord.displayName) {
        console.log(`✅ Display name found: ${userRecord.displayName}`);
      } else {
        console.log('❌ No display name found in Auth record');
      }
    } catch (authErr) {
      console.log(`❌ Error getting Auth user: ${authErr.message}`);
    }
    
    // Check username history
    console.log('\n📊 Checking username history in Firestore:');
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
    
    // Check usernames collection
    console.log('\n📊 Checking usernames collection in Firestore:');
    const usernamesSnapshot = await db.collection('usernames')
      .where('userId', '==', userId)
      .get();
    
    if (usernamesSnapshot.empty) {
      console.log('❌ No username entries found for this user in usernames collection');
    } else {
      console.log(`✅ Found ${usernamesSnapshot.size} username entries:`);
      
      usernamesSnapshot.docs.forEach((doc, index) => {
        console.log(`\n📝 Username Entry #${index + 1}:`);
        console.log(`   Username: ${doc.id}`);
        console.log(`   Data: ${JSON.stringify(doc.data())}`);
      });
    }
    
    console.log('\n✅ Check complete!');
  } catch (error) {
    console.error('❌ Error during check:', error);
  } finally {
    process.exit(0);
  }
}

checkSpecificUser();
