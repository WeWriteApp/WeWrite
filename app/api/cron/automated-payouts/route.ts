/**
 * Automated Payout Processing Cron Endpoint
 *
 * Processes automated payouts for eligible writers on a monthly schedule.
 * Finds writers with autoPayoutEnabled who have available balance above their
 * minimum threshold, then processes payouts through the existing PayoutService.
 *
 * Schedule: 0 9 1 * * (9 AM UTC on the 1st of each month)
 * Runs AFTER create-monthly-earnings (7 AM) and process-writer-earnings (8 AM).
 *
 * GET - Vercel cron trigger
 * POST - Manual/admin trigger with options
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { PayoutService } from '../../../services/payoutService';
import { UsdEarningsService } from '../../../services/usdEarningsService';
import { PLATFORM_FEE_CONFIG } from '../../../config/platformFee';

interface PayoutRunResult {
  totalEligible: number;
  processed: number;
  failed: number;
  skipped: number;
  errors: Array<{ userId: string; error: string }>;
  details: Array<{ userId: string; amountCents: number; payoutId?: string; status: string }>;
}

function verifyCronAccess(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const cronApiKey = process.env.CRON_API_KEY;

  return (
    (!!cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (!!cronApiKey && authHeader === `Bearer ${cronApiKey}`)
  );
}

/**
 * Find writers eligible for automated payouts:
 * - Have a payoutRecipients record with autoPayoutEnabled: true
 * - Have a connected Stripe account
 * - Have available balance >= their minimum threshold
 */
async function findEligibleWriters(): Promise<Array<{
  userId: string;
  stripeConnectedAccountId: string;
  minimumThreshold: number;
  availableCents: number;
}>> {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();

  // Query writers who have opted into automatic payouts
  const recipientsSnapshot = await db
    .collection(getCollectionName('payoutRecipients'))
    .where('payoutPreferences.autoPayoutEnabled', '==', true)
    .get();

  if (recipientsSnapshot.empty) {
    return [];
  }

  const eligible: Array<{
    userId: string;
    stripeConnectedAccountId: string;
    minimumThreshold: number;
    availableCents: number;
  }> = [];

  // Check each writer's balance against their threshold
  for (const doc of recipientsSnapshot.docs) {
    const recipient = doc.data();
    const userId = recipient.userId;
    const stripeAccountId = recipient.stripeConnectedAccountId;

    if (!stripeAccountId) continue;

    const thresholdDollars = recipient.payoutPreferences?.minimumThreshold
      ?? PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_DOLLARS;
    const thresholdCents = thresholdDollars * 100;

    try {
      const balance = await UsdEarningsService.getWriterUsdBalance(userId);
      const availableCents = balance?.availableUsdCents ?? 0;

      if (availableCents >= thresholdCents) {
        eligible.push({
          userId,
          stripeConnectedAccountId: stripeAccountId,
          minimumThreshold: thresholdDollars,
          availableCents,
        });
      }
    } catch (err) {
      console.warn(`[AUTOMATED-PAYOUTS] Error checking balance for ${userId}:`, err);
    }
  }

  return eligible;
}

/**
 * Process automated payouts for all eligible writers.
 */
