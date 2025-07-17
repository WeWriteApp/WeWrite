import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { db } from '../../../../firebase/config';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { PayoutMonitoringService } from '../../../../services/payoutMonitoringService';
import { payoutRetryService } from '../../../../services/payoutRetryService';
import { FinancialUtils } from '../../../../types/financial';

// Admin user check
async function isAdmin(userId: string): Promise<boolean> {
  // TODO: Implement proper admin check
  return true;
}

/**
 * GET /api/admin/payouts/monitoring
 * Get comprehensive payout system monitoring data
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const correlationId = FinancialUtils.generateCorrelationId();

    // Get system health status
    const monitoringService = PayoutMonitoringService.getInstance();
    const healthResult = await monitoringService.getHealthStatus(correlationId);

    if (!healthResult.success) {
      return NextResponse.json({
        error: 'Failed to get health status',
        details: healthResult.error?.message,
        correlationId
      }, { status: 500 });
    }

    const health = healthResult.data!;

    // Get retry statistics
    const retryStats = await payoutRetryService.getRetryStatistics();

    // Get stuck payouts
    const stuckPayouts = await getStuckPayouts();

    // Get recent failures
    const recentFailures = await getRecentFailures();

    // Get processing delays
    const processingDelays = await getProcessingDelays();

    // Get volume trends
    const volumeTrends = await getVolumeTrends();

    return NextResponse.json({
      success: true,
      data: {
        health,
        retryStatistics: retryStats.data,
        stuckPayouts,
        recentFailures,
        processingDelays,
        volumeTrends,
        lastUpdated: new Date().toISOString()
      },
      correlationId
    });

  } catch (error: unknown) {
    console.error('Error getting monitoring data:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get payouts that have been stuck in processing for too long
 */
async function getStuckPayouts() {
  try {
    const stuckThresholdHours = 24; // Consider stuck after 24 hours
    const stuckThreshold = new Date();
    stuckThreshold.setHours(stuckThreshold.getHours() - stuckThresholdHours);

    const stuckQuery = query(
      collection(db, getCollectionName('payouts')),
      where('status', '==', 'processing'),
      where('processedAt', '<', Timestamp.fromDate(stuckThreshold)),
      orderBy('processedAt', 'asc'),
      limit(50)
    );

    const stuckSnapshot = await getDocs(stuckQuery);
    const stuckPayouts = stuckSnapshot.docs.map(doc => {
      const data = doc.data();
      const processedAt = data.processedAt?.toDate();
      const now = new Date();
      const stuckDuration = processedAt ? now.getTime() - processedAt.getTime() : 0;

      return {
        id: doc.id,
        recipientId: data.recipientId,
        amount: data.amount,
        processedAt: processedAt?.toISOString(),
        stuckDurationHours: Math.round(stuckDuration / (1000 * 60 * 60)),
        stripeTransferId: data.stripeTransferId
      };
    });

    return stuckPayouts;
  } catch (error) {
    console.error('Error getting stuck payouts:', error);
    return [];
  }
}

/**
 * Get recent payout failures for analysis
 */
async function getRecentFailures() {
  try {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const failuresQuery = query(
      collection(db, getCollectionName('payouts')),
      where('status', '==', 'failed'),
      where('updatedAt', '>=', Timestamp.fromDate(last24Hours)),
      orderBy('updatedAt', 'desc'),
      limit(100)
    );

    const failuresSnapshot = await getDocs(failuresQuery);
    const failures = failuresSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        recipientId: data.recipientId,
        amount: data.amount,
        failureReason: data.failureReason,
        retryCount: data.retryCount || 0,
        failedAt: data.updatedAt?.toDate()?.toISOString(),
        stripeTransferId: data.stripeTransferId
      };
    });

    // Group by failure reason for analysis
    const failuresByReason = failures.reduce((acc, failure) => {
      const reason = failure.failureReason || 'Unknown';
      if (!acc[reason]) {
        acc[reason] = { count: 0, examples: [] };
      }
      acc[reason].count++;
      if (acc[reason].examples.length < 3) {
        acc[reason].examples.push(failure);
      }
      return acc;
    }, {});

    return {
      total: failures.length,
      byReason: failuresByReason,
      recent: failures.slice(0, 10)
    };
  } catch (error) {
    console.error('Error getting recent failures:', error);
    return { total: 0, byReason: {}, recent: [] };
  }
}

