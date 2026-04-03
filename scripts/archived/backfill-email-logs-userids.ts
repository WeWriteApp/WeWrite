/**
 * Backfill recipientUserId in email logs
 *
 * Finds email logs that are missing recipientUserId and attempts to
 * look up the userId by matching recipientEmail to users collection.
 *
 * Run with: npx tsx scripts/backfill-email-logs-userids.ts [--dry-run] [--env=prod]
 *
 * Options:
 *   --dry-run    Preview changes without modifying the database
 *   --env=prod   Force production environment (otherwise uses DEV_ prefix)
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
const forceProduction = args.includes('--env=prod');

// Determine environment and collection names
const isProduction = forceProduction || process.env.NODE_ENV === 'production';
const collectionPrefix = isProduction ? '' : 'DEV_';

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

const app = initFirebase();
const db = admin.firestore();

async function backfillEmailLogUserIds() {
  console.log('Starting email log userId backfill...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Collection prefix: "${collectionPrefix}"\n`);

  // Use environment-appropriate collections
  const emailLogsCollection = `${collectionPrefix}emailLogs`;
  const usersCollection = `${collectionPrefix}users`;

  // First, build a map of email -> userId from users collection
  console.log('Building email -> userId lookup map...');
  const usersSnapshot = await db.collection(usersCollection).get();

  const emailToUserId = new Map<string, { id: string; username?: string }>();
  usersSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.email) {
      emailToUserId.set(data.email.toLowerCase(), {
        id: doc.id,
        username: data.username
      });
    }
  });
  console.log(`Found ${emailToUserId.size} users with emails\n`);

  // Find email logs missing recipientUserId
  console.log('Finding email logs without recipientUserId...');
  const logsSnapshot = await db.collection(emailLogsCollection)
    .limit(1000)
    .get();

  let updated = 0;
  let notFound = 0;
  let alreadyHasUserId = 0;
  let errors = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of logsSnapshot.docs) {
    const data = doc.data();

    // Skip if already has recipientUserId
    if (data.recipientUserId) {
      alreadyHasUserId++;
      continue;
    }

    // Try to find user by email
    const email = data.recipientEmail?.toLowerCase();
    if (!email) {
      notFound++;
      continue;
    }

    const user = emailToUserId.get(email);
    if (!user) {
      notFound++;
      console.log(`  No user found for email: ${email}`);
      continue;
    }

    // Update the log with the userId
    try {
      if (!dryRun) {
        batch.update(doc.ref, {
          recipientUserId: user.id,
          recipientUsername: user.username || data.recipientUsername,
          _backfilledAt: admin.firestore.FieldValue.serverTimestamp()
        });
        batchCount++;
      }
      updated++;

      console.log(`  ${dryRun ? '[DRY RUN] Would update' : 'Will update'} log ${doc.id}: ${email} -> ${user.id} (@${user.username})`);

      // Commit batch every 400 updates (Firestore limit is 500)
      if (!dryRun && batchCount >= 400) {
        await batch.commit();
        console.log(`\nCommitted batch of ${batchCount} updates`);
        batchCount = 0;
      }
    } catch (error) {
      console.error(`  Error preparing update for ${doc.id}:`, error);
      errors++;
    }
  }

  // Commit remaining updates
  if (!dryRun && batchCount > 0) {
    await batch.commit();
    console.log(`\nCommitted final batch of ${batchCount} updates`);
  }

  console.log('\n=== Summary ===');
  console.log(`Total logs checked: ${logsSnapshot.size}`);
  console.log(`Already had userId: ${alreadyHasUserId}`);
  console.log(`Updated with userId: ${updated}`);
  console.log(`No user found: ${notFound}`);
  console.log(`Errors: ${errors}`);
}

backfillEmailLogUserIds()
  .then(() => {
    console.log('\nBackfill complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
