/**
 * Storage Balance Processing Cron
 *
 * Aggregates allocated vs unallocated subscription funds for the current month
 * and routes them via Stripe Storage Balance:
 *  - Allocated -> Storage Balance
 *  - Unallocated -> Payments Balance ("use it or lose it")
 *
 * Secured via CRON_API_KEY (Bearer token).
 */

import { NextRequest, NextResponse } from 'next/server';
import { FinancialUtils } from '../../../types/financial';
import { UsdService } from '../../../services/usdService';
import { StripeStorageBalanceService } from '../../../services/stripeStorageBalanceService';
import { getCurrentMonth } from '../../../utils/usdConstants';
import { centsToDollars } from '../../../utils/formatCurrency';

export async function POST(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();

  try {
    const authHeader = request.headers.get('authorization');
    const cronKey = process.env.CRON_API_KEY;

    if (!cronKey || authHeader !== `Bearer ${cronKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized - Cron access required', correlationId },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const month: string = body.month || getCurrentMonth();
    const dryRun: boolean = Boolean(body.dryRun);

    // Aggregate allocated vs unallocated funds for the month
    const summary = await UsdService.getMonthlyAllocationSummary(month);

    const allocatedDollars = summary.totalAllocatedCents / 100;
    const unallocatedDollars = summary.totalUnallocatedCents / 100;

    console.log(`[CRON][STORAGE BALANCE] Summary for ${month} [${correlationId}]`, {
      users: summary.userCount,
      allocated: centsToDollars(summary.totalAllocatedCents),
      unallocated: centsToDollars(summary.totalUnallocatedCents),
      totalSubscription: centsToDollars(summary.totalSubscriptionCents),
      dryRun
    });

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        correlationId,
        data: summary
      });
    }

    // Process storage balance movements
    const storageService = StripeStorageBalanceService.getInstance();
    const result = await storageService.processMonthlyStorageBalance(
      allocatedDollars,
      unallocatedDollars,
      month
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Storage balance processing failed',
          correlationId
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      correlationId,
      data: {
        month,
        allocatedDollars,
        unallocatedDollars,
        operations: result.operations
      }
    });
  } catch (error: any) {
    console.error('[CRON][STORAGE BALANCE] Error processing storage balance:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal error',
        correlationId
      },
      { status: 500 }
    );
  }
}

// Health check
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'X-Service': 'storage-balance-processing',
      'X-Status': 'operational'
    }
  });
}
