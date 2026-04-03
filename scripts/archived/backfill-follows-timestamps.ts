/**
 * Backfill script to add followedAt timestamps to follows collection
 *
 * The follows collection stores user-to-user follow relationships.
 * Documents should have: followerId, followedId, followedAt
 *
 * This script finds all documents missing the followedAt field and backfills them.
 * For documents that already have followedAt but it's not a proper Timestamp,
 * it will convert them.
 *
 * Usage:
 *   npx tsx scripts/backfill-follows-timestamps.ts [--dry-run] [--env=prod]
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
const isProduction = forceProduction || process.env.NODE_ENV === 'production' || !process.env.VERCEL_ENV;
const collectionPrefix = isProduction ? '' : 'DEV_';

const FOLLOWS_COLLECTION = `${collectionPrefix}follows`;

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

interface BackfillStats {
  totalDocuments: number;
  documentsWithTimestamp: number;
  documentsWithoutTimestamp: number;
  documentsUpdated: number;
  deletedDocuments: number;
  errors: number;
}

async function backfillFollowsTimestamps(): Promise<BackfillStats> {
  const stats: BackfillStats = {
    totalDocuments: 0,
    documentsWithTimestamp: 0,
    documentsWithoutTimestamp: 0,
    documentsUpdated: 0,
    deletedDocuments: 0,
    errors: 0,
  };

  const app = initFirebase();
  const db = app.firestore();

  console.log(`\n🔄 Starting follows timestamp backfill`);
  console.log(`   Collection: ${FOLLOWS_COLLECTION}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}\n`);

  try {
    // Get all documents in the follows collection
    console.log('📋 Fetching all follows documents...');
    const followsSnapshot = await db.collection(FOLLOWS_COLLECTION).get();
    stats.totalDocuments = followsSnapshot.size;
    console.log(`   Found ${stats.totalDocuments} documents\n`);

    if (stats.totalDocuments === 0) {
      console.log('   ⚠️  No documents found in the follows collection.');
      console.log('   This could mean:');
      console.log('   1. No user follows have been recorded yet');
      console.log('   2. The collection name might be different');
      console.log('   3. Using wrong environment (try --env=prod)\n');
      return stats;
    }

    // Process each document
    let processed = 0;
    for (const doc of followsSnapshot.docs) {
      processed++;
      const data = doc.data();
      const docId = doc.id;

      // Check if document is marked as deleted
      if (data.deleted === true) {
        stats.deletedDocuments++;
        continue;
      }

      // Check if followedAt exists and is valid
      const hasValidTimestamp = data.followedAt &&
        (data.followedAt instanceof admin.firestore.Timestamp ||
         (data.followedAt._seconds !== undefined && data.followedAt._nanoseconds !== undefined));

      if (hasValidTimestamp) {
        stats.documentsWithTimestamp++;
        continue;
      }

      stats.documentsWithoutTimestamp++;

      // Determine what timestamp to use
      // Priority: existing followedAt string/number > document createTime > fallback to Jan 1 2024
      let timestampToUse: admin.firestore.Timestamp;

      if (data.followedAt && typeof data.followedAt === 'string') {
        // Try to parse string date
        const parsed = new Date(data.followedAt);
        if (!isNaN(parsed.getTime())) {
          timestampToUse = admin.firestore.Timestamp.fromDate(parsed);
        } else {
          timestampToUse = admin.firestore.Timestamp.fromDate(new Date('2024-01-01'));
        }
      } else if (data.followedAt && typeof data.followedAt === 'number') {
        // Unix timestamp
        timestampToUse = admin.firestore.Timestamp.fromMillis(data.followedAt);
      } else if (doc.createTime) {
        // Use document creation time
        timestampToUse = doc.createTime;
      } else {
        // Fallback to a reasonable default
        timestampToUse = admin.firestore.Timestamp.fromDate(new Date('2024-01-01'));
      }

      console.log(`   📝 Document ${docId}: Missing followedAt, will set to ${timestampToUse.toDate().toISOString()}`);
      console.log(`      followerId: ${data.followerId}, followedId: ${data.followedId}`);

      if (!dryRun) {
        try {
          await db.collection(FOLLOWS_COLLECTION).doc(docId).update({
            followedAt: timestampToUse
          });
          stats.documentsUpdated++;
        } catch (error) {
          console.error(`   ❌ Error updating document ${docId}:`, error);
          stats.errors++;
        }
      } else {
        stats.documentsUpdated++;
      }

      // Log progress every 50 documents
      if (processed % 50 === 0) {
        console.log(`   📊 Processed ${processed}/${stats.totalDocuments} documents...`);
      }

      // Small delay to avoid rate limiting
      if (!dryRun && processed % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    stats.errors++;
  }

  return stats;
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('     BACKFILL: Adding followedAt timestamps to follows collection');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Collection: ${FOLLOWS_COLLECTION}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const startTime = Date.now();
  const stats = await backfillFollowsTimestamps();
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('                          RESULTS');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`   Total documents:           ${stats.totalDocuments}`);
  console.log(`   Already had timestamp:     ${stats.documentsWithTimestamp}`);
  console.log(`   Missing timestamp:         ${stats.documentsWithoutTimestamp}`);
  console.log(`   Documents updated:         ${stats.documentsUpdated}`);
  console.log(`   Deleted (skipped):         ${stats.deletedDocuments}`);
  console.log(`   Errors:                    ${stats.errors}`);
  console.log(`   Duration:                  ${duration}s`);
  console.log('════════════════════════════════════════════════════════════════════');

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to apply changes.\n');
  } else {
    console.log('\n✅ Backfill complete!\n');
  }

  // Print next steps
  console.log('📌 NEXT STEPS:');
  console.log('   1. Run this script for dev: npx tsx scripts/backfill-follows-timestamps.ts');
  console.log('   2. Run this script for prod: npx tsx scripts/backfill-follows-timestamps.ts --env=prod');
  console.log('   3. Create Firestore index for follows collection:');
  console.log('      Collection: follows (or DEV_follows)');
  console.log('      Fields: followedAt (Ascending), __name__ (Ascending)');
  console.log('');

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch(console.error);
