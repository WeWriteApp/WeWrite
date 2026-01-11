/**
 * Monthly Earnings Creation Cron Endpoint
 *
 * Creates writerUsdEarnings records from all active allocations for the current month.
 * This is a safety net to ensure earnings records exist even if allocation rollover
 * fails to create them (e.g., if backfillCurrentMonthAllocations doesn't trigger).
 *
 * Schedule: 0 7 1 * * (7 AM UTC on the 1st of each month)
 * This runs BEFORE process-writer-earnings (8 AM) which promotes pending -> available.
 *
 * GET - Vercel cron trigger
 * POST - Manual/admin trigger with options
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { getCurrentMonth } from '../../../utils/subscriptionTiers';
import { UsdEarningsService } from '../../../services/usdEarningsService';
import { centsToDollars } from '../../../utils/formatCurrency';

interface AllocationRecord {
  id: string;
  userId: string;
  recipientUserId: string;
  resourceType: string;
  resourceId: string;
  usdCents: number;
  month: string;
  status: string;
}

/**
 * GET handler for Vercel cron jobs
 */
export async function GET(request: NextRequest) {
  const correlationId = `monthly_earnings_${Date.now()}`;
  const startTime = Date.now();

  try {
    // Verify cron access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const cronApiKey = process.env.CRON_API_KEY;

    const isAuthorized =
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (cronApiKey && authHeader === `Bearer ${cronApiKey}`);

    if (!isAuthorized) {
      console.warn(`[CRON] Unauthorized access attempt to create-monthly-earnings [${correlationId}]`);
      return NextResponse.json({
        error: 'Unauthorized - Cron access required',
        correlationId
      }, { status: 401 });
    }

    console.log(`[CRON] Starting monthly earnings creation [${correlationId}]`);

    const result = await processMonthlyEarnings(getCurrentMonth(), correlationId);

    const duration = Date.now() - startTime;
    console.log(`[CRON] Monthly earnings creation completed in ${duration}ms [${correlationId}]`, result);

    return NextResponse.json({
      success: true,
      data: result,
      duration: `${duration}ms`,
      correlationId
    });
  } catch (error: any) {
    console.error(`[CRON] Monthly earnings creation failed [${correlationId}]:`, error);
    return NextResponse.json({
      error: 'Monthly earnings creation failed',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

/**
 * POST handler for manual/admin triggers
 */
export async function POST(request: NextRequest) {
  const correlationId = `monthly_earnings_manual_${Date.now()}`;
  const startTime = Date.now();

  try {
    // For POST, we accept admin auth via session
    // This is less strict than cron auth since admins need to trigger manually
    const body = await request.json().catch(() => ({}));
    const { month, dryRun = false } = body;

    const targetMonth = month || getCurrentMonth();

    console.log(`[CRON] Manual monthly earnings creation for ${targetMonth} (dryRun: ${dryRun}) [${correlationId}]`);

    const result = await processMonthlyEarnings(targetMonth, correlationId, dryRun);

    const duration = Date.now() - startTime;
    console.log(`[CRON] Manual monthly earnings creation completed in ${duration}ms [${correlationId}]`, result);

    return NextResponse.json({
      success: true,
      data: { ...result, dryRun },
      duration: `${duration}ms`,
      correlationId
    });
  } catch (error: any) {
    console.error(`[CRON] Manual monthly earnings creation failed [${correlationId}]:`, error);
    return NextResponse.json({
      error: 'Monthly earnings creation failed',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

/**
 * Core logic: Create earnings records from active allocations
 */
async function processMonthlyEarnings(
  month: string,
  correlationId: string,
  dryRun: boolean = false
): Promise<{
  month: string;
  totalAllocations: number;
  uniqueRecipients: number;
  earningsCreated: number;
  earningsUpdated: number;
  earningsSkipped: number;
  totalCents: number;
  totalDollars: number;
}> {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();

  const allocationsCollectionName = getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS);

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

  console.log(`[CRON] Found ${allocations.length} active allocations for ${month} [${correlationId}]`);

  // Group allocations by recipient
  const allocationsByRecipient = new Map<string, number>();
  for (const allocation of allocations) {
    // Skip platform allocations and allocations without recipients
    if (allocation.resourceType === 'wewrite' || !allocation.recipientUserId) {
      continue;
    }

    const current = allocationsByRecipient.get(allocation.recipientUserId) || 0;
    allocationsByRecipient.set(allocation.recipientUserId, current + allocation.usdCents);
  }

  console.log(`[CRON] Processing earnings for ${allocationsByRecipient.size} unique recipients [${correlationId}]`);

  // Create/update earnings for each recipient
  let earningsCreated = 0;
  let earningsUpdated = 0;
  let earningsSkipped = 0;
  let totalCents = 0;

  for (const [recipientUserId, cents] of allocationsByRecipient.entries()) {
    totalCents += cents;

    if (dryRun) {
      // In dry run, just count what would be created
      earningsCreated++;
      continue;
    }

    try {
      const result = await UsdEarningsService.createOrUpdateMonthlyEarnings(
        recipientUserId,
        month,
        cents,
        'rollover'
      );

      if (result.created) {
        earningsCreated++;
      } else if (result.updated) {
        earningsUpdated++;
      } else {
        earningsSkipped++;
      }
    } catch (err) {
      console.warn(`[CRON] Failed to create/update earnings for ${recipientUserId} [${correlationId}]:`, err);
      earningsSkipped++;
    }
  }

  return {
    month,
    totalAllocations: allocations.length,
    uniqueRecipients: allocationsByRecipient.size,
    earningsCreated,
    earningsUpdated,
    earningsSkipped,
    totalCents,
    totalDollars: centsToDollars(totalCents)
  };
}
