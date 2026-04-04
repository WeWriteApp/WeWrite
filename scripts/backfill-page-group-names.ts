/**
 * Backfill groupName on pages that have a groupId but are missing groupName.
 *
 * This ensures activity feed items display "created by [user] in [group]"
 * for pages that were created before we added groupName to page documents.
 *
 * Usage:
 *   bun run scripts/backfill-page-group-names.ts           # Development (DEV_ prefix)
 *   bun run scripts/backfill-page-group-names.ts --prod    # Production
 *   bun run scripts/backfill-page-group-names.ts --dry-run # Preview changes without writing
 */

import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const isProd = process.argv.includes('--prod');
const isDryRun = process.argv.includes('--dry-run');
const envPrefix = isProd ? '' : 'DEV_';

console.log(`\n📝 Backfill Page Group Names`);
console.log(`📦 Environment: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`📚 Collection prefix: "${envPrefix}"`);
if (isDryRun) console.log(`🔍 DRY RUN — no changes will be written\n`);
else console.log();

// Initialize Firebase Admin
let serviceAccount: any;
try {
  const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
  } else {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountJson) {
      console.error('❌ No service account found. Place firebase-service-account.json in root or set FIREBASE_SERVICE_ACCOUNT_KEY env var.');
      process.exit(1);
    }
    serviceAccount = JSON.parse(serviceAccountJson);
  }
} catch {
  console.error('❌ Failed to parse service account JSON');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'wewrite-ccd82',
  });
}

const db = admin.firestore();
const pagesCollection = `${envPrefix}pages`;
const groupsCollection = `${envPrefix}groups`;

async function run() {
  // Step 1: Find all pages that have groupId but no groupName
  console.log(`🔎 Querying ${pagesCollection} for pages with groupId...`);

  const pagesWithGroup = await db.collection(pagesCollection)
    .where('groupId', '!=', '')
    .get();

  console.log(`   Found ${pagesWithGroup.size} pages with a groupId`);

  const needsBackfill = pagesWithGroup.docs.filter(doc => {
    const data = doc.data();
    return !data.groupName;
  });

  console.log(`   ${needsBackfill.length} pages missing groupName\n`);

  if (needsBackfill.length === 0) {
    console.log('✅ Nothing to backfill — all pages with groupId already have groupName.');
    return;
  }

  // Step 2: Collect unique group IDs and fetch their names
  const uniqueGroupIds = [...new Set(needsBackfill.map(doc => doc.data().groupId))];
  console.log(`📂 Fetching names for ${uniqueGroupIds.length} groups...`);

  const groupNames: Record<string, string> = {};
  // Firestore getAll supports up to 500 docs
  const BATCH_SIZE = 100;
  for (let i = 0; i < uniqueGroupIds.length; i += BATCH_SIZE) {
    const batch = uniqueGroupIds.slice(i, i + BATCH_SIZE);
    const refs = batch.map(id => db.collection(groupsCollection).doc(id));
    const snapshots = await db.getAll(...refs);
    for (const snap of snapshots) {
      if (snap.exists) {
        const data = snap.data();
        groupNames[snap.id] = data?.name || data?.title || 'Unknown Group';
      }
    }
  }

  console.log(`   Resolved ${Object.keys(groupNames).length} group names\n`);

  // Step 3: Update pages in batches
  let updated = 0;
  let skipped = 0;
  const writeBatch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_WRITES = 500;

  for (const doc of needsBackfill) {
    const data = doc.data();
    const groupName = groupNames[data.groupId];

    if (!groupName) {
      console.log(`   ⚠️ Skipping page "${data.title || doc.id}" — group ${data.groupId} not found`);
      skipped++;
      continue;
    }

    if (isDryRun) {
      console.log(`   Would set groupName="${groupName}" on page "${data.title || doc.id}" (group: ${data.groupId})`);
      updated++;
      continue;
    }

    writeBatch.update(doc.ref, { groupName });
    batchCount++;
    updated++;

    // Commit in batches of 500 (Firestore limit)
    if (batchCount >= MAX_BATCH_WRITES) {
      await writeBatch.commit();
      console.log(`   ✍️  Committed batch of ${batchCount} updates`);
      batchCount = 0;
    }
  }

  // Commit remaining
  if (!isDryRun && batchCount > 0) {
    await writeBatch.commit();
    console.log(`   ✍️  Committed final batch of ${batchCount} updates`);
  }

  console.log(`\n${isDryRun ? '🔍 DRY RUN SUMMARY' : '✅ BACKFILL COMPLETE'}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (group not found): ${skipped}`);
  console.log(`   Already had groupName: ${pagesWithGroup.size - needsBackfill.length}`);
}

run().catch(err => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
