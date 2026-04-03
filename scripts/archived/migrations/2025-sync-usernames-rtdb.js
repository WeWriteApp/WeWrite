/**
 * Migration: Sync usernames to RTDB from Firestore/Auth
 * 
 * This script ensures all users have a proper `username` field in RTDB.
 * It sources the username from:
 *   1. Existing RTDB username (if valid)
 *   2. Firestore users collection username
 *   3. Firestore displayName (legacy)
 *   4. RTDB displayName (legacy)
 *   5. Firebase Auth displayName
 *   6. Fallback: user_XXXXXXXX
 *
 * NOTE: We intentionally do NOT use email to generate usernames to avoid
 * exposing user email addresses.
 *
 * Run with:
 *   node scripts/migrations/2025-sync-usernames-rtdb.js
 *   node scripts/migrations/2025-sync-usernames-rtdb.js --dry-run
 *   node scripts/migrations/2025-sync-usernames-rtdb.js --execute
 *
 * Requirements:
 * - Set environment variables (use dotenv or export manually)
 * - Or run from project root with: source .env.local && node scripts/migrations/2025-sync-usernames-rtdb.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../..', '.env.local') });

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    let serviceAccount;
    
    // Use GOOGLE_CLOUD_KEY_JSON from environment
    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;
      
      // Check if base64 encoded
      if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
        jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
      }
      
      serviceAccount = JSON.parse(jsonString);
      console.log(`✅ Using service account: ${serviceAccount.client_email}`);
    } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      // Fallback to individual env vars
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
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
      };
      console.log(`✅ Using service account from env vars: ${serviceAccount.client_email}`);
    } else {
      throw new Error('Missing Firebase credentials. Set GOOGLE_CLOUD_KEY_JSON or individual FIREBASE_* env vars');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
    });
    
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin:', err.message);
    console.error('');
    console.error('Make sure to set environment variables:');
    console.error('  - GOOGLE_CLOUD_KEY_JSON (JSON string or base64)');
    console.error('  - Or: FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, etc.');
    console.error('');
    console.error('You can source your .env.local file first:');
    console.error('  source .env.local && node scripts/migrations/2025-sync-usernames-rtdb.js');
    process.exit(1);
  }
}

const db = admin.firestore();
const rtdb = admin.database();
const auth = admin.auth();

// Environment prefix for collections
const ENV_PREFIX = process.env.NEXT_PUBLIC_FIRESTORE_ENV_PREFIX || '';
const getCollectionName = (name) => ENV_PREFIX ? `${ENV_PREFIX}_${name}` : name;

const DRY_RUN = !process.argv.includes('--execute');

function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  const trimmed = username.trim();
  // Invalid if empty, contains @, or is just "user_" prefix with random chars
  if (!trimmed) return false;
  if (trimmed.includes('@')) return false;
  // Consider user_XXXXXXXX as needing update (auto-generated fallback)
  if (/^user_[a-zA-Z0-9]{8}$/i.test(trimmed)) return false;
  if (/^User [a-zA-Z0-9]{8}$/i.test(trimmed)) return false;
  return true;
}

function sanitizeUsername(raw, fallbackId) {
  if (!raw || typeof raw !== 'string') {
    return `user_${fallbackId.slice(0, 8)}`;
  }
  const trimmed = raw.trim();
  // Reject anything that looks like an email (contains @)
  if (trimmed.includes('@')) {
    return `user_${fallbackId.slice(0, 8)}`;
  }
  return trimmed || `user_${fallbackId.slice(0, 8)}`;
}

async function main() {
  console.log('');
  console.log('🔄 Username Sync Migration: RTDB');
  console.log('================================');
  console.log(`Mode: ${DRY_RUN ? '🧪 DRY RUN (no changes)' : '⚡ EXECUTE (will make changes)'}`);
  console.log('');

  const usersCollection = getCollectionName('users');
  console.log(`📁 Using collection: ${usersCollection}`);
  console.log('');
  
  // Step 1: Get all users from RTDB
  console.log('📥 Fetching users from RTDB...');
  const rtdbSnapshot = await rtdb.ref('users').get();
  const rtdbUsers = rtdbSnapshot.val() || {};
  const rtdbUserIds = Object.keys(rtdbUsers);
  console.log(`   Found ${rtdbUserIds.length} users in RTDB`);

  // Step 2: Get all users from Firestore
  console.log('📥 Fetching users from Firestore...');
  const firestoreSnapshot = await db.collection(usersCollection).get();
  const firestoreUsers = new Map();
  firestoreSnapshot.docs.forEach(doc => {
    firestoreUsers.set(doc.id, doc.data());
  });
  console.log(`   Found ${firestoreUsers.size} users in Firestore`);

  // Combine all user IDs
  const allUserIds = new Set([...rtdbUserIds, ...firestoreUsers.keys()]);
  console.log(`   Total unique users: ${allUserIds.size}`);
  console.log('');

  // Step 3: Process each user
  let needsUpdate = 0;
  let alreadyGood = 0;
  let errors = 0;
  const updates = [];

  console.log('🔍 Analyzing users...');
  
  for (const userId of allUserIds) {
    try {
      const rtdbData = rtdbUsers[userId] || {};
      const firestoreData = firestoreUsers.get(userId) || {};
      
      // Check if RTDB username is already valid
      if (isValidUsername(rtdbData.username)) {
        alreadyGood++;
        continue;
      }

      // Try to find a good username from various sources
      let newUsername = null;

      // Source 1: Firestore username
      if (isValidUsername(firestoreData.username)) {
        newUsername = firestoreData.username;
      }
      
      // Source 2: Firestore displayName (legacy)
      if (!newUsername && isValidUsername(firestoreData.displayName)) {
        newUsername = firestoreData.displayName;
      }

      // Source 3: RTDB displayName (legacy)
      if (!newUsername && isValidUsername(rtdbData.displayName)) {
        newUsername = rtdbData.displayName;
      }

      // Source 4: Try Firebase Auth displayName only (NOT email)
      if (!newUsername) {
        try {
          const authUser = await auth.getUser(userId);
          if (authUser.displayName && isValidUsername(authUser.displayName)) {
            newUsername = authUser.displayName;
          }
          // NOTE: We intentionally do NOT use email to avoid exposing user emails
        } catch (authError) {
          // User might not exist in Auth (deleted, etc.)
        }
      }

      // Fallback - use anonymized user ID
      if (!newUsername) {
        newUsername = `user_${userId.slice(0, 8)}`;
      }

      // Sanitize
      newUsername = sanitizeUsername(newUsername, userId);

      const currentUsername = rtdbData.username || '(none)';
      
      updates.push({
        userId,
        currentUsername,
        newUsername,
        source: newUsername.startsWith('user_') ? 'fallback' : 'found'
      });
      
      needsUpdate++;

    } catch (error) {
      console.error(`   ❌ Error processing ${userId}:`, error.message);
      errors++;
    }
  }

  console.log('');
  console.log('📊 Analysis Results:');
  console.log(`   ✅ Already have valid username: ${alreadyGood}`);
  console.log(`   🔄 Need username update: ${needsUpdate}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log('');

  if (updates.length === 0) {
    console.log('✨ All users already have valid usernames!');
    process.exit(0);
  }

  // Show what will be updated
  console.log('📝 Updates to be applied:');
  console.log('');
  
  const foundUpdates = updates.filter(u => u.source === 'found');
  const fallbackUpdates = updates.filter(u => u.source === 'fallback');
  
  console.log(`   Found real usernames for ${foundUpdates.length} users:`);
  foundUpdates.slice(0, 20).forEach(u => {
    console.log(`     ${u.userId.slice(0, 12)}... : "${u.currentUsername}" → "${u.newUsername}"`);
  });
  if (foundUpdates.length > 20) {
    console.log(`     ... and ${foundUpdates.length - 20} more`);
  }
  
  console.log('');
  console.log(`   Using fallback for ${fallbackUpdates.length} users:`);
  fallbackUpdates.slice(0, 10).forEach(u => {
    console.log(`     ${u.userId.slice(0, 12)}... : "${u.currentUsername}" → "${u.newUsername}"`);
  });
  if (fallbackUpdates.length > 10) {
    console.log(`     ... and ${fallbackUpdates.length - 10} more`);
  }
  
  console.log('');

  if (DRY_RUN) {
    console.log('🧪 DRY RUN - No changes made.');
    console.log('   Run with --execute to apply changes.');
    process.exit(0);
  }

  // Apply updates
  console.log('⚡ Applying updates to RTDB...');
  
  let successCount = 0;
  let failCount = 0;

  for (const update of updates) {
    try {
      await rtdb.ref(`users/${update.userId}`).update({
        username: update.newUsername
      });
      successCount++;
      
      if (successCount % 50 === 0) {
        console.log(`   Progress: ${successCount}/${updates.length}`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to update ${update.userId}:`, error.message);
      failCount++;
    }
  }

  console.log('');
  console.log('✅ Migration complete!');
  console.log(`   Successfully updated: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
