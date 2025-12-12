import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { centsToDollars } from '../../../utils/formatCurrency';

/**
 * Migration endpoint to recalculate writer earnings based on funded allocations only.
 *
 * PROBLEM: Historical earnings records may contain unfunded amounts because the
 * funding ratio wasn't applied at write time.
 *
 * SOLUTION: This migration recalculates all WriterUsdEarnings and WriterUsdBalance
 * documents by:
 * 1. For each allocation in WriterUsdEarnings, look up the sponsor's balance
 * 2. Calculate the funding ratio for that sponsor
 * 3. Apply the ratio to get the funded amount
 * 4. Update the earnings record with correct funded totals
 * 5. Recalculate the writer's balance from corrected earnings
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development or with admin auth
    if (process.env.NODE_ENV !== 'development' && process.env.USE_DEV_AUTH !== 'true') {
      return NextResponse.json({
        error: 'Migration only available in development mode'
      }, { status: 400 });
    }

    const admin = initAdmin();
    const db = admin.firestore();

    const results = {
      writerEarningsProcessed: 0,
      writerBalancesUpdated: 0,
      allocationsAdjusted: 0,
      totalOriginalCents: 0,
      totalFundedCents: 0,
      errors: [] as string[]
    };

    console.log('[MIGRATION] Starting funded earnings migration...');

    // Step 1: Get all WriterUsdEarnings documents
    const earningsCollection = getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS);
    const earningsSnapshot = await db.collection(earningsCollection).get();

    console.log(`[MIGRATION] Found ${earningsSnapshot.size} earnings records to process`);

    // Cache sponsor balances to avoid repeated lookups
    const sponsorBalanceCache = new Map<string, { totalUsdCents: number; allocatedUsdCents: number } | null>();

    // Process each earnings document
    for (const earningsDoc of earningsSnapshot.docs) {
      try {
        const earnings = earningsDoc.data();
        const allocations = earnings.allocations || [];

        if (allocations.length === 0) {
          continue;
        }

        let totalFundedCents = 0;
        const updatedAllocations = [];

        // Process each allocation within this earnings record
        for (const allocation of allocations) {
          const fromUserId = allocation.fromUserId;
          const originalCents = allocation.usdCents || 0;
          results.totalOriginalCents += originalCents;

          // Get sponsor balance (cached)
          if (!sponsorBalanceCache.has(fromUserId)) {
            const balanceDoc = await db.collection(getCollectionName(USD_COLLECTIONS.USD_BALANCES))
              .doc(fromUserId)
              .get();

            if (balanceDoc.exists) {
              const data = balanceDoc.data();
              sponsorBalanceCache.set(fromUserId, {
                totalUsdCents: data?.totalUsdCents || 0,
                allocatedUsdCents: data?.allocatedUsdCents || 0
              });
            } else {
              sponsorBalanceCache.set(fromUserId, null);
            }
          }

          const sponsorBalance = sponsorBalanceCache.get(fromUserId);
          let fundedCents = originalCents;

          if (!sponsorBalance) {
            // No sponsor balance = unfunded
            fundedCents = 0;
            console.log(`[MIGRATION] Sponsor ${fromUserId} has no balance - allocation unfunded`);
          } else if (sponsorBalance.allocatedUsdCents > sponsorBalance.totalUsdCents && sponsorBalance.allocatedUsdCents > 0) {
            // Over-allocated - apply funding ratio
            const fundingRatio = sponsorBalance.totalUsdCents / sponsorBalance.allocatedUsdCents;
            fundedCents = Math.round(originalCents * fundingRatio);
            console.log(`[MIGRATION] Sponsor ${fromUserId} over-allocated: ${originalCents} -> ${fundedCents} (ratio: ${fundingRatio.toFixed(4)})`);
            results.allocationsAdjusted++;
          }

          totalFundedCents += fundedCents;
          results.totalFundedCents += fundedCents;

          // Update allocation with funded amount
          updatedAllocations.push({
            ...allocation,
            usdCents: fundedCents,
            originalUsdCents: originalCents // Keep original for auditing
          });
        }

        // Update the earnings document with corrected values
        await earningsDoc.ref.update({
          totalUsdCentsReceived: totalFundedCents,
          allocations: updatedAllocations,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          migrationNote: 'Recalculated with funding ratio'
        });

        results.writerEarningsProcessed++;

      } catch (error) {
        const errorMsg = `Error processing earnings ${earningsDoc.id}: ${error.message}`;
        console.error(`[MIGRATION] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    // Step 2: Recalculate all writer balances from corrected earnings
    const affectedWriters = new Set<string>();
    earningsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        affectedWriters.add(data.userId);
      }
    });

    console.log(`[MIGRATION] Recalculating balances for ${affectedWriters.size} writers`);

    for (const writerId of affectedWriters) {
      try {
        // Get all earnings for this writer
        const writerEarningsSnapshot = await db.collection(earningsCollection)
          .where('userId', '==', writerId)
          .get();

        // Calculate totals
        let totalUsdCentsEarned = 0;
        let pendingUsdCents = 0;
        let availableUsdCents = 0;
        let paidOutUsdCents = 0;
        let lastProcessedMonth = '';

        writerEarningsSnapshot.docs.forEach(doc => {
          const earnings = doc.data();
          totalUsdCentsEarned += earnings.totalUsdCentsReceived || 0;

          if (earnings.status === 'pending') {
            pendingUsdCents += earnings.totalUsdCentsReceived || 0;
          } else if (earnings.status === 'available') {
            availableUsdCents += earnings.totalUsdCentsReceived || 0;
          } else if (earnings.status === 'paid_out') {
            paidOutUsdCents += earnings.totalUsdCentsReceived || 0;
          }

          if (earnings.month > lastProcessedMonth) {
            lastProcessedMonth = earnings.month;
          }
        });

        // Update the balance document
        const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(writerId);
        await balanceRef.set({
          userId: writerId,
          totalUsdCentsEarned,
          pendingUsdCents,
          availableUsdCents,
          paidOutUsdCents,
          lastProcessedMonth,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        results.writerBalancesUpdated++;
        console.log(`[MIGRATION] Updated balance for writer ${writerId}: $${centsToDollars(totalUsdCentsEarned)} total, $${centsToDollars(pendingUsdCents)} pending, $${centsToDollars(availableUsdCents)} available`);

      } catch (error) {
        const errorMsg = `Error updating balance for ${writerId}: ${error.message}`;
        console.error(`[MIGRATION] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    const savings = results.totalOriginalCents - results.totalFundedCents;

    console.log('[MIGRATION] Migration completed:', {
      ...results,
      totalOriginalDollars: centsToDollars(results.totalOriginalCents),
      totalFundedDollars: centsToDollars(results.totalFundedCents),
      savingsDollars: centsToDollars(savings)
    });

    return NextResponse.json({
      success: true,
      message: 'Funded earnings migration completed',
      results: {
        writerEarningsProcessed: results.writerEarningsProcessed,
        writerBalancesUpdated: results.writerBalancesUpdated,
        allocationsAdjusted: results.allocationsAdjusted,
        totalOriginalDollars: centsToDollars(results.totalOriginalCents),
        totalFundedDollars: centsToDollars(results.totalFundedCents),
        savingsDollars: centsToDollars(savings),
        errorCount: results.errors.length,
        errors: results.errors.slice(0, 10) // Only return first 10 errors
      }
    });

  } catch (error) {
    console.error('[MIGRATION] Error in funded earnings migration:', error);
    return NextResponse.json({
      error: 'Failed to run funded earnings migration',
      message: error.message
    }, { status: 500 });
  }
}