async function processAutomatedPayouts(options: {
  dryRun?: boolean;
  correlationId: string;
}): Promise<PayoutRunResult> {
  const { dryRun = false, correlationId } = options;

  const result: PayoutRunResult = {
    totalEligible: 0,
    processed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  const eligible = await findEligibleWriters();
  result.totalEligible = eligible.length;

  if (eligible.length === 0) {
    console.log(`[AUTOMATED-PAYOUTS] No eligible writers found [${correlationId}]`);
    return result;
  }

  console.log(`[AUTOMATED-PAYOUTS] Found ${eligible.length} eligible writers [${correlationId}]`);

  if (dryRun) {
    for (const writer of eligible) {
      result.details.push({
        userId: writer.userId,
        amountCents: writer.availableCents,
        status: 'dry_run',
      });
      result.skipped++;
    }
    return result;
  }

  // Process each writer sequentially to avoid overwhelming Stripe
  for (const writer of eligible) {
    try {
      console.log(
        `[AUTOMATED-PAYOUTS] Processing payout for ${writer.userId}: ` +
        `${writer.availableCents} cents [${correlationId}]`
      );

      const payoutResult = await PayoutService.requestPayout(writer.userId);

      if (payoutResult.success) {
        result.processed++;
        result.details.push({
          userId: writer.userId,
          amountCents: writer.availableCents,
          payoutId: payoutResult.payoutId,
          status: 'completed',
        });
      } else {
        result.failed++;
        const error = payoutResult.error || 'Unknown error';
        result.errors.push({ userId: writer.userId, error });
        result.details.push({
          userId: writer.userId,
          amountCents: writer.availableCents,
          status: 'failed',
        });
        console.warn(
          `[AUTOMATED-PAYOUTS] Failed for ${writer.userId}: ${error} [${correlationId}]`
        );
      }
    } catch (err: any) {
      result.failed++;
      const error = err.message || 'Unexpected error';
      result.errors.push({ userId: writer.userId, error });
      result.details.push({
        userId: writer.userId,
        amountCents: writer.availableCents,
        status: 'error',
      });
      console.error(
        `[AUTOMATED-PAYOUTS] Error processing ${writer.userId} [${correlationId}]:`, err
      );
    }
  }

  return result;
}

/**
 * GET handler for Vercel cron jobs
 */
export async function GET(request: NextRequest) {
  const correlationId = `auto_payout_${Date.now()}`;
  const startTime = Date.now();

  if (!verifyCronAccess(request)) {
    console.warn(`[AUTOMATED-PAYOUTS] Unauthorized access attempt [${correlationId}]`);
    return NextResponse.json(
      { error: 'Unauthorized - Cron access required', correlationId },
      { status: 401 }
    );
  }

  try {
    console.log(`[AUTOMATED-PAYOUTS] Starting automated payout processing [${correlationId}]`);

    const result = await processAutomatedPayouts({ correlationId });
    const duration = Date.now() - startTime;

    console.log(
      `[AUTOMATED-PAYOUTS] Completed in ${duration}ms [${correlationId}]: ` +
      `${result.processed} processed, ${result.failed} failed, ${result.totalEligible} eligible`
    );

    return NextResponse.json({
      success: true,
      data: {
        totalEligible: result.totalEligible,
        processed: result.processed,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors.slice(0, 10),
      },
      duration: `${duration}ms`,
      correlationId,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[AUTOMATED-PAYOUTS] Fatal error [${correlationId}]:`, error);

    return NextResponse.json(
      {
        error: 'Automated payout processing failed',
        details: error.message,
        duration: `${duration}ms`,
        correlationId,
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for manual/admin triggers with options
 */
export async function POST(request: NextRequest) {
  const correlationId = `auto_payout_manual_${Date.now()}`;
  const startTime = Date.now();

  if (!verifyCronAccess(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - Cron access required', correlationId },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun = false } = body;

    console.log(
      `[AUTOMATED-PAYOUTS] Manual trigger (dryRun: ${dryRun}) [${correlationId}]`
    );

    const result = await processAutomatedPayouts({ dryRun, correlationId });
    const duration = Date.now() - startTime;

    console.log(
      `[AUTOMATED-PAYOUTS] Manual run completed in ${duration}ms [${correlationId}]`
    );

    return NextResponse.json({
      success: true,
      data: {
        totalEligible: result.totalEligible,
        processed: result.processed,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors.slice(0, 10),
        details: dryRun ? result.details : undefined,
      },
      duration: `${duration}ms`,
      correlationId,
      dryRun,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[AUTOMATED-PAYOUTS] Manual trigger failed [${correlationId}]:`, error);

    return NextResponse.json(
      {
        error: 'Automated payout processing failed',
        details: error.message,
        duration: `${duration}ms`,
        correlationId,
      },
      { status: 500 }
    );
  }
}
