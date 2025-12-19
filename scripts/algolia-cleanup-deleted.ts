/**
 * Algolia Cleanup Script - Remove Deleted Pages
 *
 * This script removes pages from Algolia that are soft-deleted in Firestore.
 * Run this to clean up existing deleted pages that were indexed before
 * the automatic deletion sync was implemented.
 *
 * Usage:
 *   npx tsx scripts/algolia-cleanup-deleted.ts [--cleanup] [--env=prod|dev]
 *
 * Options:
 *   --cleanup    Actually perform the cleanup (dry run by default)
 *   --env=prod   Force production environment
 *   --env=dev    Force development environment
 */

import * as admin from 'firebase-admin';
import { algoliasearch, type SearchClient } from 'algoliasearch';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const shouldCleanup = args.includes('--cleanup');
const envArg = args.find(a => a.startsWith('--env='));
const forcedEnv = envArg ? envArg.split('=')[1] : null;

// Configuration
const ALGOLIA_APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY!;

// Determine environment
const isProduction = forcedEnv === 'prod' || (!forcedEnv && (process.env.NODE_ENV === 'production' || !process.env.VERCEL_ENV));
const collectionPrefix = isProduction ? '' : 'DEV_';
const indexPrefix = isProduction ? '' : 'DEV_';

const PAGES_COLLECTION = `${collectionPrefix}pages`;
const PAGES_INDEX = `${indexPrefix}pages`;

console.log('🧹 Algolia Cleanup Script - Remove Deleted Pages');
console.log('='.repeat(50));
console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`Firestore Collection: ${PAGES_COLLECTION}`);
console.log(`Algolia Index: ${PAGES_INDEX}`);
console.log(`Cleanup: ${shouldCleanup ? 'YES' : 'NO (dry run)'}`);
console.log('='.repeat(50));

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

// Initialize Algolia client
function initAlgolia(): SearchClient {
  if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
    throw new Error('Algolia credentials not configured. Set NEXT_PUBLIC_ALGOLIA_APP_ID and ALGOLIA_ADMIN_KEY');
  }
  return algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
}

async function main() {
  try {
    // Initialize clients
    console.log('\n📦 Initializing clients...');
    const app = initFirebase();
    const db = admin.firestore();
    const algolia = initAlgolia();
    console.log('✅ Clients initialized');

    // Step 1: Get all page IDs from Algolia
    console.log('\n🔎 Fetching all pages from Algolia index...');
    const algoliaPageIds: string[] = [];

    let cursor: string | undefined;
    let batchCount = 0;

    do {
      const browseParams: any = {
        hitsPerPage: 1000,
        attributesToRetrieve: ['objectID'],
      };

      if (cursor) {
        browseParams.cursor = cursor;
      }

      const response = await algolia.browse({
        indexName: PAGES_INDEX,
        browseParams,
      });

      if (response.hits) {
        for (const hit of response.hits) {
          algoliaPageIds.push(hit.objectID);
        }
      }

      cursor = response.cursor;
      batchCount++;
      process.stdout.write(`\r  Fetched ${algoliaPageIds.length} pages (batch ${batchCount})...`);

      if (batchCount > 100) {
        console.log('\n⚠️ Reached batch limit, stopping Algolia fetch');
        break;
      }
    } while (cursor);

    console.log(`\n✅ Found ${algoliaPageIds.length} pages in Algolia`);

    // Step 2: Check each page in Firestore
    console.log('\n🔍 Checking page status in Firestore...');
    const deletedPageIds: string[] = [];
    const missingPageIds: string[] = [];
    const batchSize = 100;

    for (let i = 0; i < algoliaPageIds.length; i += batchSize) {
      const batchIds = algoliaPageIds.slice(i, i + batchSize);

      // Firestore has a limit of 10 for 'in' queries, so we need to do individual checks
      for (const pageId of batchIds) {
        try {
          const pageDoc = await db.collection(PAGES_COLLECTION).doc(pageId).get();

          if (!pageDoc.exists) {
            // Page doesn't exist in Firestore at all
            missingPageIds.push(pageId);
          } else {
            const data = pageDoc.data();
            if (data?.deleted === true) {
              // Page is soft-deleted
              deletedPageIds.push(pageId);
            }
          }
        } catch (err) {
          console.error(`Error checking page ${pageId}:`, err);
        }
      }

      process.stdout.write(`\r  Checked ${Math.min(i + batchSize, algoliaPageIds.length)}/${algoliaPageIds.length} pages...`);
    }

    console.log('');

    // Step 3: Report findings
    console.log('\n' + '='.repeat(50));
    console.log('📋 CLEANUP SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total pages in Algolia: ${algoliaPageIds.length}`);
    console.log(`Deleted pages (need removal): ${deletedPageIds.length}`);
    console.log(`Missing pages (orphaned in Algolia): ${missingPageIds.length}`);
    console.log(`Total to remove: ${deletedPageIds.length + missingPageIds.length}`);

    if (deletedPageIds.length > 0) {
      console.log('\n📝 Deleted pages to remove:');
      deletedPageIds.slice(0, 20).forEach((id, i) => {
        console.log(`  ${i + 1}. ${id}`);
      });
      if (deletedPageIds.length > 20) {
        console.log(`  ... and ${deletedPageIds.length - 20} more`);
      }
    }

    if (missingPageIds.length > 0) {
      console.log('\n📝 Orphaned pages to remove (not in Firestore):');
      missingPageIds.slice(0, 10).forEach((id, i) => {
        console.log(`  ${i + 1}. ${id}`);
      });
      if (missingPageIds.length > 10) {
        console.log(`  ... and ${missingPageIds.length - 10} more`);
      }
    }

    // Step 4: Perform cleanup if requested
    const allToRemove = [...deletedPageIds, ...missingPageIds];

    if (shouldCleanup && allToRemove.length > 0) {
      console.log('\n🗑️ Performing cleanup...');

      // Delete in batches
      const deleteBatchSize = 100;
      let removedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < allToRemove.length; i += deleteBatchSize) {
        const batch = allToRemove.slice(i, i + deleteBatchSize);

        try {
          await algolia.deleteObjects({
            indexName: PAGES_INDEX,
            objectIDs: batch,
          });
          removedCount += batch.length;
          console.log(`  ✅ Removed batch of ${batch.length} (total: ${removedCount})`);
        } catch (err) {
          console.error(`  ❌ Error removing batch:`, err);
          errors.push(`Batch ${i / deleteBatchSize + 1} failed: ${err}`);
        }
      }

      console.log('\n' + '='.repeat(50));
      console.log('✅ CLEANUP COMPLETE');
      console.log('='.repeat(50));
      console.log(`Pages removed: ${removedCount}`);
      if (errors.length > 0) {
        console.log(`Errors: ${errors.length}`);
        errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
      }
    } else if (allToRemove.length > 0 && !shouldCleanup) {
      console.log('\n💡 To remove these pages from Algolia, run with --cleanup flag:');
      console.log(`   npx tsx scripts/algolia-cleanup-deleted.ts --cleanup --env=${isProduction ? 'prod' : 'dev'}`);
    } else {
      console.log('\n✨ No deleted pages found in Algolia index!');
    }

    console.log('\n✨ Done!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
