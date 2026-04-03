/**
 * Backfill script to add titleLower field to all existing pages
 *
 * This enables efficient same-title queries without scanning the entire collection.
 *
 * Usage:
 *   npx tsx scripts/backfill-title-lower.ts [--dry-run] [--env=prod]
 *
 * Options:
 *   --dry-run    Preview changes without modifying the database
 *   --env=prod   Force production environment
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

// Determine environment and collection name
const isProduction = forceProduction || process.env.NODE_ENV === 'production' || !process.env.VERCEL_ENV;
const collectionPrefix = isProduction ? '' : 'DEV_';
const COLLECTION_NAME = `${collectionPrefix}pages`;

// Initialize Firebase Admin
function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  // Try to get credentials from environment
  const keyJson = process.env.GOOGLE_CLOUD_KEY_JSON;

  if (keyJson) {
    // Decode if base64 encoded
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

  // Try using service account file
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  throw new Error('No Firebase credentials found. Set GOOGLE_CLOUD_KEY_JSON or GOOGLE_APPLICATION_CREDENTIALS');
}

interface BackfillStats {
  total: number;
  updated: number;
  skipped: number;
  noTitle: number;
  alreadyHas: number;
  errors: number;
}

async function backfillTitleLower(): Promise<BackfillStats> {
  const stats: BackfillStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    noTitle: 0,
    alreadyHas: 0,
    errors: 0,
  };

  const app = initFirebase();
  const db = app.firestore();

  console.log(`\n🔄 Starting titleLower backfill on collection: ${COLLECTION_NAME}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}\n`);

  try {
    // Process in batches to avoid memory issues
    const BATCH_SIZE = 500;
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
    let batchNumber = 0;

    while (true) {
      batchNumber++;
      console.log(`📦 Processing batch ${batchNumber}...`);

      let query = db.collection(COLLECTION_NAME)
        .orderBy('createdAt', 'desc')
        .limit(BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        console.log('   No more documents to process.');
        break;
      }

      // Use a Firestore batch for efficient writes
      const writeBatch = db.batch();
      let batchUpdates = 0;

      for (const doc of snapshot.docs) {
        stats.total++;
        const data = doc.data();

        // Skip deleted pages
        if (data.deleted === true) {
          stats.skipped++;
          continue;
        }

        // Skip pages without a title
        if (!data.title || typeof data.title !== 'string') {
          stats.noTitle++;
          continue;
        }

        // Calculate titleLower
        const titleLower = data.title.toLowerCase().trim();

        // Skip if titleLower already exists and is correct
        if (data.titleLower === titleLower) {
          stats.alreadyHas++;
          continue;
        }

        // Queue the update
        if (!dryRun) {
          writeBatch.update(doc.ref, { titleLower });
          batchUpdates++;
        }
        stats.updated++;

        // Log sample updates
        if (stats.updated <= 5) {
          console.log(`   📝 ${doc.id}: "${data.title}" -> titleLower: "${titleLower}"`);
        }
      }

      // Commit the batch
      if (!dryRun && batchUpdates > 0) {
        await writeBatch.commit();
        console.log(`   ✅ Committed ${batchUpdates} updates`);
      }

      // Update the last document for pagination
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    stats.errors++;
  }

  return stats;
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('     BACKFILL: Adding titleLower field to pages');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const stats = await backfillTitleLower();

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                      RESULTS');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Total pages scanned:    ${stats.total}`);
  console.log(`   Updated with titleLower: ${stats.updated}`);
  console.log(`   Already had titleLower:  ${stats.alreadyHas}`);
  console.log(`   Skipped (deleted):       ${stats.skipped}`);
  console.log(`   No title:                ${stats.noTitle}`);
  console.log(`   Errors:                  ${stats.errors}`);
  console.log('════════════════════════════════════════════════════════════');

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to apply changes.\n');
  } else {
    console.log('\n✅ Backfill complete!\n');
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch(console.error);
