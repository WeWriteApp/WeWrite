/**
 * Repair All Broken Users Script
 *
 * Batch repairs all users who exist in Firebase Auth but are missing Firestore documents.
 * Generates usernames from email addresses.
 *
 * Usage:
 *   npx tsx scripts/repair-all-broken-users.ts --dry-run    # Preview changes
 *   npx tsx scripts/repair-all-broken-users.ts              # Actually repair
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const isDryRun = process.argv.includes('--dry-run');

// Initialize Firebase Admin
function initializeFirebaseAdmin(): typeof admin {
  if (admin.apps.length > 0) {
    return admin;
  }

  const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
  if (!base64Json) {
    throw new Error('Missing GOOGLE_CLOUD_KEY_JSON environment variable');
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PID;
  if (!projectId) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_PID environment variable');
  }

  const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
  const serviceAccount = JSON.parse(decodedJson);

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id || projectId,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, '\n')
    }),
  });

  console.log(`Firebase Admin initialized for project: ${serviceAccount.project_id || projectId}`);
  return admin;
}

// Generate a username from email
function generateUsernameFromEmail(email: string): string {
  // Extract local part before @
  const localPart = email.split('@')[0];

  // Remove special characters and limit length
  let username = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);

  // Ensure minimum length
  if (username.length < 3) {
    username = `user_${username}`;
  }

  return username;
}

async function findBrokenUsers(firebaseAdmin: typeof admin): Promise<Array<{uid: string; email: string; created: string}>> {
  const db = firebaseAdmin.firestore();
  const auth = firebaseAdmin.auth();

  console.log('\n=== Finding broken users ===\n');

  const brokenUsers: Array<{ uid: string; email: string; created: string }> = [];
  let checkedCount = 0;
  let nextPageToken: string | undefined;

  do {
    const listResult = await auth.listUsers(100, nextPageToken);

    for (const authUser of listResult.users) {
      checkedCount++;

      const userDoc = await db.collection('users').doc(authUser.uid).get();

      if (!userDoc.exists) {
        brokenUsers.push({
          uid: authUser.uid,
          email: authUser.email || 'no-email',
          created: authUser.metadata.creationTime || 'unknown',
        });
      }

      if (checkedCount % 100 === 0) {
        console.log(`   Checked ${checkedCount} users, found ${brokenUsers.length} broken...`);
      }
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`\nTotal checked: ${checkedCount} users`);
  console.log(`Total broken: ${brokenUsers.length} users\n`);

  return brokenUsers;
}

async function repairUser(
  firebaseAdmin: typeof admin,
  userId: string,
  email: string,
  created: string
): Promise<boolean> {
  const db = firebaseAdmin.firestore();
  const now = new Date().toISOString();

  const username = generateUsernameFromEmail(email);

  const newUserData = {
    email: email,
    username: username,
    createdAt: created || now,
    lastModified: now,
    repairedAt: now,
    repairedBy: 'repair-all-broken-users-script',
    totalPages: 0,
    publicPages: 0,
  };

  if (isDryRun) {
    console.log(`  [DRY RUN] Would create: ${userId} -> ${username} (${email})`);
    return true;
  }

  try {
    await db.collection('users').doc(userId).set(newUserData);
    console.log(`  ✅ Created: ${userId} -> ${username} (${email})`);
    return true;
  } catch (error: any) {
    console.log(`  ❌ Failed: ${userId} - ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  REPAIR ALL BROKEN USERS');
  console.log(isDryRun ? '  MODE: DRY RUN (no changes will be made)' : '  MODE: LIVE (will make changes!)');
  console.log('========================================\n');

  const firebaseAdmin = initializeFirebaseAdmin();

  // Find all broken users
  const brokenUsers = await findBrokenUsers(firebaseAdmin);

  if (brokenUsers.length === 0) {
    console.log('No broken users found!');
    return;
  }

  console.log(`Found ${brokenUsers.length} broken users to repair.\n`);

  if (!isDryRun) {
    console.log('Starting repairs in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  let repaired = 0;
  let failed = 0;

  for (const user of brokenUsers) {
    const success = await repairUser(firebaseAdmin, user.uid, user.email, user.created);
    if (success) {
      repaired++;
    } else {
      failed++;
    }
  }

  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log(`Total broken: ${brokenUsers.length}`);
  console.log(`Repaired: ${repaired}`);
  console.log(`Failed: ${failed}`);

  if (isDryRun) {
    console.log('\nThis was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to actually repair users.');
  }
}

main().catch(console.error);
