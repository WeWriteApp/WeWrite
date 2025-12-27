/**
 * Sync Dev Usernames Script
 *
 * This script syncs usernames from DEV_users to DEV_pages collection.
 * Run with: npx tsx scripts/sync-dev-usernames.ts
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

console.log(`
=================================================
     SYNC DEV USERNAMES SCRIPT
=================================================
`);

async function main() {
  // Initialize Firebase Admin
  if (!admin.apps.length) {
    let serviceAccount: admin.ServiceAccount;

    if (process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON) {
      try {
        let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON || '';
        const keySource = process.env.GOOGLE_CLOUD_KEY_JSON ? 'GOOGLE_CLOUD_KEY_JSON' : 'LOGGING_CLOUD_KEY_JSON';

        if (keySource === 'LOGGING_CLOUD_KEY_JSON') {
          jsonString = jsonString.replace(/\n/g, '').replace(/\r/g, '');
        }

        if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
          try {
            jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
            console.log(`Decoded base64-encoded ${keySource}`);
          } catch (decodeError) {
            console.warn(`Failed to decode ${keySource} as base64, using original string`);
          }
        }

        serviceAccount = JSON.parse(jsonString);
        console.log(`Using service account: ${serviceAccount.client_email}`);
      } catch (parseError) {
        console.error('Error parsing service account JSON:', parseError);
        process.exit(1);
      }
    } else {
      console.error('Missing Firebase credentials.');
      process.exit(1);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();

  // Step 1: Get all users from DEV_users with their usernames
  console.log('Fetching users from DEV_users...');
  const usersSnapshot = await db.collection('DEV_users').get();
  console.log(`Found ${usersSnapshot.size} users`);

  const userMap = new Map<string, string>();
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const username = data.username || `user_${doc.id.substring(0, 8)}`;
    userMap.set(doc.id, username);
  }

  // Step 2: Get all pages from DEV_pages
  console.log('\nFetching pages from DEV_pages...');
  const pagesSnapshot = await db.collection('DEV_pages').get();
  console.log(`Found ${pagesSnapshot.size} pages`);

  // Step 3: Find pages with mismatched usernames and fix them
  let fixed = 0;
  let alreadyCorrect = 0;
  let noUser = 0;

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const pageDoc of pagesSnapshot.docs) {
    const pageData = pageDoc.data();
    const userId = pageData.userId;

    if (!userId) {
      noUser++;
      continue;
    }

    const correctUsername = userMap.get(userId);

    if (!correctUsername) {
      noUser++;
      continue;
    }

    if (pageData.username === correctUsername) {
      alreadyCorrect++;
      continue;
    }

    // Username needs updating
    console.log(`  Fixing: ${pageDoc.id} - "${pageData.username || '(empty)'}" -> "${correctUsername}"`);

    batch.update(pageDoc.ref, {
      username: correctUsername,
      userDataUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    fixed++;
    batchCount++;

    // Commit batch when it reaches the limit
    if (batchCount >= BATCH_SIZE) {
      console.log(`  Committing batch of ${batchCount} updates...`);
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining updates
  if (batchCount > 0) {
    console.log(`  Committing final batch of ${batchCount} updates...`);
    await batch.commit();
  }

  console.log(`
=================================================
                 RESULTS
=================================================
Total pages:      ${pagesSnapshot.size}
Already correct:  ${alreadyCorrect}
Fixed:            ${fixed}
No user found:    ${noUser}
=================================================
`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
