/**
 * Platform Balance Check Cron Endpoint
 *
 * Scheduled daily monitoring of platform balance vs. payout obligations.
 * Runs at 6am UTC to check balance health and create alerts if needed.
 *
 * Schedule: 0 6 * * * (Daily at 6am UTC)
 *
 * Features:
 * - Checks Stripe balance against pending obligations
 * - Creates alerts if balance is below thresholds
 * - Records daily balance snapshots
 * - Sends admin notifications for critical issues
 *
 * GET - Vercel cron trigger (primary entry point)
 * POST - Manual/admin trigger with options
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  platformBalanceMonitoringService,
  BALANCE_THRESHOLDS,
  BalanceAlertData
} from '../../../services/platformBalanceMonitoringService';

/**
 * GET handler for Vercel cron jobs
 * This is the primary entry point - Vercel cron sends GET requests
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron access - Vercel adds CRON_SECRET for cron requests
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const cronApiKey = process.env.CRON_API_KEY;

    // Accept either CRON_SECRET (Vercel's built-in) or CRON_API_KEY (custom)
    const isAuthorized =
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (cronApiKey && authHeader === `Bearer ${cronApiKey}`);

    if (!isAuthorized) {
      console.warn('[CRON] Unauthorized access attempt to platform-balance-check');
      return NextResponse.json({
        error: 'Unauthorized - Cron access required'
      }, { status: 401 });
    }

    console.log('[CRON] Starting platform balance check via GET');

    // Check platform balance
    const balanceStatus = await platformBalanceMonitoringService.checkPlatformBalance();

    // Record balance snapshot
    await platformBalanceMonitoringService.recordBalanceSnapshot();

    // Check for alerts
    const alerts: string[] = [];
    let alertsCreated = 0;

    // Critical alert: balance below critical threshold or insufficient for obligations
    if (balanceStatus.isCritical) {
      const shortfall = balanceStatus.requiredReserve > balanceStatus.availableBalance
        ? balanceStatus.requiredReserve - balanceStatus.availableBalance
        : undefined;

      const alertData: BalanceAlertData = {
        type: 'critical_balance',
        severity: 'critical',
        thresholdStatus: balanceStatus.thresholdStatus,
        currentBalance: balanceStatus.availableBalance,
        requiredReserve: balanceStatus.requiredReserve,
        shortfall,
        daysOfCoverage: balanceStatus.daysOfCoverage,
        pendingObligations: balanceStatus.pendingObligations,
        recommendedActions: [
          'Transfer funds to platform Stripe account immediately',
          'Review pending payout queue and prioritize critical payouts',
          'Contact finance team for emergency fund transfer',
          'Consider temporary payout holds for non-urgent cases'
        ]
      };

      await platformBalanceMonitoringService.createBalanceAlert('critical_balance', alertData);
      alerts.push('critical_balance');
      alertsCreated++;

    // Warning alert: balance below warning threshold
    } else if (balanceStatus.isWarning) {
      const alertData: BalanceAlertData = {
        type: 'warning_balance',
        severity: 'warning',
        thresholdStatus: balanceStatus.thresholdStatus,
        currentBalance: balanceStatus.availableBalance,
        requiredReserve: balanceStatus.requiredReserve,
        daysOfCoverage: balanceStatus.daysOfCoverage,
        pendingObligations: balanceStatus.pendingObligations,
        recommendedActions: [
          'Plan to add funds within 48 hours',
          'Monitor balance daily until above warning threshold',
          'Review upcoming payout schedule',
          'Prepare for fund transfer if trend continues'
        ]
      };

      await platformBalanceMonitoringService.createBalanceAlert('warning_balance', alertData);
      alerts.push('warning_balance');
      alertsCreated++;
    }

    // Depletion risk alert: low days of coverage
    if (balanceStatus.daysOfCoverage < 7 && balanceStatus.daysOfCoverage > 0) {
      const alertData: BalanceAlertData = {
        type: 'depletion_risk',
        severity: balanceStatus.daysOfCoverage < 3 ? 'critical' : 'warning',
        thresholdStatus: balanceStatus.thresholdStatus,
        currentBalance: balanceStatus.availableBalance,
        requiredReserve: balanceStatus.requiredReserve,
        daysOfCoverage: balanceStatus.daysOfCoverage,
        pendingObligations: balanceStatus.pendingObligations,
        recommendedActions: [
          `Add funds within ${Math.max(1, balanceStatus.daysOfCoverage - 2)} days to prevent depletion`,
          'Monitor payout processing closely',
          'Review and adjust payout batching if needed',
          'Consider implementing payout holds if situation worsens'
        ]
      };

      await platformBalanceMonitoringService.createBalanceAlert('depletion_risk', alertData);
      alerts.push('depletion_risk');
      alertsCreated++;
    }

    // Check for negative trend
    const trend = await platformBalanceMonitoringService.getBalanceTrend(7);
    if (trend.trend === 'decreasing' && trend.averageChange < -100000) { // Declining more than $1,000/day
      const alertData: BalanceAlertData = {
        type: 'negative_trend',
        severity: 'warning',
        thresholdStatus: balanceStatus.thresholdStatus,
        currentBalance: balanceStatus.availableBalance,
        requiredReserve: balanceStatus.requiredReserve,
        daysOfCoverage: balanceStatus.daysOfCoverage,
        pendingObligations: balanceStatus.pendingObligations,
        recommendedActions: [
          'Investigate cause of declining balance',
          'Review recent payout activity',
          'Check for unusual subscription refunds or chargebacks',
          'Plan to add funds to reverse trend'
        ]
      };

      await platformBalanceMonitoringService.createBalanceAlert('negative_trend', alertData);
      alerts.push('negative_trend');
      alertsCreated++;
    }

    const duration = Date.now() - startTime;

    console.log('[CRON] Platform balance check completed', {
      status: balanceStatus.thresholdStatus,
      daysOfCoverage: balanceStatus.daysOfCoverage,
      alertsCreated,
      duration: `${duration}ms`
    });

    return NextResponse.json({
      success: true,
      data: {
        balanceStatus: {
          thresholdStatus: balanceStatus.thresholdStatus,
          availableBalance: balanceStatus.availableBalance,
          pendingObligations: balanceStatus.pendingObligations,
          requiredReserve: balanceStatus.requiredReserve,
          availableForPayouts: balanceStatus.availableForPayouts,
          daysOfCoverage: balanceStatus.daysOfCoverage,
          isHealthy: balanceStatus.isHealthy,
          isWarning: balanceStatus.isWarning,
          isCritical: balanceStatus.isCritical
        },
        alerts: alerts,
        alertsCreated,
        trend: {
          direction: trend.trend,
          averageChange: trend.averageChange
        },
        timestamp: new Date().toISOString(),
        duration
      }
    });

  } catch (error: any) {
    console.error('[CRON] Platform balance check error:', error);

    return NextResponse.json({
      error: 'Failed to check platform balance',
      details: error.message,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    }, { status: 500 });
  }
}

/**
 * POST handler for manual/admin triggers with options
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron access
    const authHeader = request.headers.get('authorization');
    const cronKey = process.env.CRON_API_KEY;

    if (!cronKey || authHeader !== `Bearer ${cronKey}`) {
      return NextResponse.json({
        error: 'Unauthorized - Cron access required'
      }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      createSnapshot = true,
      checkTrend = true,
      forceAlert = false
    } = body;

    console.log('[CRON] Starting manual platform balance check', {
      createSnapshot,
      checkTrend,
      forceAlert
    });

    // Check platform balance
    const balanceStatus = await platformBalanceMonitoringService.checkPlatformBalance();

    // Record balance snapshot if requested
    if (createSnapshot) {
      await platformBalanceMonitoringService.recordBalanceSnapshot();
    }

    // Get trend if requested
    let trend = null;
    if (checkTrend) {
      trend = await platformBalanceMonitoringService.getBalanceTrend(7);
    }

    const duration = Date.now() - startTime;

    // Return detailed status
    return NextResponse.json({
      success: true,
      data: {
        balanceStatus: {
          timestamp: balanceStatus.timestamp,
          thresholdStatus: balanceStatus.thresholdStatus,
          availableBalance: balanceStatus.availableBalance,
          pendingBalance: balanceStatus.pendingBalance,
          totalBalance: balanceStatus.totalBalance,
          pendingObligations: balanceStatus.pendingObligations,
          requiredReserve: balanceStatus.requiredReserve,
          availableForPayouts: balanceStatus.availableForPayouts,
          daysOfCoverage: balanceStatus.daysOfCoverage,
          isHealthy: balanceStatus.isHealthy,
          isWarning: balanceStatus.isWarning,
          isCritical: balanceStatus.isCritical
        },
        trend: trend ? {
          direction: trend.trend,
          averageChange: trend.averageChange,
          snapshotCount: trend.snapshots.length
        } : null,
        thresholds: {
          critical: BALANCE_THRESHOLDS.CRITICAL,
          warning: BALANCE_THRESHOLDS.WARNING,
          healthy: BALANCE_THRESHOLDS.HEALTHY,
          reserveMultiplier: 1.2
        },
        snapshotCreated: createSnapshot,
        timestamp: new Date().toISOString(),
        duration
      }
    });

  } catch (error: any) {
    console.error('[CRON] Manual platform balance check error:', error);

    return NextResponse.json({
      error: 'Failed to check platform balance',
      details: error.message,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      retryable: true
    }, { status: 500 });
  }
}

/**
 * Health check endpoint
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'X-Service': 'platform-balance-check-cron',
      'X-Timestamp': new Date().toISOString()
    }
  });
}
