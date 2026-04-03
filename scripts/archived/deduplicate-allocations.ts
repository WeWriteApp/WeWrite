/**
 * Script to find and deduplicate allocation records
 *
 * This script identifies allocations where the same user has multiple active
 * allocations for the same resource (page/user) in the same month, which should
 * be impossible according to business logic.
 *
 * Usage:
 *   npx tsx scripts/deduplicate-allocations.ts           # Dry run on dev
 *   npx tsx scripts/deduplicate-allocations.ts --prod    # Dry run on prod
 *   npx tsx scripts/deduplicate-allocations.ts --execute # Execute on dev
 *   npx tsx scripts/deduplicate-allocations.ts --prod --execute # Execute on prod
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const dryRun = !process.argv.includes('--execute');
const isProd = process.argv.includes('--prod');

console.log(`\n🔧 Allocation Deduplication Script`);
console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  EXECUTE MODE (will merge duplicates)'}`);
console.log(`Environment: ${isProd ? '🚨 PRODUCTION' : '🧪 DEVELOPMENT'}\n`);

// Initialize Firebase Admin
function initAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  let serviceAccount: any;

  const jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON;

  if (jsonString) {
    let parsedString = jsonString;

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
    throw new Error('Missing required service account credentials.');
  }

  console.log(`Using service account: ${serviceAccount.client_email}`);

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

interface AllocationDoc {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  data: {
    userId: string;
    resourceId: string;
    resourceType: string;
    month: string;
    status: string;
    usdCents: number;
    pageTitle?: string;
    authorUsername?: string;
    recipientUserId?: string;
    createdAt?: any;
    updatedAt?: any;
  };
}

interface DuplicateGroup {
  key: string; // userId-resourceId-resourceType-month
  allocations: AllocationDoc[];
  totalCents: number;
  userId: string;
  resourceId: string;
  resourceType: string;
  month: string;
}

async function deduplicateAllocations() {
  const app = initAdmin();
  const db = getFirestore(app);

  const collectionPrefix = isProd ? '' : 'DEV_';
  const collectionName = `${collectionPrefix}usdAllocations`;

  console.log(`Collection: "${collectionName}"\n`);

  // Query all active allocations
  const allocationsRef = db.collection(collectionName);
  const allocationsQuery = allocationsRef.where('status', '==', 'active');

  const allocationsSnapshot = await allocationsQuery.get();
  console.log(`📊 Found ${allocationsSnapshot.size} total active allocations\n`);

  if (allocationsSnapshot.empty) {
    console.log('✅ No active allocations found. Nothing to check.');
    return;
  }

  // Group allocations by unique key (userId + resourceId + resourceType + month)
  const allocationGroups = new Map<string, AllocationDoc[]>();

  allocationsSnapshot.docs.forEach(doc => {
    const data = doc.data() as AllocationDoc['data'];
    const key = `${data.userId}|${data.resourceId}|${data.resourceType}|${data.month}`;

    if (!allocationGroups.has(key)) {
      allocationGroups.set(key, []);
    }

    allocationGroups.get(key)!.push({
      id: doc.id,
      ref: doc.ref,
      data
    });
  });

  // Find duplicate groups (more than 1 allocation per key)
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [key, allocations] of allocationGroups) {
    if (allocations.length > 1) {
      const [userId, resourceId, resourceType, month] = key.split('|');
      const totalCents = allocations.reduce((sum, a) => sum + (a.data.usdCents || 0), 0);

      duplicateGroups.push({
        key,
        allocations,
        totalCents,
        userId,
        resourceId,
        resourceType,
        month
      });
    }
  }

  console.log(`🔍 Analysis Complete:`);
  console.log(`   Unique allocation keys: ${allocationGroups.size}`);
  console.log(`   Groups with duplicates: ${duplicateGroups.length}`);
  console.log(`   Total duplicate allocations: ${duplicateGroups.reduce((sum, g) => sum + g.allocations.length - 1, 0)}`);
  console.log('');

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate allocations found. Database is clean.');
    return;
  }

  // Show details of duplicate groups
  console.log('📋 Duplicate Groups:');
  console.log('='.repeat(100));

  let totalDuplicatesToRemove = 0;
  let totalCentsDuplicated = 0;

  for (const group of duplicateGroups) {
    console.log(`\nKey: ${group.key}`);
    console.log(`  User: ${group.userId}`);
    console.log(`  Resource: ${group.resourceType}/${group.resourceId}`);
    console.log(`  Month: ${group.month}`);
    console.log(`  Duplicate count: ${group.allocations.length}`);

    // Sort by createdAt to keep the oldest (or by usdCents to keep the highest)
    const sorted = [...group.allocations].sort((a, b) => {
      // If createdAt exists, use it; otherwise use usdCents (keep highest)
      const aTime = a.data.createdAt?.toMillis?.() || a.data.createdAt?._seconds * 1000 || 0;
      const bTime = b.data.createdAt?.toMillis?.() || b.data.createdAt?._seconds * 1000 || 0;
      if (aTime && bTime) return aTime - bTime;
      return (b.data.usdCents || 0) - (a.data.usdCents || 0);
    });

    const keepAllocation = sorted[0];
    const removeAllocations = sorted.slice(1);

    // Calculate what the correct amount should be (use the highest individual amount, not sum)
    // Since duplicates are created by race conditions, they usually have the same or similar amounts
    // We should keep the most recent amount as it reflects user intent
    const correctCents = Math.max(...group.allocations.map(a => a.data.usdCents || 0));

    console.log(`\n  Allocations in group:`);
    for (const alloc of sorted) {
      const isKeep = alloc.id === keepAllocation.id;
      const marker = isKeep ? '✓ KEEP' : '✗ REMOVE';
      const createdAt = alloc.data.createdAt?.toDate?.()?.toISOString() ||
                        (alloc.data.createdAt?._seconds ? new Date(alloc.data.createdAt._seconds * 1000).toISOString() : 'unknown');
      console.log(`    [${marker}] ID: ${alloc.id}`);
      console.log(`             Amount: $${((alloc.data.usdCents || 0) / 100).toFixed(2)}`);
      console.log(`             Created: ${createdAt}`);
      console.log(`             Title: ${alloc.data.pageTitle || '(none)'}`);
    }

    totalDuplicatesToRemove += removeAllocations.length;
    totalCentsDuplicated += removeAllocations.reduce((sum, a) => sum + (a.data.usdCents || 0), 0);

    console.log(`\n  Action: Keep allocation ${keepAllocation.id} with $${(correctCents / 100).toFixed(2)}`);
    console.log(`          Remove ${removeAllocations.length} duplicate(s)`);
    console.log('-'.repeat(100));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Duplicate groups: ${duplicateGroups.length}`);
  console.log(`   Allocations to remove: ${totalDuplicatesToRemove}`);
  console.log(`   Total duplicate cents: $${(totalCentsDuplicated / 100).toFixed(2)}`);

  if (dryRun) {
    console.log('\nℹ️  DRY RUN - No changes made.');
    console.log('   Run with --execute flag to merge these duplicates.');
    return;
  }

  // Execute the deduplication
  console.log('\n⚠️  Executing deduplication...\n');

  let mergedCount = 0;
  let removedCount = 0;
  let errorCount = 0;

  for (const group of duplicateGroups) {
    // Sort to find the one to keep
    const sorted = [...group.allocations].sort((a, b) => {
      const aTime = a.data.createdAt?.toMillis?.() || a.data.createdAt?._seconds * 1000 || 0;
      const bTime = b.data.createdAt?.toMillis?.() || b.data.createdAt?._seconds * 1000 || 0;
      if (aTime && bTime) return aTime - bTime;
      return (b.data.usdCents || 0) - (a.data.usdCents || 0);
    });

    const keepAllocation = sorted[0];
    const removeAllocations = sorted.slice(1);

    // Use the highest amount as the correct value
    const correctCents = Math.max(...group.allocations.map(a => a.data.usdCents || 0));

    try {
      const batch = db.batch();

      // Update the kept allocation with the correct amount
      batch.update(keepAllocation.ref, {
        usdCents: correctCents,
        updatedAt: FieldValue.serverTimestamp(),
        _deduplicatedAt: FieldValue.serverTimestamp(),
        _deduplicatedFrom: removeAllocations.map(a => a.id)
      });

      // Cancel the duplicate allocations
      for (const alloc of removeAllocations) {
        batch.update(alloc.ref, {
          status: 'cancelled',
          cancelledAt: FieldValue.serverTimestamp(),
          cancelledReason: 'duplicate_merged',
          _mergedInto: keepAllocation.id,
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      await batch.commit();

      mergedCount++;
      removedCount += removeAllocations.length;
      console.log(`   ✅ Merged group ${group.key}: kept ${keepAllocation.id}, removed ${removeAllocations.length} duplicates`);
    } catch (error) {
      errorCount++;
      console.error(`   ❌ Failed to merge group ${group.key}:`, error);
    }
  }

  console.log(`\n🏁 Deduplication Complete:`);
  console.log(`   Groups merged: ${mergedCount}`);
  console.log(`   Duplicates removed: ${removedCount}`);
  console.log(`   Errors: ${errorCount}`);
}

deduplicateAllocations()
  .then(() => {
    console.log('\n✅ Script finished successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
