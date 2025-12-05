const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  // GOOGLE_CLOUD_KEY_JSON is base64 encoded in this project
  const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON;
  
  if (!base64Json) {
    console.error('No Firebase credentials found. Need GOOGLE_CLOUD_KEY_JSON');
    process.exit(1);
  }
  
  const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
  const serviceAccount = JSON.parse(decodedJson);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Check for mode
const mode = process.argv[2];

async function checkTestUsers() {
  console.log('=== CHECKING PRODUCTION users COLLECTION ===');
  const prodUsers = await db.collection('users').get();
  console.log('Production users count:', prodUsers.size);
  
  const testUsers = [];
  prodUsers.forEach(doc => {
    const data = doc.data();
    const username = (data.username || '').toLowerCase();
    const email = (data.email || '').toLowerCase();
    // Look for test-like usernames
    if (username.includes('test') || username.includes('2025_') || email.includes('test')) {
      testUsers.push({
        id: doc.id,
        username: data.username || '',
        email: data.email || '',
        createdAt: data.createdAt
      });
    }
  });
  
  console.log('\nTest-like users in PRODUCTION:', testUsers.length);
  testUsers.forEach(u => {
    console.log('  -', u.username, '(' + u.email + ') - ID:', u.id);
  });
  
  console.log('\n=== CHECKING DEV_users COLLECTION ===');
  const devUsers = await db.collection('DEV_users').get();
  console.log('DEV_users count:', devUsers.size);
  
  const devTestUsers = [];
  devUsers.forEach(doc => {
    const data = doc.data();
    devTestUsers.push({
      id: doc.id,
      username: data.username || '(none)',
      email: data.email || '(none)'
    });
  });
  
  console.log('Users in DEV_users:');
  devTestUsers.slice(0, 20).forEach(u => {
    console.log('  -', u.username, '(' + u.email + ')');
  });
  
  return testUsers;
}

async function migrateTestUsers() {
  const testUsers = await checkTestUsers();
  
  if (testUsers.length === 0) {
    console.log('\nNo test users to migrate!');
    return;
  }
  
  if (mode !== '--migrate') {
    console.log('\nTo migrate these users to DEV_users, run:');
    console.log('  node scripts/check-user-cleanup.js --migrate');
    return;
  }
  
  console.log('\n=== MIGRATING TEST USERS FROM PRODUCTION TO DEV ===');
  
  for (const user of testUsers) {
    console.log('\nMigrating:', user.username);
    
    // 1. Copy user doc to DEV_users
    const prodDoc = await db.collection('users').doc(user.id).get();
    const userData = prodDoc.data();
    await db.collection('DEV_users').doc(user.id).set(userData);
    console.log('  - Copied to DEV_users');
    
    // 2. Copy username mapping to DEV_usernames
    if (userData.username) {
      const usernameKey = userData.username.toLowerCase();
      const prodUsernameDoc = await db.collection('usernames').doc(usernameKey).get();
      if (prodUsernameDoc.exists) {
        await db.collection('DEV_usernames').doc(usernameKey).set(prodUsernameDoc.data());
        console.log('  - Copied username mapping to DEV_usernames');
        
        // Delete from production usernames
        await db.collection('usernames').doc(usernameKey).delete();
        console.log('  - Deleted from production usernames');
      }
    }
    
    // 3. Delete from production users
    await db.collection('users').doc(user.id).delete();
    console.log('  - Deleted from production users');
  }
  
  console.log('\n✅ Migration complete!');
}

migrateTestUsers().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