/**
 * Get processing delay statistics
 */
async function getProcessingDelays() {
  try {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const completedQuery = query(
      collection(db, getCollectionName('payouts')),
      where('status', '==', 'completed'),
      where('completedAt', '>=', Timestamp.fromDate(last7Days)),
      orderBy('completedAt', 'desc'),
      limit(500)
    );

    const completedSnapshot = await getDocs(completedQuery);
    const delays: number[] = [];

    completedSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const processedAt = data.processedAt?.toDate();
      const completedAt = data.completedAt?.toDate();

      if (processedAt && completedAt) {
        const delayMs = completedAt.getTime() - processedAt.getTime();
        const delayHours = delayMs / (1000 * 60 * 60);
        delays.push(delayHours);
      }
    });

    if (delays.length === 0) {
      return { average: 0, median: 0, p95: 0, count: 0 };
    }

    delays.sort((a, b) => a - b);
    const average = delays.reduce((sum, delay) => sum + delay, 0) / delays.length;
    const median = delays[Math.floor(delays.length / 2)];
    const p95 = delays[Math.floor(delays.length * 0.95)];

    return {
      average: Math.round(average * 100) / 100,
      median: Math.round(median * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      count: delays.length
    };
  } catch (error) {
    console.error('Error getting processing delays:', error);
    return { average: 0, median: 0, p95: 0, count: 0 };
  }
}

/**
 * Get payout volume trends
 */
async function getVolumeTrends() {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const volumeQuery = query(
      collection(db, getCollectionName('payouts')),
      where('scheduledAt', '>=', Timestamp.fromDate(last30Days)),
      orderBy('scheduledAt', 'desc')
    );

    const volumeSnapshot = await getDocs(volumeQuery);
    const dailyVolume = {};

    volumeSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const date = data.scheduledAt?.toDate()?.toISOString()?.split('T')[0];
      
      if (date) {
        if (!dailyVolume[date]) {
          dailyVolume[date] = { count: 0, amount: 0, statuses: {} };
        }
        
        dailyVolume[date].count++;
        dailyVolume[date].amount += data.amount || 0;
        
        const status = data.status || 'unknown';
        dailyVolume[date].statuses[status] = (dailyVolume[date].statuses[status] || 0) + 1;
      }
    });

    // Convert to array and sort by date
    const trends = Object.entries(dailyVolume)
      .map(([date, data]) => ({ date, ...(typeof data === 'object' && data !== null ? data : {}) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return trends;
  } catch (error) {
    console.error('Error getting volume trends:', error);
    return [];
  }
}

/**
 * POST /api/admin/payouts/monitoring
 * Trigger manual monitoring checks or alerts
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    const correlationId = FinancialUtils.generateCorrelationId();

    const monitoringService = PayoutMonitoringService.getInstance();
    let metricsResult: any = null;

    switch (action) {
      case 'refresh_metrics':
        metricsResult = await monitoringService.calculateMetrics(correlationId);
        
        if (metricsResult.success) {
          return NextResponse.json({
            success: true,
            message: 'Metrics refreshed',
            data: metricsResult.data,
            correlationId
          });
        } else {
          return NextResponse.json({
            error: 'Failed to refresh metrics',
            details: metricsResult.error?.message,
            correlationId
          }, { status: 500 });
        }

      case 'check_alerts':
        const alertsResult = await monitoringService.checkAlertConditions(
          metricsResult?.data || {},
          correlationId
        );
        
        if (alertsResult.success) {
          return NextResponse.json({
            success: true,
            message: 'Alert check completed',
            data: alertsResult.data,
            correlationId
          });
        } else {
          return NextResponse.json({
            error: 'Failed to check alerts',
            details: alertsResult.error?.message,
            correlationId
          }, { status: 500 });
        }

      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: refresh_metrics, check_alerts'
        }, { status: 400 });
    }

  } catch (error: unknown) {
    console.error('Error processing monitoring action:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
