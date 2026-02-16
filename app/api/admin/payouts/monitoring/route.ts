import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { db } from '../../../../firebase/config';
import {
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { getCollectionName, USD_COLLECTIONS } from '../../../../utils/environmentConfig';
import { withAdminContext } from '../../../../utils/adminRequestContext';

const PAYOUTS_COLLECTION = USD_COLLECTIONS.USD_PAYOUTS;

/**
 * GET /api/admin/payouts/monitoring
 * Payout system monitoring dashboard data
 */
export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      const adminCheck = await checkAdminPermissions(request);
      if (!adminCheck.success) {
        return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
      }

      const [stuckPayouts, recentFailures, processingDelays, volumeTrends] = await Promise.all([
        getStuckPayouts(),
        getRecentFailures(),
        getProcessingDelays(),
        getVolumeTrends(),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          stuckPayouts,
          recentFailures,
          processingDelays,
          volumeTrends,
          lastUpdated: new Date().toISOString()
        },
      });

    } catch (error: unknown) {
      console.error('Error getting monitoring data:', error);
      return NextResponse.json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  });
}

/**
 * Payouts stuck in pending for more than 24 hours
 */
async function getStuckPayouts() {
  try {
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - 24);

    const stuckQuery = query(
      collection(db, getCollectionName(PAYOUTS_COLLECTION)),
      where('status', '==', 'pending'),
      where('requestedAt', '<', Timestamp.fromDate(threshold)),
      orderBy('requestedAt', 'asc'),
      limit(50)
    );

    const snapshot = await getDocs(stuckQuery);
    return snapshot.docs.map(d => {
      const data = d.data();
      const requestedAt = data.requestedAt?.toDate();
      const stuckMs = requestedAt ? Date.now() - requestedAt.getTime() : 0;
      return {
        id: d.id,
        userId: data.userId,
        amountCents: data.amountCents || 0,
        requestedAt: requestedAt?.toISOString(),
        stuckDurationHours: Math.round(stuckMs / (1000 * 60 * 60)),
      };
    });
  } catch (error) {
    console.error('Error getting stuck payouts:', error);
    return [];
  }
}

/**
 * Failed payouts in the last 24 hours
 */
async function getRecentFailures() {
  try {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const failuresQuery = query(
      collection(db, getCollectionName(PAYOUTS_COLLECTION)),
      where('status', '==', 'failed'),
      orderBy('requestedAt', 'desc'),
      limit(100)
    );

    const snapshot = await getDocs(failuresQuery);
    const failures = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        amountCents: data.amountCents || 0,
        failureReason: data.failureReason || 'Unknown',
        requestedAt: data.requestedAt?.toDate()?.toISOString(),
        completedAt: data.completedAt?.toDate()?.toISOString(),
      };
    });

    // Group by failure reason
    const byReason: Record<string, { count: number; examples: typeof failures }> = {};
    for (const f of failures) {
      const reason = f.failureReason;
      if (!byReason[reason]) byReason[reason] = { count: 0, examples: [] };
      byReason[reason].count++;
      if (byReason[reason].examples.length < 3) byReason[reason].examples.push(f);
    }

    return { total: failures.length, byReason, recent: failures.slice(0, 10) };
  } catch (error) {
    console.error('Error getting recent failures:', error);
    return { total: 0, byReason: {}, recent: [] };
  }
}

/**
 * Processing delay stats (request → completion time) over last 7 days
 */
async function getProcessingDelays() {
  try {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const completedQuery = query(
      collection(db, getCollectionName(PAYOUTS_COLLECTION)),
      where('status', '==', 'completed'),
      where('completedAt', '>=', Timestamp.fromDate(last7Days)),
      orderBy('completedAt', 'desc'),
      limit(500)
    );

    const snapshot = await getDocs(completedQuery);
    const delays: number[] = [];

    snapshot.docs.forEach(d => {
      const data = d.data();
      const requestedAt = data.requestedAt?.toDate();
      const completedAt = data.completedAt?.toDate();
      if (requestedAt && completedAt) {
        delays.push((completedAt.getTime() - requestedAt.getTime()) / (1000 * 60 * 60));
      }
    });

    if (delays.length === 0) return { average: 0, median: 0, p95: 0, count: 0 };

    delays.sort((a, b) => a - b);
    const average = delays.reduce((s, d) => s + d, 0) / delays.length;

    return {
      average: Math.round(average * 100) / 100,
      median: Math.round(delays[Math.floor(delays.length / 2)] * 100) / 100,
      p95: Math.round(delays[Math.floor(delays.length * 0.95)] * 100) / 100,
      count: delays.length,
    };
  } catch (error) {
    console.error('Error getting processing delays:', error);
    return { average: 0, median: 0, p95: 0, count: 0 };
  }
}

/**
 * Daily payout volume over last 30 days
 */
async function getVolumeTrends() {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const volumeQuery = query(
      collection(db, getCollectionName(PAYOUTS_COLLECTION)),
      where('requestedAt', '>=', Timestamp.fromDate(last30Days)),
      orderBy('requestedAt', 'desc')
    );

    const snapshot = await getDocs(volumeQuery);
    const daily: Record<string, { count: number; amountCents: number; statuses: Record<string, number> }> = {};

    snapshot.docs.forEach(d => {
      const data = d.data();
      const date = data.requestedAt?.toDate()?.toISOString()?.split('T')[0];
      if (!date) return;
      if (!daily[date]) daily[date] = { count: 0, amountCents: 0, statuses: {} };
      daily[date].count++;
      daily[date].amountCents += data.amountCents || 0;
      const status = data.status || 'unknown';
      daily[date].statuses[status] = (daily[date].statuses[status] || 0) + 1;
    });

    return Object.entries(daily)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error getting volume trends:', error);
    return [];
  }
}
