/**
 * One-time script to clean up orphaned allocations
 *
 * Run with: npx tsx scripts/cleanup-orphaned-allocations.ts
 *
 * This script:
 * 1. Finds all active page allocations
 * 2. Checks if each referenced page exists and is not deleted
 * 3. Cancels allocations for missing/deleted pages
 */

// Import the existing admin initialization
import { initAdmin } from '../app/firebase/admin';
import { getCollectionName } from '../app/utils/environmentConfig';

async function main() {
  console.log('🚀 Starting orphaned allocation cleanup...\n');

  const admin = initAdmin();
  const db = admin.firestore();

  const allocationsCollection = getCollectionName('usd_allocations');
  const pagesCollection = getCollectionName('pages');

  console.log(`📦 Allocations collection: ${allocationsCollection}`);
  console.log(`📦 Pages collection: ${pagesCollection}\n`);

  // Step 1: Get all active page allocations
  console.log('📊 Fetching active page allocations...');
  const allocationsSnapshot = await db.collection(allocationsCollection)
    .where('resourceType', '==', 'page')
    .where('status', '==', 'active')
    .get();

  console.log(`   Found ${allocationsSnapshot.size} active page allocations\n`);

  if (allocationsSnapshot.size === 0) {
    console.log('✅ No active page allocations to check. Done!');
    return;
  }

  // Step 2: Get unique page IDs
  const pageIds = new Set<string>();
  const allocations: any[] = [];

  allocationsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    allocations.push({ id: doc.id, ref: doc.ref, ...data });
    pageIds.add(data.resourceId);
  });

  console.log(`📄 Checking ${pageIds.size} unique pages...\n`);

  // Step 3: Check page status in batches
  const pageStatusMap = new Map<string, { exists: boolean; deleted: boolean; title?: string }>();
  const pageIdArray = Array.from(pageIds);
  const BATCH_SIZE = 30;

  for (let i = 0; i < pageIdArray.length; i += BATCH_SIZE) {
    const batch = pageIdArray.slice(i, i + BATCH_SIZE);

    const pagePromises = batch.map(async (pageId) => {
      const pageDoc = await db.collection(pagesCollection).doc(pageId).get();
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
    console.log(`   Checked pages ${i + 1} to ${Math.min(i + BATCH_SIZE, pageIdArray.length)}`);
  }

  // Step 4: Find orphaned allocations
  const orphanedAllocations: { allocation: any; reason: string }[] = [];

  for (const allocation of allocations) {
    const pageStatus = pageStatusMap.get(allocation.resourceId);

    if (!pageStatus || !pageStatus.exists) {
      orphanedAllocations.push({
        allocation,
        reason: 'page_not_found'
      });
    } else if (pageStatus.deleted) {
      orphanedAllocations.push({
        allocation,
        reason: 'page_deleted'
      });
    }
  }

  console.log(`\n🔍 Found ${orphanedAllocations.length} orphaned allocations:\n`);

  if (orphanedAllocations.length === 0) {
    console.log('✅ No orphaned allocations found. All allocations are valid!');
    return;
  }

  // Show what we're about to clean up
  const byReason = {
    page_not_found: orphanedAllocations.filter(a => a.reason === 'page_not_found').length,
    page_deleted: orphanedAllocations.filter(a => a.reason === 'page_deleted').length
  };

  console.log(`   - Page not found: ${byReason.page_not_found}`);
  console.log(`   - Page deleted: ${byReason.page_deleted}\n`);

  // List some examples
  console.log('📝 Examples of orphaned allocations:');
  orphanedAllocations.slice(0, 10).forEach(({ allocation, reason }) => {
    console.log(`   - ${allocation.id}: ${allocation.pageTitle || 'No title'} (${reason}) - $${(allocation.usdCents / 100).toFixed(2)}`);
  });
  if (orphanedAllocations.length > 10) {
    console.log(`   ... and ${orphanedAllocations.length - 10} more\n`);
  }

  // Step 5: Cancel orphaned allocations
  console.log('\n🗑️ Cancelling orphaned allocations...');

  const WRITE_BATCH_SIZE = 500;
  let cancelledCount = 0;

  for (let i = 0; i < orphanedAllocations.length; i += WRITE_BATCH_SIZE) {
    const batchItems = orphanedAllocations.slice(i, i + WRITE_BATCH_SIZE);
    const writeBatch = db.batch();

    for (const { allocation, reason } of batchItems) {
      writeBatch.update(allocation.ref, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledReason: reason,
        updatedAt: new Date().toISOString()
      });
    }

    await writeBatch.commit();
    cancelledCount += batchItems.length;
    console.log(`   Cancelled ${cancelledCount} / ${orphanedAllocations.length}`);
  }

  console.log(`\n✅ Done! Cancelled ${cancelledCount} orphaned allocations.`);
}

main().catch(console.error);
