/**
 * Migration: Sync usernames to RTDB from Firestore/Auth
 * 
 * This script ensures all users have a proper `username` field in RTDB.
 * It sources the username from:
 *   1. Existing RTDB username (if valid)
 *   2. Firestore users collection username
 *   3. Firebase Auth displayName
 *   4. Email prefix (before @)
 *   5. Fallback: user_XXXXXXXX
 *
 * Run with:
 *   node scripts/migrations/2025-sync-usernames-rtdb.js
 *   node scripts/migrations/2025-sync-usernames-rtdb.js --dry-run
 *   node scripts/migrations/2025-sync-usernames-rtdb.js --execute
 *
 * Requirements:
 * - GOOGLE_CLOUD_KEY_JSON (base64 or raw JSON) available in env
 */

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const { getFirebaseAdmin } = require('../firebase/firebaseAdmin');
const { getCollectionName } = require('../utils/environmentConfig');

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
  // If it's an email, extract prefix
  if (trimmed.includes('@')) {
    const prefix = trimmed.split('@')[0];
    return prefix || `user_${fallbackId.slice(0, 8)}`;
  }
  return trimmed || `user_${fallbackId.slice(0, 8)}`;
}

async function main() {
  console.log('🔄 Username Sync Migration: RTDB');
  console.log('================================');
  console.log(`Mode: ${DRY_RUN ? '🧪 DRY RUN (no changes)' : '⚡ EXECUTE (will make changes)'}`);
  console.log('');

  const admin = getFirebaseAdmin();
  if (!admin) {
    console.error('❌ Firebase Admin not initialized. Check GOOGLE_CLOUD_KEY_JSON.');
    process.exit(1);
  }

  const db = admin.firestore();
  const rtdb = admin.database();
  const auth = admin.auth();
  
  const usersCollection = getCollectionName('users');
  
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

      // Source 4: Try Firebase Auth
      if (!newUsername) {
        try {
          const authUser = await auth.getUser(userId);
          if (authUser.displayName && isValidUsername(authUser.displayName)) {
            newUsername = authUser.displayName;
          } else if (authUser.email) {
            const emailPrefix = authUser.email.split('@')[0];
            if (emailPrefix && !emailPrefix.includes('.')) {
              newUsername = emailPrefix;
            }
          }
        } catch (authError) {
          // User might not exist in Auth (deleted, etc.)
        }
      }

      // Source 5: Email from Firestore/RTDB
      if (!newUsername) {
        const email = firestoreData.email || rtdbData.email;
        if (email) {
          const prefix = email.split('@')[0];
          if (prefix && prefix.length > 2) {
            newUsername = prefix;
          }
        }
      }

      // Fallback
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
    return;
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
    return;
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
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
