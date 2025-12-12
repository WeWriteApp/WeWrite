/**
 * Earnings Backfill API
 *
 * Admin endpoint for reconciling and backfilling missing writer earnings
 * from existing USD allocations. This fixes the discrepancy between
 * subscriber allocations and writer earnings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { getCurrentMonth } from '../../../utils/subscriptionTiers';
import { centsToDollars } from '../../../utils/formatCurrency';
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

interface EarningsRecord {
  userId: string;
  month: string;
  totalUsdCentsReceived: number;
  allocations: any[];
}

interface ReconciliationResult {
  allocationId: string;
  recipientUserId: string;
  resourceId: string;
  resourceType: string;
  usdCents: number;
  month: string;
  action: 'created' | 'updated' | 'skipped';
  reason?: string;
}

/**
 * GET /api/admin/backfill-earnings
 * Preview what would be backfilled (dry run)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = `backfill_${Date.now()}`;

  try {
    // Verify admin access via cookie-based auth (from middleware)
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || getCurrentMonth();
    const debug = searchParams.get('debug') === 'true';

    console.log(`📊 [BACKFILL PREVIEW] [${correlationId}] Starting preview for month: ${month}`);

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get collection name for allocations
    const allocationsCollectionName = getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS);
    const earningsCollectionName = getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS);

    console.log(`📊 [BACKFILL PREVIEW] [${correlationId}] Collection names:`, {
      allocations: allocationsCollectionName,
      earnings: earningsCollectionName
    });

    // DEBUG: First, get ALL allocations without any filters to see what exists
    let debugInfo: any = {};
    if (debug) {
      const allAllocationsSnapshot = await db
        .collection(allocationsCollectionName)
        .limit(100)
        .get();

      debugInfo.totalAllocationsInCollection = allAllocationsSnapshot.size;
      debugInfo.sampleAllocations = allAllocationsSnapshot.docs.slice(0, 5).map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get unique months and statuses
      const months = new Set<string>();
      const statuses = new Set<string>();
      allAllocationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.month) months.add(data.month);
        if (data.status) statuses.add(data.status);
      });
      debugInfo.uniqueMonths = Array.from(months);
      debugInfo.uniqueStatuses = Array.from(statuses);

      console.log(`📊 [BACKFILL PREVIEW] [${correlationId}] Debug info:`, debugInfo);
    }

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

    console.log(`📊 [BACKFILL PREVIEW] [${correlationId}] Found ${allocations.length} allocations for ${month}`);

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

    // Get existing earnings for the month
    const earningsSnapshot = await db
      .collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
      .where('month', '==', month)
      .get();

    const existingEarnings = new Map<string, EarningsRecord>();
    earningsSnapshot.docs.forEach(doc => {
      const data = doc.data() as EarningsRecord;
      existingEarnings.set(data.userId, data);
    });

    console.log(`📊 [BACKFILL PREVIEW] [${correlationId}] Found ${existingEarnings.size} existing earnings records`);

    // Calculate discrepancies
    const discrepancies: {
      recipientUserId: string;
      expectedCents: number;
      actualCents: number;
      discrepancyCents: number;
      allocationCount: number;
    }[] = [];

    let totalExpectedCents = 0;
    let totalActualCents = 0;
    let missingRecipients = 0;
    let underCountedRecipients = 0;

    Array.from(allocationsByRecipient.entries()).forEach(([recipientUserId, recipientAllocations]) => {
      const expectedCents = recipientAllocations.reduce((sum, a) => sum + a.usdCents, 0);
      const existingEarning = existingEarnings.get(recipientUserId);
      const actualCents = existingEarning?.totalUsdCentsReceived || 0;

      totalExpectedCents += expectedCents;
      totalActualCents += actualCents;

      if (expectedCents !== actualCents) {
        if (actualCents === 0) {
          missingRecipients++;
        } else {
          underCountedRecipients++;
        }

        discrepancies.push({
          recipientUserId,
          expectedCents,
          actualCents,
          discrepancyCents: expectedCents - actualCents,
          allocationCount: recipientAllocations.length
        });
      }
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        month,
        collectionNames: {
          allocations: allocationsCollectionName,
          earnings: earningsCollectionName
        },
        debug: debug ? debugInfo : undefined,
        summary: {
          totalAllocations: allocations.length,
          uniqueRecipients: allocationsByRecipient.size,
          existingEarningsRecords: existingEarnings.size,
          totalExpectedCents,
          totalActualCents,
          discrepancyCents: totalExpectedCents - totalActualCents,
          discrepancyDollars: centsToDollars(totalExpectedCents - totalActualCents),
          missingRecipients,
          underCountedRecipients
        },
        discrepancies: discrepancies.slice(0, 100), // Limit to first 100
        totalDiscrepancies: discrepancies.length,
        duration: `${duration}ms`
      },
      correlationId
    });

  } catch (error: any) {
    console.error(`📊 [BACKFILL PREVIEW] [${correlationId}] Error:`, error);
    return NextResponse.json({
      error: 'Failed to preview earnings backfill',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/backfill-earnings
 * Execute the backfill (creates/updates missing earnings)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = `backfill_exec_${Date.now()}`;

  try {
    const body = await request.json();
    const { month, dryRun = true } = body;

    if (!month) {
      return NextResponse.json({
        error: 'Month is required (YYYY-MM format)',
        correlationId
      }, { status: 400 });
    }

    console.log(`💰 [BACKFILL EXECUTE] [${correlationId}] Starting backfill for ${month} (dryRun: ${dryRun})`);

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get all active allocations for the month
    const allocationsSnapshot = await db
      .collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS))
      .where('month', '==', month)
      .where('status', '==', 'active')
      .get();

    const allocations: AllocationRecord[] = allocationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AllocationRecord[];

    console.log(`💰 [BACKFILL EXECUTE] [${correlationId}] Found ${allocations.length} allocations`);

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

    // Process each recipient
    const results: ReconciliationResult[] = [];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let totalBackfilledCents = 0;

    const recipientEntries = Array.from(allocationsByRecipient.entries());
    for (const [recipientUserId, recipientAllocations] of recipientEntries) {
      const earningsId = `${recipientUserId}_${month}`;
      const earningsRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)).doc(earningsId);
      const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(recipientUserId);

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

              results.push({
                allocationId: recipientAllocations[0].id,
                recipientUserId,
                resourceId: recipientAllocations[0].resourceId,
                resourceType: recipientAllocations[0].resourceType,
                usdCents: expectedCents - currentTotal,
                month,
                action: 'updated',
                reason: `Updated from ${centsToDollars(currentTotal)} to ${centsToDollars(expectedCents)}`
              });
            } else {
              skippedCount++;
              results.push({
                allocationId: recipientAllocations[0].id,
                recipientUserId,
                resourceId: recipientAllocations[0].resourceId,
                resourceType: recipientAllocations[0].resourceType,
                usdCents: 0,
                month,
                action: 'skipped',
                reason: 'Earnings already correct or higher'
              });
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

            results.push({
              allocationId: recipientAllocations[0].id,
              recipientUserId,
              resourceId: recipientAllocations[0].resourceId,
              resourceType: recipientAllocations[0].resourceType,
              usdCents: expectedCents,
              month,
              action: 'created',
              reason: `Created new earnings record with ${centsToDollars(expectedCents)}`
            });
          }

          // Update writer balance
          const existingBalance = balanceDoc.exists ? balanceDoc.data() : null;
          const newPending = (existingBalance?.pendingUsdCents || 0) + (balanceDoc.exists ? 0 : expectedCents);
          const newTotal = (existingBalance?.totalUsdCentsEarned || 0) + (balanceDoc.exists ? 0 : expectedCents);

          if (balanceDoc.exists) {
            // Recalculate balance from what we're about to write
            // Since we're in a transaction and just created/updated earnings,
            // we need to calculate what the total should be after this transaction
            const allEarningsSnapshot = await db
              .collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
              .where('userId', '==', recipientUserId)
              .get();

            let totalEarned = 0;
            let pendingEarned = 0;
            let availableEarned = 0;

            // Sum up existing earnings (excluding the one we're updating)
            allEarningsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              // Skip the current month's earnings - we'll use expectedCents instead
              if (doc.id === earningsId) return;

              totalEarned += data.totalUsdCentsReceived || 0;
              if (data.status === 'pending') {
                pendingEarned += data.totalUsdCentsReceived || 0;
              } else if (data.status === 'available') {
                availableEarned += data.totalUsdCentsReceived || 0;
              }
            });

            // Add the new/updated earnings for this month
            totalEarned += expectedCents;
            pendingEarned += expectedCents; // New backfilled earnings are 'pending'

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
        // Dry run - just record what would happen
        const earningsDoc = await earningsRef.get();
        if (earningsDoc.exists) {
          const currentEarnings = earningsDoc.data();
          const currentTotal = currentEarnings?.totalUsdCentsReceived || 0;
          if (currentTotal < expectedCents) {
            updatedCount++;
            totalBackfilledCents += (expectedCents - currentTotal);
            results.push({
              allocationId: recipientAllocations[0].id,
              recipientUserId,
              resourceId: recipientAllocations[0].resourceId,
              resourceType: recipientAllocations[0].resourceType,
              usdCents: expectedCents - currentTotal,
              month,
              action: 'updated',
              reason: `Would update from ${centsToDollars(currentTotal)} to ${centsToDollars(expectedCents)}`
            });
          } else {
            skippedCount++;
          }
        } else {
          createdCount++;
          totalBackfilledCents += expectedCents;
          results.push({
            allocationId: recipientAllocations[0].id,
            recipientUserId,
            resourceId: recipientAllocations[0].resourceId,
            resourceType: recipientAllocations[0].resourceType,
            usdCents: expectedCents,
            month,
            action: 'created',
            reason: `Would create new earnings record with ${centsToDollars(expectedCents)}`
          });
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log(`💰 [BACKFILL EXECUTE] [${correlationId}] Completed in ${duration}ms`, {
      dryRun,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      totalBackfilledCents
    });

    return NextResponse.json({
      success: true,
      data: {
        month,
        dryRun,
        summary: {
          created: createdCount,
          updated: updatedCount,
          skipped: skippedCount,
          totalBackfilledCents,
          totalBackfilledDollars: centsToDollars(totalBackfilledCents)
        },
        results: results.slice(0, 100), // Limit to first 100
        totalResults: results.length,
        duration: `${duration}ms`
      },
      correlationId
    });

  } catch (error: any) {
    console.error(`💰 [BACKFILL EXECUTE] [${correlationId}] Error:`, error);
    return NextResponse.json({
      error: 'Failed to execute earnings backfill',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}
