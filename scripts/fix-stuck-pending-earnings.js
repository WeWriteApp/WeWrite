/**
 * Fix Stuck Pending Earnings Script
 * 
 * This script converts all pending earnings to available status
 * and recalculates writer balances. Run this after deploying the
 * cron job fix to immediately make stuck earnings available for payout.
 * 
 * Usage:
 *   node scripts/fix-stuck-pending-earnings.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Show what would be done without making changes
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '..', 'firebase-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Environment prefix for collections
const ENV_PREFIX = process.env.NEXT_PUBLIC_FIRESTORE_ENV_PREFIX || '';
const getCollectionName = (name) => ENV_PREFIX ? `${ENV_PREFIX}_${name}` : name;

async function fixStuckEarnings(dryRun = false) {
  console.log('='.repeat(60));
  console.log('Fix Stuck Pending Earnings Script');
  console.log('Mode:', dryRun ? 'DRY RUN (no changes)' : 'LIVE');
  console.log('='.repeat(60));
  console.log();

  try {
    // Step 1: Find all pending earnings
    console.log('Step 1: Querying pending earnings...');
    const pendingQuery = await db.collection(getCollectionName('writerUsdEarnings'))
      .where('status', '==', 'pending')
      .get();

    console.log(`Found ${pendingQuery.size} pending earnings records`);
    console.log();

    if (pendingQuery.size === 0) {
      console.log('✅ No stuck pending earnings found!');
      return;
    }

    // Step 2: Group by user
    const earningsByUser = new Map();
    let totalCents = 0;

    pendingQuery.docs.forEach(doc => {
      const data = doc.data();
      const userId = data.userId;
      const amount = data.totalUsdCentsReceived || 0;
      
      if (!earningsByUser.has(userId)) {
        earningsByUser.set(userId, { docs: [], totalCents: 0 });
      }
      
      earningsByUser.get(userId).docs.push(doc);
      earningsByUser.get(userId).totalCents += amount;
      totalCents += amount;
    });

    console.log(`Affecting ${earningsByUser.size} writers`);
    console.log(`Total pending amount: $${(totalCents / 100).toFixed(2)}`);
    console.log();

    // Show breakdown by user
    console.log('Breakdown by writer:');
    console.log('-'.repeat(40));
    for (const [userId, data] of earningsByUser) {
      console.log(`  ${userId}: ${data.docs.length} records, $${(data.totalCents / 100).toFixed(2)}`);
    }
    console.log();

    if (dryRun) {
      console.log('🔸 DRY RUN: No changes made');
      console.log('  Run without --dry-run to apply changes');
      return;
    }

    // Step 3: Update all pending earnings to available
    console.log('Step 2: Updating earnings status to available...');
    
    const batchSize = 500;
    let processed = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of pendingQuery.docs) {
      batch.update(doc.ref, {
        status: 'available',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        fixedByScript: true,
        fixedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      batchCount++;
      processed++;

      if (batchCount >= batchSize) {
        await batch.commit();
        console.log(`  Committed batch (${processed}/${pendingQuery.size})`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`  Committed final batch (${processed}/${pendingQuery.size})`);
    }

    console.log(`✅ Updated ${processed} earnings records to available`);
    console.log();

    // Step 4: Recalculate all affected writer balances
    console.log('Step 3: Recalculating writer balances...');
    
    let balancesUpdated = 0;
    for (const userId of earningsByUser.keys()) {
      await recalculateWriterBalance(userId);
      balancesUpdated++;
      
      if (balancesUpdated % 10 === 0) {
        console.log(`  Processed ${balancesUpdated}/${earningsByUser.size} writers`);
      }
    }

    console.log(`✅ Recalculated ${balancesUpdated} writer balances`);
    console.log();

    // Step 5: Summary
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Earnings records updated: ${processed}`);
    console.log(`Writers affected: ${earningsByUser.size}`);
    console.log(`Total amount now available: $${(totalCents / 100).toFixed(2)}`);
    console.log();
    console.log('✅ Script completed successfully!');
    console.log();
    console.log('Next steps:');
    console.log('1. Verify writer balances in admin panel');
    console.log('2. Writers can now request payouts for available amounts');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

async function recalculateWriterBalance(userId) {
  const earningsQuery = await db.collection(getCollectionName('writerUsdEarnings'))
    .where('userId', '==', userId)
    .get();

  let totalUsdCentsEarned = 0;
  let pendingUsdCents = 0;
  let availableUsdCents = 0;
  let paidOutUsdCents = 0;
  let lastProcessedMonth = '';

  earningsQuery.docs.forEach(doc => {
    const data = doc.data();
    const amount = data.totalUsdCentsReceived || 0;
    
    totalUsdCentsEarned += amount;

    switch (data.status) {
      case 'pending':
        pendingUsdCents += amount;
        break;
      case 'available':
        availableUsdCents += amount;
        break;
      case 'paid_out':
        paidOutUsdCents += amount;
        break;
    }

    if (data.month && data.month > lastProcessedMonth) {
      lastProcessedMonth = data.month;
    }
  });

  const balanceRef = db.collection(getCollectionName('writerUsdBalances')).doc(userId);
  await balanceRef.set({
    userId,
    totalUsdCentsEarned,
    pendingUsdCents,
    availableUsdCents,
    paidOutUsdCents,
    lastProcessedMonth,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    recalculatedByScript: true
  }, { merge: true });
}

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run the script
fixStuckEarnings(dryRun)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
