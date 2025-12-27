/**
 * Stale Payment Data Cleanup API
 *
 * Compares Firestore payment records with Stripe and identifies/removes stale data.
 * Stale data = records in Firestore that don't exist in Stripe (from before Stripe integration worked)
 *
 * This is a one-time cleanup endpoint for data hygiene.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { isAdminUser } from '../../../utils/adminUtils';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import Stripe from 'stripe';
import * as adminSdk from 'firebase-admin';
import { detectEnvironmentType } from '../../../utils/environmentDetection';
import { withAdminContext } from '../../../utils/adminRequestContext';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

export const dynamic = 'force-dynamic';

// Helper to check for localhost dev bypass
function isLocalhostDevBypass(request: NextRequest): boolean {
  const envType = detectEnvironmentType();
  const host = request.headers.get('host') || '';
  return envType === 'development' && (host.includes('localhost') || host.includes('127.0.0.1'));
}

interface CleanupResult {
  collection: string;
  totalRecords: number;
  staleRecords: number;
  deletedRecords: number;
  details: Array<{
    docId: string;
    reason: string;
    deleted: boolean;
  }>;
}

export async function POST(request: NextRequest) {
  return withAdminContext(request, async () => {
    const startTime = Date.now();
    const devBypass = isLocalhostDevBypass(request);

    try {
      // Verify admin access (or allow dev bypass for localhost)
      const userId = await getUserIdFromRequest(request);
      if (!userId && !devBypass) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const isAdmin = userId ? await isAdminUser(userId) : false;
      if (!isAdmin && !devBypass) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry run for safety

    console.log(`🧹 [CLEANUP] Starting stale payment cleanup (dryRun: ${dryRun})`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 503 });
    }

    const db = admin.firestore();
    const results: CleanupResult[] = [];

    // 1. Clean up usdPayouts - records with stripePayoutId that don't exist in Stripe
    const payoutsResult = await cleanupPayouts(db, dryRun);
    results.push(payoutsResult);

    // 2. Clean up writerUsdBalances - reset balances for users with no valid earnings
    const balancesResult = await cleanupWriterBalances(db, dryRun);
    results.push(balancesResult);

    // 3. Clean up writerUsdEarnings - orphaned or invalid earnings records
    const earningsResult = await cleanupWriterEarnings(db, dryRun);
    results.push(earningsResult);

    const summary = {
      dryRun,
      totalCollections: results.length,
      totalRecordsScanned: results.reduce((sum, r) => sum + r.totalRecords, 0),
      totalStaleFound: results.reduce((sum, r) => sum + r.staleRecords, 0),
      totalDeleted: results.reduce((sum, r) => sum + r.deletedRecords, 0),
      durationMs: Date.now() - startTime,
    };

    console.log(`🧹 [CLEANUP] Complete:`, summary);

    return NextResponse.json({
      success: true,
      summary,
      results,
      message: dryRun
        ? 'Dry run complete. Set dryRun: false to actually delete records.'
        : 'Cleanup complete. Stale records have been removed.',
    });

    } catch (error) {
      console.error('❌ [CLEANUP] Error:', error);
      return NextResponse.json({
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }); // End withAdminContext
}

async function cleanupPayouts(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean
): Promise<CleanupResult> {
  const collectionName = getCollectionName(USD_COLLECTIONS.USD_PAYOUTS);
  console.log(`🔍 [CLEANUP] Scanning ${collectionName}...`);

  const result: CleanupResult = {
    collection: collectionName,
    totalRecords: 0,
    staleRecords: 0,
    deletedRecords: 0,
    details: [],
  };

  try {
    const snapshot = await db.collection(collectionName).get();
    result.totalRecords = snapshot.size;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const stripePayoutId = data.stripePayoutId;
      let isStale = false;
      let reason = '';

      // Check if this payout has a Stripe payout ID
      if (stripePayoutId) {
        // Verify it exists in Stripe
        try {
          await stripe.payouts.retrieve(stripePayoutId);
          // Payout exists in Stripe, not stale
        } catch (stripeError: any) {
          if (stripeError.code === 'resource_missing') {
            isStale = true;
            reason = `Stripe payout ${stripePayoutId} not found`;
          }
        }
      } else if (data.status === 'completed') {
        // Completed payout without Stripe ID is suspicious
        isStale = true;
        reason = 'Completed payout without stripePayoutId';
      } else if (data.status === 'pending' && data.requestedAt) {
        // Check if pending payout is older than 7 days (should have been processed)
        const requestedAt = data.requestedAt?.toDate?.() || new Date(data.requestedAt);
        const daysSinceRequest = (Date.now() - requestedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceRequest > 7) {
          isStale = true;
          reason = `Pending payout stuck for ${Math.round(daysSinceRequest)} days`;
        }
      }

      if (isStale) {
        result.staleRecords++;

        if (!dryRun) {
          await doc.ref.delete();
          result.deletedRecords++;
        }

        result.details.push({
          docId: doc.id,
          reason,
          deleted: !dryRun,
        });
      }
    }
  } catch (error) {
    console.error(`❌ [CLEANUP] Error scanning ${collectionName}:`, error);
  }

  console.log(`📊 [CLEANUP] ${collectionName}: ${result.staleRecords}/${result.totalRecords} stale`);
  return result;
}

async function cleanupWriterBalances(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean
): Promise<CleanupResult> {
  const collectionName = getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES);
  console.log(`🔍 [CLEANUP] Scanning ${collectionName}...`);

  const result: CleanupResult = {
    collection: collectionName,
    totalRecords: 0,
    staleRecords: 0,
    deletedRecords: 0,
    details: [],
  };

  try {
    const snapshot = await db.collection(collectionName).get();
    result.totalRecords = snapshot.size;

    // Get all earnings to cross-reference
    const earningsCollectionName = getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS);
    const earningsSnapshot = await db.collection(earningsCollectionName).get();

    // Build a map of userId -> total earnings
    const earningsByUser = new Map<string, number>();
    earningsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const userId = data.userId;
      const cents = data.totalUsdCentsReceived || data.totalCentsReceived || 0;
      earningsByUser.set(userId, (earningsByUser.get(userId) || 0) + cents);
    });

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const userId = doc.id;
      let isStale = false;
      let reason = '';

      const balanceAvailable = data.availableUsdCents || 0;
      const balancePending = data.pendingUsdCents || 0;
      const balanceTotal = data.totalUsdCentsEarned || 0;
      const actualEarnings = earningsByUser.get(userId) || 0;

      // Balance claims more than what's in earnings records
      if (balanceTotal > actualEarnings && actualEarnings === 0) {
        isStale = true;
        reason = `Balance shows $${(balanceTotal/100).toFixed(2)} earned but no earnings records exist`;
      }
      // Balance has available funds but no corresponding earnings
      else if (balanceAvailable > 0 && actualEarnings === 0) {
        isStale = true;
        reason = `Available balance $${(balanceAvailable/100).toFixed(2)} but no earnings records`;
      }

      if (isStale) {
        result.staleRecords++;

        if (!dryRun) {
          // Reset the balance to 0 instead of deleting
          await doc.ref.update({
            availableUsdCents: 0,
            pendingUsdCents: 0,
            totalUsdCentsEarned: 0,
            paidOutUsdCents: 0,
            cleanedUp: true,
            cleanedUpAt: adminSdk.firestore.FieldValue.serverTimestamp(),
            cleanupReason: reason,
          });
          result.deletedRecords++;
        }

        result.details.push({
          docId: userId.substring(0, 8) + '...', // Partial ID for privacy
          reason,
          deleted: !dryRun,
        });
      }
    }
  } catch (error) {
    console.error(`❌ [CLEANUP] Error scanning ${collectionName}:`, error);
  }

  console.log(`📊 [CLEANUP] ${collectionName}: ${result.staleRecords}/${result.totalRecords} stale`);
  return result;
}

async function cleanupWriterEarnings(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean
): Promise<CleanupResult> {
  const collectionName = getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS);
  console.log(`🔍 [CLEANUP] Scanning ${collectionName}...`);

  const result: CleanupResult = {
    collection: collectionName,
    totalRecords: 0,
    staleRecords: 0,
    deletedRecords: 0,
    details: [],
  };

  try {
    const snapshot = await db.collection(collectionName).get();
    result.totalRecords = snapshot.size;

    // Get valid allocations to cross-reference
    const allocationsCollectionName = getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS);
    const allocationsSnapshot = await db.collection(allocationsCollectionName).get();

    // Build a set of valid allocation IDs
    const validAllocationIds = new Set<string>();
    allocationsSnapshot.docs.forEach(doc => {
      validAllocationIds.add(doc.id);
    });

    for (const doc of snapshot.docs) {
      const data = doc.data();
      let isStale = false;
      let reason = '';

      const totalCents = data.totalUsdCentsReceived || data.totalCentsReceived || 0;
      const allocations = data.allocations || [];
      const month = data.month || '';

      // Earnings record with no amount
      if (totalCents === 0 && allocations.length === 0) {
        isStale = true;
        reason = 'Earnings record with zero amount and no allocations';
      }
      // Very old month with pending status (should have been processed)
      else if (data.status === 'pending' && month) {
        const earningMonth = new Date(month + '-01');
        const monthsAgo = (Date.now() - earningMonth.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsAgo > 3) {
          isStale = true;
          reason = `Pending earnings from ${month} (${Math.round(monthsAgo)} months ago)`;
        }
      }
      // Earnings with no valid allocations backing them
      else if (totalCents > 0 && allocations.length > 0) {
        const hasValidAllocation = allocations.some((a: any) =>
          validAllocationIds.has(a.allocationId)
        );
        if (!hasValidAllocation) {
          isStale = true;
          reason = `Earnings with no valid backing allocations`;
        }
      }

      if (isStale) {
        result.staleRecords++;

        if (!dryRun) {
          await doc.ref.delete();
          result.deletedRecords++;
        }

        result.details.push({
          docId: doc.id.substring(0, 12) + '...',
          reason,
          deleted: !dryRun,
        });
      }
    }
  } catch (error) {
    console.error(`❌ [CLEANUP] Error scanning ${collectionName}:`, error);
  }

  console.log(`📊 [CLEANUP] ${collectionName}: ${result.staleRecords}/${result.totalRecords} stale`);
  return result;
}

// GET endpoint for checking status without making changes
export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    const devBypass = isLocalhostDevBypass(request);

    try {
      // Verify admin access (or allow dev bypass for localhost)
      const userId = await getUserIdFromRequest(request);
      if (!userId && !devBypass) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const isAdmin = userId ? await isAdminUser(userId) : false;
      if (!isAdmin && !devBypass) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 503 });
    }

    const db = admin.firestore();

    // Quick count of records in each collection
    const [payoutsSnap, balancesSnap, earningsSnap] = await Promise.all([
      db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).count().get(),
      db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).count().get(),
      db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)).count().get(),
    ]);

    return NextResponse.json({
      success: true,
      collections: {
        [getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)]: payoutsSnap.data().count,
        [getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)]: balancesSnap.data().count,
        [getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)]: earningsSnap.data().count,
      },
      usage: {
        dryRun: 'POST with { "dryRun": true } to preview cleanup',
        execute: 'POST with { "dryRun": false } to execute cleanup',
      },
    });

    } catch (error) {
      console.error('❌ [CLEANUP] Status check error:', error);
      return NextResponse.json({
        error: 'Status check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }); // End withAdminContext
}
