/**
 * One-time script to clean up orphaned USD allocations
 *
 * Usage: npx tsx scripts/cleanup-orphaned-allocations.ts [--execute]
 *
 * By default runs in dry-run mode. Pass --execute to actually cancel allocations.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const dryRun = !process.argv.includes('--execute');
const isProd = process.argv.includes('--prod');

console.log(`\n🔧 Orphaned Allocation Cleanup Script`);
console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  EXECUTE MODE (will cancel allocations)'}`);
console.log(`Environment: ${isProd ? '🚨 PRODUCTION' : '🧪 DEVELOPMENT'}\n`);

// Initialize Firebase Admin (same approach as app/firebase/admin.ts)
function initAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  let serviceAccount: any;

  // Use GOOGLE_CLOUD_KEY_JSON (same as the main app)
  const jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON;

  if (jsonString) {
    let parsedString = jsonString;

    // Check if base64 encoded
    if (!parsedString.includes(' ') && !parsedString.startsWith('{')) {
      try {
        parsedString = Buffer.from(parsedString, 'base64').toString('utf-8');
        console.log('Decoded base64-encoded service account');
      } catch {
        // Not base64, use as-is
      }
    }

    serviceAccount = JSON.parse(parsedString);
  } else {
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
    };
  }

  if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('Missing required service account credentials. Check GOOGLE_CLOUD_KEY_JSON or individual Firebase env vars.');
  }

  console.log(`Using service account: ${serviceAccount.client_email}`);

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

async function cleanupOrphanedAllocations() {
  const app = initAdmin();
  const db = getFirestore(app);

  // Determine collection prefix based on --prod flag
  // IMPORTANT: Collection name is 'usdAllocations' (camelCase), not 'usd_allocations' (snake_case)
  const collectionPrefix = isProd ? '' : 'DEV_';

  console.log(`Collection prefix: "${collectionPrefix}"\n`);

  // Query all active allocations (not just page type, to find all orphaned ones)
  const allocationsRef = db.collection(`${collectionPrefix}usdAllocations`);
  const allocationsQuery = allocationsRef
    .where('status', '==', 'active');

  const allocationsSnapshot = await allocationsQuery.get();
  console.log(`📊 Found ${allocationsSnapshot.size} total active allocations to check\n`);

  if (allocationsSnapshot.empty) {
    console.log('✅ No active page allocations found. Nothing to clean up.');
    return;
  }

  // Collect all page IDs (only from page-type allocations)
  const pageIds = new Set<string>();
  const pageAllocations: { id: string; ref: FirebaseFirestore.DocumentReference; data: any }[] = [];
  let userAllocationsCount = 0;
  let otherAllocationsCount = 0;

  allocationsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    // Only process page-type allocations for orphan detection
    if (data.resourceType === 'page') {
      pageAllocations.push({ id: doc.id, ref: doc.ref, data });
      pageIds.add(data.resourceId);
    } else if (data.resourceType === 'user' || data.resourceId?.startsWith('user/')) {
      userAllocationsCount++;
    } else {
      otherAllocationsCount++;
    }
  });

  console.log(`📊 Breakdown:`);
  console.log(`   - Page allocations: ${pageAllocations.length}`);
  console.log(`   - User allocations: ${userAllocationsCount}`);
  console.log(`   - Other allocations: ${otherAllocationsCount}\n`);

  const allocations = pageAllocations;

  console.log(`📄 Checking ${pageIds.size} unique pages...\n`);

  // Check page existence in batches
  const pageStatusMap = new Map<string, { exists: boolean; deleted: boolean; title?: string }>();
  const pageIdArray = Array.from(pageIds);
  const BATCH_SIZE = 30;

  for (let i = 0; i < pageIdArray.length; i += BATCH_SIZE) {
    const batch = pageIdArray.slice(i, i + BATCH_SIZE);

    const pagePromises = batch.map(async (pageId) => {
      // IMPORTANT: Collection name is 'pages' (same in both envs, just prefixed)
      const pageDoc = await db.collection(`${collectionPrefix}pages`).doc(pageId).get();
      if (!pageDoc.exists) {
        pageStatusMap.set(pageId, { exists: false, deleted: false });
      } else {
        const pageData = pageDoc.data();
        pageStatusMap.set(pageId, {
          exists: true,
          deleted: pageData?.deleted === true,
          title: pageData?.title
        });
      }
    });

    await Promise.all(pagePromises);
  }

  // Find orphaned allocations
  interface OrphanedAllocation {
    id: string;
    ref: FirebaseFirestore.DocumentReference;
    data: any;
    reason: 'page_not_found' | 'page_deleted';
  }

  const orphanedAllocations: OrphanedAllocation[] = [];

  for (const allocation of allocations) {
    const pageStatus = pageStatusMap.get(allocation.data.resourceId);

    if (!pageStatus || !pageStatus.exists) {
      orphanedAllocations.push({
        ...allocation,
        reason: 'page_not_found'
      });
    } else if (pageStatus.deleted) {
      orphanedAllocations.push({
        ...allocation,
        reason: 'page_deleted'
      });
    }
  }

  console.log(`🔍 Analysis Complete:`);
  console.log(`   Total allocations checked: ${allocations.length}`);
  console.log(`   Orphaned allocations found: ${orphanedAllocations.length}`);
  console.log(`   - Page not found: ${orphanedAllocations.filter(a => a.reason === 'page_not_found').length}`);
  console.log(`   - Page deleted: ${orphanedAllocations.filter(a => a.reason === 'page_deleted').length}`);
  console.log('');

  if (orphanedAllocations.length === 0) {
    console.log('✅ No orphaned allocations found. Nothing to clean up.');
    return;
  }

  // Show details of orphaned allocations
  console.log('📋 Orphaned Allocations:');
  console.log('-'.repeat(80));

  let totalCentsToCancel = 0;
  for (const allocation of orphanedAllocations) {
    const { id, data, reason } = allocation;
    totalCentsToCancel += data.usdCents || 0;
    console.log(`  ID: ${id}`);
    console.log(`  User: ${data.userId}`);
    console.log(`  Page ID: ${data.resourceId}`);
    console.log(`  Amount: $${((data.usdCents || 0) / 100).toFixed(2)}`);
    console.log(`  Month: ${data.month}`);
    console.log(`  Stored Title: ${data.pageTitle || '(none)'}`);
    console.log(`  Reason: ${reason}`);
    console.log('-'.repeat(80));
  }

  console.log(`\n💰 Total amount to cancel: $${(totalCentsToCancel / 100).toFixed(2)}\n`);

  if (dryRun) {
    console.log('ℹ️  DRY RUN - No changes made.');
    console.log('   Run with --execute flag to cancel these allocations.');
    return;
  }

  // Actually cancel the allocations
  console.log('⚠️  Cancelling orphaned allocations...\n');

  const WRITE_BATCH_SIZE = 500;
  let cancelledCount = 0;
  let errorCount = 0;

  for (let i = 0; i < orphanedAllocations.length; i += WRITE_BATCH_SIZE) {
    const batchItems = orphanedAllocations.slice(i, i + WRITE_BATCH_SIZE);
    const writeBatch = db.batch();

    for (const allocation of batchItems) {
      writeBatch.update(allocation.ref, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledReason: allocation.reason,
        updatedAt: new Date().toISOString()
      });
    }

    try {
      await writeBatch.commit();
      cancelledCount += batchItems.length;
      console.log(`   ✅ Cancelled batch of ${batchItems.length} allocations`);
    } catch (error) {
      errorCount += batchItems.length;
      console.error(`   ❌ Failed to cancel batch:`, error);
    }
  }

  console.log(`\n🏁 Cleanup Complete:`);
  console.log(`   Cancelled: ${cancelledCount}`);
  console.log(`   Errors: ${errorCount}`);
}

cleanupOrphanedAllocations()
  .then(() => {
    console.log('\n✅ Script finished successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
