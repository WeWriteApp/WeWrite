/**
 * Fix DEV_users usernames
 *
 * This script ensures all DEV_users have a proper username field set.
 * It will:
 * 1. Copy displayName to username if username is missing but displayName exists
 * 2. Generate a username from email if both are missing
 * 3. Use a fallback based on userId if nothing else is available
 *
 * Usage:
 *   npx tsx scripts/fix-dev-usernames.ts [--dry-run]
 *
 * Options:
 *   --dry-run      Preview changes without modifying the database
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Initialize Firebase Admin
function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const keyJson = process.env.GOOGLE_CLOUD_KEY_JSON;

  if (keyJson) {
    let credentials;
    try {
      credentials = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf8'));
    } catch {
      credentials = JSON.parse(keyJson);
    }

    return admin.initializeApp({
      credential: admin.credential.cert(credentials),
      projectId: credentials.project_id
    });
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  throw new Error('No Firebase credentials found. Set GOOGLE_CLOUD_KEY_JSON or GOOGLE_APPLICATION_CREDENTIALS');
}

interface FixStats {
  usersProcessed: number;
  usersFixed: number;
  usersSkipped: number;
  fixedFromDisplayName: number;
  fixedFromEmail: number;
  fixedFromFallback: number;
  errors: number;
}

/**
 * Generate a clean username from an email address
 */
function usernameFromEmail(email: string): string {
  // Take the part before @, remove special chars, lowercase
  const localPart = email.split('@')[0] || '';
  return localPart.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().substring(0, 20) || 'user';
}

/**
 * Generate a fallback username from userId
 */
function usernameFromUserId(userId: string): string {
  // Take first 8 chars of userId
  return `user_${userId.substring(0, 8)}`;
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('     FIX: DEV_users Usernames');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}`);

  const app = initFirebase();
  const db = app.firestore();

  const stats: FixStats = {
    usersProcessed: 0,
    usersFixed: 0,
    usersSkipped: 0,
    fixedFromDisplayName: 0,
    fixedFromEmail: 0,
    fixedFromFallback: 0,
    errors: 0
  };

  const USERS_COLLECTION = 'DEV_users';
  const BATCH_SIZE = 50;

  console.log(`\n📊 Processing ${USERS_COLLECTION} collection`);

  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let batchNumber = 0;

  while (true) {
    batchNumber++;
    console.log(`\n   📦 Batch ${batchNumber}...`);

    let query = db.collection(USERS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('      No more users to process.');
      break;
    }

    const writeBatch = db.batch();
    let batchWrites = 0;

    for (const doc of snapshot.docs) {
      stats.usersProcessed++;
      const data = doc.data();
      const userId = doc.id;

      try {
        // Check if username already exists and is valid
        if (data.username && typeof data.username === 'string' && data.username.trim().length > 0) {
          stats.usersSkipped++;
          continue;
        }

        // Determine the best username source
        let newUsername: string;
        let source: string;

        if (data.displayName && typeof data.displayName === 'string' && data.displayName.trim().length > 0) {
          // Use displayName - clean it up for username format
          newUsername = data.displayName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20);
          if (newUsername.length === 0) {
            newUsername = usernameFromUserId(userId);
            source = 'fallback';
            stats.fixedFromFallback++;
          } else {
            source = 'displayName';
            stats.fixedFromDisplayName++;
          }
        } else if (data.email && typeof data.email === 'string') {
          // Use email
          newUsername = usernameFromEmail(data.email);
          source = 'email';
          stats.fixedFromEmail++;
        } else {
          // Use userId fallback
          newUsername = usernameFromUserId(userId);
          source = 'fallback';
          stats.fixedFromFallback++;
        }

        // Log the fix
        console.log(`      👤 ${userId}: "${data.displayName || data.email || 'N/A'}" → username: "${newUsername}" (from ${source})`);

        if (!dryRun) {
          writeBatch.update(doc.ref, { username: newUsername });
        }
        batchWrites++;
        stats.usersFixed++;

      } catch (error) {
        console.error(`      ❌ Error processing user ${userId}:`, error);
        stats.errors++;
      }
    }

    // Commit the batch
    if (!dryRun && batchWrites > 0) {
      await writeBatch.commit();
      console.log(`      ✅ Fixed ${batchWrites} users`);
    } else if (dryRun && batchWrites > 0) {
      console.log(`      🔍 Would fix ${batchWrites} users (dry run)`);
    } else {
      console.log(`      ✓ No fixes needed in this batch`);
    }

    // Update last doc for pagination
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Also update DEV_pages to sync usernames
  console.log('\n📊 Syncing usernames to DEV_pages...');

  // Build a map of userId -> username from DEV_users
  const usernameMap = new Map<string, string>();
  const usersSnapshot = await db.collection(USERS_COLLECTION).get();
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.username) {
      usernameMap.set(doc.id, data.username);
    }
  });

  console.log(`   Found ${usernameMap.size} users with usernames`);

  // Update pages with missing or incorrect usernames
  const PAGES_COLLECTION = 'DEV_pages';
  let pagesLastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let pagesBatchNumber = 0;
  let pagesFixed = 0;

  while (true) {
    pagesBatchNumber++;

    let pagesQuery = db.collection(PAGES_COLLECTION)
      .orderBy('lastModified', 'desc')
      .limit(BATCH_SIZE);

    if (pagesLastDoc) {
      pagesQuery = pagesQuery.startAfter(pagesLastDoc);
    }

    const pagesSnapshot = await pagesQuery.get();

    if (pagesSnapshot.empty) {
      break;
    }

    const pagesBatch = db.batch();
    let pagesBatchWrites = 0;

    for (const doc of pagesSnapshot.docs) {
      const data = doc.data();
      const pageUserId = data.userId;

      if (!pageUserId) continue;

      const correctUsername = usernameMap.get(pageUserId);
      if (!correctUsername) continue;

      // Check if page has wrong or missing username
      if (data.username !== correctUsername) {
        if (!dryRun) {
          pagesBatch.update(doc.ref, { username: correctUsername });
        }
        pagesBatchWrites++;
        pagesFixed++;
      }
    }

    if (!dryRun && pagesBatchWrites > 0) {
      await pagesBatch.commit();
    }

    pagesLastDoc = pagesSnapshot.docs[pagesSnapshot.docs.length - 1];
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`   ${dryRun ? 'Would fix' : 'Fixed'} ${pagesFixed} pages with incorrect usernames`);

  // Print results
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                      RESULTS');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Users processed:        ${stats.usersProcessed}`);
  console.log(`   Users fixed:            ${stats.usersFixed}`);
  console.log(`   Users skipped:          ${stats.usersSkipped}`);
  console.log(`   Pages fixed:            ${pagesFixed}`);
  console.log(`   Errors:                 ${stats.errors}`);
  console.log('────────────────────────────────────────────────────────────');
  console.log('   Username Sources:');
  console.log(`      From displayName:    ${stats.fixedFromDisplayName}`);
  console.log(`      From email:          ${stats.fixedFromEmail}`);
  console.log(`      From fallback:       ${stats.fixedFromFallback}`);
  console.log('════════════════════════════════════════════════════════════');

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to apply changes.\n');
  } else {
    console.log('\n✅ Fix complete!\n');
    console.log('   All DEV_users now have usernames set.');
    console.log('   DEV_pages usernames have been synced.\n');
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch(console.error);
