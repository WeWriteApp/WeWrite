/**
 * Migrate test users from production collections to DEV_ collections
 * 
 * Usage: node scripts/migrate-test-users.js [--dry-run] [--delete-only]
 * 
 * Options:
 *   --dry-run      Show what would be done without making changes
 *   --delete-only  Only delete from production, don't copy to DEV_
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Test usernames to migrate (exact match)
const TEST_USERNAMES = ['2025_12_05_test', 'test1', '2025_12_05_test2', 'test'];

const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_ONLY = process.argv.includes('--delete-only');

async function init() {
  if (admin.apps.length) return admin;
  
  const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON;
  if (!base64Json) {
    console.error('Missing GOOGLE_CLOUD_KEY_JSON');
    process.exit(1);
  }
  
  const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
  const serviceAccount = JSON.parse(decodedJson);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  return admin;
}

async function main() {
  console.log('=== Migrate Test Users from Production to DEV_ ===');
  console.log('Mode:', DRY_RUN ? 'DRY RUN (no changes)' : DELETE_ONLY ? 'DELETE ONLY' : 'FULL MIGRATION');
  console.log('Test usernames:', TEST_USERNAMES.join(', '));
  console.log('');
  
  await init();
  const db = admin.firestore();
  
  // Find test users in PRODUCTION collections
  console.log('--- Checking PRODUCTION collections ---');
  
  for (const username of TEST_USERNAMES) {
    console.log(`\nLooking for user: ${username}`);
    
    // Check users collection
    const usersSnapshot = await db.collection('users')
      .where('username', '==', username)
      .get();
    
    if (usersSnapshot.empty) {
      console.log(`  ✓ Not found in 'users' collection`);
      continue;
    }
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const uid = doc.id;
      console.log(`  ✗ FOUND in 'users' collection:`);
      console.log(`    - UID: ${uid}`);
      console.log(`    - Email: ${userData.email}`);
      console.log(`    - Username: ${userData.username}`);
      console.log(`    - Created: ${userData.createdAt?.toDate?.() || userData.createdAt}`);
      
      if (DRY_RUN) {
        console.log(`    [DRY RUN] Would migrate this user`);
        continue;
      }
      
      // Copy to DEV_users (unless delete-only)
      if (!DELETE_ONLY) {
        console.log(`    → Copying to DEV_users...`);
        await db.collection('DEV_users').doc(uid).set(userData);
        console.log(`    ✓ Copied to DEV_users/${uid}`);
      }
      
      // Delete from production users
      console.log(`    → Deleting from users...`);
      await db.collection('users').doc(uid).delete();
      console.log(`    ✓ Deleted from users/${uid}`);
    }
    
    // Check usernames collection
    const usernameDoc = await db.collection('usernames').doc(username.toLowerCase()).get();
    if (usernameDoc.exists) {
      const usernameData = usernameDoc.data();
      console.log(`  ✗ FOUND in 'usernames' collection`);
      
      if (DRY_RUN) {
        console.log(`    [DRY RUN] Would migrate username mapping`);
        continue;
      }
      
      // Copy to DEV_usernames (unless delete-only)
      if (!DELETE_ONLY) {
        console.log(`    → Copying to DEV_usernames...`);
        await db.collection('DEV_usernames').doc(username.toLowerCase()).set(usernameData);
        console.log(`    ✓ Copied to DEV_usernames/${username.toLowerCase()}`);
      }
      
      // Delete from production usernames
      console.log(`    → Deleting from usernames...`);
      await db.collection('usernames').doc(username.toLowerCase()).delete();
      console.log(`    ✓ Deleted from usernames/${username.toLowerCase()}`);
    } else {
      console.log(`  ✓ Not found in 'usernames' collection`);
    }
  }
  
  // Also check Firebase Auth for these users (we can't delete via this script due to jose issues)
  console.log('\n--- Firebase Auth Check ---');
  console.log('Note: Firebase Auth users must be deleted manually from Firebase Console');
  console.log('if they exist. This script only handles Firestore data.');
  
  console.log('\n=== Migration Complete ===');
  if (DRY_RUN) {
    console.log('This was a DRY RUN. Run without --dry-run to apply changes.');
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
