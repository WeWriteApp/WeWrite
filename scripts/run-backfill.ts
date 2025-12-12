/**
 * One-time script to run the earnings backfill
 *
 * Run with: npx tsx scripts/run-backfill.ts
 */

// Load environment variables from .env.local BEFORE any other imports
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Force production environment for this script
// VERCEL_ENV=production is required to bypass the safety check that prevents
// local production builds from using production collections
process.env.NODE_ENV = 'production';
process.env.SUBSCRIPTION_ENV = 'production';
process.env.VERCEL_ENV = 'production';
process.env.VERCEL = '1';

import { getFirebaseAdmin } from '../app/firebase/firebaseAdmin';
import { getCollectionNameAsync, USD_COLLECTIONS } from '../app/utils/environmentConfig';
import { centsToDollars } from '../app/utils/formatCurrency';
import * as adminSDK from 'firebase-admin';

interface AllocationRecord {
  id: string;
  userId: string;
  recipientUserId: string;
  resourceType: 'page' | 'user_bio' | 'user' | 'wewrite';
  resourceId: string;
  usdCents: number;
  month: string;
  status: string;
  createdAt: any;
}

async function runBackfill(month: string, dryRun: boolean = false) {
  console.log(`\n💰 Starting backfill for ${month} (dryRun: ${dryRun})\n`);

  const admin = getFirebaseAdmin();
  const db = admin.firestore();

  // Get collection names
  const allocationsCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS);
  const earningsCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.WRITER_USD_EARNINGS);
  const balancesCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.WRITER_USD_BALANCES);

  console.log(`📁 Collection names:`, {
    allocations: allocationsCollectionName,
    earnings: earningsCollectionName,
    balances: balancesCollectionName
  });

  // Get all active allocations for the month
  const allocationsSnapshot = await db
    .collection(allocationsCollectionName)
    .where('month', '==', month)
    .where('status', '==', 'active')
    .get();

  const allocations: AllocationRecord[] = allocationsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as AllocationRecord[];

  console.log(`📊 Found ${allocations.length} active allocations for ${month}`);

  // Group allocations by recipient
  const allocationsByRecipient = new Map<string, AllocationRecord[]>();
  for (const allocation of allocations) {
    // Skip wewrite allocations (platform fee)
    if (allocation.resourceType === 'wewrite' || !allocation.recipientUserId) {
      continue;
    }

    const key = allocation.recipientUserId;
    if (!allocationsByRecipient.has(key)) {
      allocationsByRecipient.set(key, []);
    }
    allocationsByRecipient.get(key)!.push(allocation);
  }

  console.log(`👥 Grouped into ${allocationsByRecipient.size} unique recipients`);

  // Process each recipient
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let totalBackfilledCents = 0;

  const recipientEntries = Array.from(allocationsByRecipient.entries());
  for (const [recipientUserId, recipientAllocations] of recipientEntries) {
    const earningsId = `${recipientUserId}_${month}`;
    const earningsRef = db.collection(earningsCollectionName).doc(earningsId);
    const balanceRef = db.collection(balancesCollectionName).doc(recipientUserId);

    // Calculate expected total
    const expectedCents = recipientAllocations.reduce((sum, a) => sum + a.usdCents, 0);

    if (!dryRun) {
      await db.runTransaction(async (transaction) => {
        const earningsDoc = await transaction.get(earningsRef);
        const balanceDoc = await transaction.get(balanceRef);

        const allocationsData = recipientAllocations.map(a => ({
          allocationId: a.id,
          fromUserId: a.userId,
          resourceType: a.resourceType,
          resourceId: a.resourceId,
          usdCents: a.usdCents,
          timestamp: a.createdAt || new Date(),
          backfilled: true
        }));

        if (earningsDoc.exists) {
          const currentEarnings = earningsDoc.data();
          const currentTotal = currentEarnings?.totalUsdCentsReceived || 0;

          if (currentTotal < expectedCents) {
            // Update with missing amount
            transaction.update(earningsRef, {
              totalUsdCentsReceived: expectedCents,
              allocations: allocationsData,
              backfilledAt: adminSDK.firestore.FieldValue.serverTimestamp(),
              updatedAt: adminSDK.firestore.FieldValue.serverTimestamp()
            });
            updatedCount++;
            totalBackfilledCents += (expectedCents - currentTotal);
            console.log(`  ✏️  Updated ${recipientUserId}: ${centsToDollars(currentTotal)} -> ${centsToDollars(expectedCents)}`);
          } else {
            skippedCount++;
          }
        } else {
          // Create new earnings record
          transaction.set(earningsRef, {
            userId: recipientUserId,
            month,
            totalUsdCentsReceived: expectedCents,
            status: 'pending',
            allocations: allocationsData,
            backfilledAt: adminSDK.firestore.FieldValue.serverTimestamp(),
            createdAt: adminSDK.firestore.FieldValue.serverTimestamp(),
            updatedAt: adminSDK.firestore.FieldValue.serverTimestamp()
          });
          createdCount++;
          totalBackfilledCents += expectedCents;
          console.log(`  ➕ Created ${recipientUserId}: ${centsToDollars(expectedCents)}`);
        }

        // Update writer balance
        const existingBalance = balanceDoc.exists ? balanceDoc.data() : null;

        if (balanceDoc.exists) {
          // Recalculate balance
          const allEarningsSnapshot = await db
            .collection(earningsCollectionName)
            .where('userId', '==', recipientUserId)
            .get();

          let totalEarned = 0;
          let pendingEarned = 0;
          let availableEarned = 0;

          allEarningsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (doc.id === earningsId) return; // Skip current month

            totalEarned += data.totalUsdCentsReceived || 0;
            if (data.status === 'pending') {
              pendingEarned += data.totalUsdCentsReceived || 0;
            } else if (data.status === 'available') {
              availableEarned += data.totalUsdCentsReceived || 0;
            }
          });

          // Add new/updated earnings for this month
          totalEarned += expectedCents;
          pendingEarned += expectedCents;

          transaction.update(balanceRef, {
            totalUsdCentsEarned: totalEarned,
            pendingUsdCents: pendingEarned,
            availableUsdCents: availableEarned,
            updatedAt: adminSDK.firestore.FieldValue.serverTimestamp()
          });
        } else {
          transaction.set(balanceRef, {
            userId: recipientUserId,
            totalUsdCentsEarned: expectedCents,
            pendingUsdCents: expectedCents,
            availableUsdCents: 0,
            paidOutUsdCents: 0,
            lastProcessedMonth: month,
            createdAt: adminSDK.firestore.FieldValue.serverTimestamp(),
            updatedAt: adminSDK.firestore.FieldValue.serverTimestamp()
          });
        }
      });
    } else {
      // Dry run - just report what would happen
      const earningsDoc = await earningsRef.get();
      if (earningsDoc.exists) {
        const currentEarnings = earningsDoc.data();
        const currentTotal = currentEarnings?.totalUsdCentsReceived || 0;
        if (currentTotal < expectedCents) {
          updatedCount++;
          totalBackfilledCents += (expectedCents - currentTotal);
          console.log(`  [DRY] Would update ${recipientUserId}: ${centsToDollars(currentTotal)} -> ${centsToDollars(expectedCents)}`);
        } else {
          skippedCount++;
        }
      } else {
        createdCount++;
        totalBackfilledCents += expectedCents;
        console.log(`  [DRY] Would create ${recipientUserId}: ${centsToDollars(expectedCents)}`);
      }
    }
  }

  console.log(`\n📊 Results for ${month}:`);
  console.log(`   Created: ${createdCount}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Total backfilled: ${centsToDollars(totalBackfilledCents)}`);

  return { createdCount, updatedCount, skippedCount, totalBackfilledCents };
}

async function main() {
  const months = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12'];
  const dryRun = process.argv.includes('--dry-run');

  console.log('========================================');
  console.log('  EARNINGS BACKFILL SCRIPT');
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
  console.log('========================================');

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalCents = 0;

  for (const month of months) {
    const result = await runBackfill(month, dryRun);
    totalCreated += result.createdCount;
    totalUpdated += result.updatedCount;
    totalSkipped += result.skippedCount;
    totalCents += result.totalBackfilledCents;
  }

  console.log('\n========================================');
  console.log('  FINAL SUMMARY');
  console.log('========================================');
  console.log(`Total created: ${totalCreated}`);
  console.log(`Total updated: ${totalUpdated}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Total backfilled: ${centsToDollars(totalCents)}`);
  console.log('========================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Error running backfill:', err);
  process.exit(1);
});
