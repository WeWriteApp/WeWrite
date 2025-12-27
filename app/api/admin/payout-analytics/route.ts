/**
 * Admin API: Payout Analytics with Time-Series Data
 * Provides time-series payout data for admin dashboard graphs
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

interface PayoutDataPoint {
  date: string;
  payouts: number;
  cumulativePayouts: number;
  payoutCount: number;
  cumulativePayoutCount: number;
  averagePayoutAmount: number;
}

// Helper function to get time intervals
function getTimeIntervals(startDate: Date, endDate: Date) {
  const diffInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  let buckets: string[];
  let formatLabel: (date: Date) => string;
  let granularityType: string;

  if (diffInDays <= 31) {
    // Daily granularity for periods <= 1 month
    granularityType = 'daily';
    buckets = [];
    formatLabel = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      buckets.push(d.toISOString().split('T')[0]);
    }
  } else if (diffInDays <= 365) {
    // Weekly granularity for periods <= 1 year
    granularityType = 'weekly';
    buckets = [];
    formatLabel = (date: Date) => `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    
    const startOfWeek = new Date(startDate);
    startOfWeek.setDate(startDate.getDate() - startDate.getDay());
    
    for (let d = new Date(startOfWeek); d <= endDate; d.setDate(d.getDate() + 7)) {
      buckets.push(d.toISOString().split('T')[0]);
    }
  } else {
    // Monthly granularity for periods > 1 year
    granularityType = 'monthly';
    buckets = [];
    formatLabel = (date: Date) => date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    
    for (let d = new Date(startDate.getFullYear(), startDate.getMonth(), 1); d <= endDate; d.setMonth(d.getMonth() + 1)) {
      buckets.push(d.toISOString().split('T')[0]);
    }
  }

  return { buckets, formatLabel, granularityType };
}

function getDateKey(date: Date, granularityType: string): string {
  if (granularityType === 'daily') {
    return date.toISOString().split('T')[0];
  } else if (granularityType === 'weekly') {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    return startOfWeek.toISOString().split('T')[0];
  } else {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  }
}

export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Unauthorized' }, { status: 401 });
    }

    const admin = initAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const cumulative = searchParams.get('cumulative') === 'true';

    if (!startDate || !endDate) {
      return NextResponse.json({
        error: 'Start date and end date are required'
      }, { status: 400 });
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    console.log(`[ADMIN] Payout analytics request: ${startDate} to ${endDate}, cumulative: ${cumulative}`);

    // Get time intervals for the chart
    const timeConfig = getTimeIntervals(startDateObj, endDateObj);
    
    // Initialize data map
    const dateMap = new Map<string, { payouts: number; payoutCount: number }>();
    timeConfig.buckets.forEach(bucket => {
      dateMap.set(bucket, { payouts: 0, payoutCount: 0 });
    });

    // Query all payouts and filter in memory
    // This avoids Firestore index requirements and handles documents with missing fields
    const payoutsSnapshot = await db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).get();

    console.log(`[ADMIN] Found ${payoutsSnapshot.size} total payouts in collection`);

    // Process payouts and group by time period (filter by date range and completed status in memory)
    let completedCount = 0;
    let inRangeCount = 0;
    payoutsSnapshot.docs.forEach(doc => {
      const payout = doc.data();

      // Filter by status in memory
      if (payout.status !== 'completed') {
        return;
      }

      // Parse date from various formats
      let payoutDate: Date | null = null;
      if (payout.requestedAt) {
        if (typeof payout.requestedAt.toDate === 'function') {
          payoutDate = payout.requestedAt.toDate();
        } else if (payout.requestedAt._seconds) {
          payoutDate = new Date(payout.requestedAt._seconds * 1000);
        } else if (typeof payout.requestedAt === 'string' || typeof payout.requestedAt === 'number') {
          payoutDate = new Date(payout.requestedAt);
        }
      } else if (payout.createdAt) {
        // Fallback to createdAt if requestedAt doesn't exist
        if (typeof payout.createdAt.toDate === 'function') {
          payoutDate = payout.createdAt.toDate();
        } else if (payout.createdAt._seconds) {
          payoutDate = new Date(payout.createdAt._seconds * 1000);
        } else if (typeof payout.createdAt === 'string' || typeof payout.createdAt === 'number') {
          payoutDate = new Date(payout.createdAt);
        }
      } else if (payout.completedAt) {
        // Fallback to completedAt
        if (typeof payout.completedAt.toDate === 'function') {
          payoutDate = payout.completedAt.toDate();
        } else if (payout.completedAt._seconds) {
          payoutDate = new Date(payout.completedAt._seconds * 1000);
        } else if (typeof payout.completedAt === 'string' || typeof payout.completedAt === 'number') {
          payoutDate = new Date(payout.completedAt);
        }
      }

      // Skip if no valid date
      if (!payoutDate || isNaN(payoutDate.getTime())) {
        return;
      }

      completedCount++;

      // Filter by date range in memory
      if (payoutDate < startDateObj || payoutDate > endDateObj) {
        return;
      }
      inRangeCount++;

      const amount = payout.amountCents ? payout.amountCents / 100 : payout.amount || 0;

      const dateKey = getDateKey(payoutDate, timeConfig.granularityType);
      const existing = dateMap.get(dateKey);

      if (existing) {
        existing.payouts += amount;
        existing.payoutCount += 1;
      }
    });

    console.log(`[ADMIN] Filtered to ${completedCount} completed payouts, ${inRangeCount} in date range`);

    // Convert to chart data format
    let cumulativePayouts = 0;
    let cumulativePayoutCount = 0;
    
    const result: PayoutDataPoint[] = Array.from(dateMap.entries()).map(([dateKey, data]) => {
      cumulativePayouts += data.payouts;
      cumulativePayoutCount += data.payoutCount;
      
      const date = new Date(dateKey);
      const label = timeConfig.formatLabel(date);
      const averagePayoutAmount = data.payoutCount > 0 ? data.payouts / data.payoutCount : 0;

      return {
        date: label,
        payouts: cumulative ? cumulativePayouts : data.payouts,
        cumulativePayouts,
        payoutCount: cumulative ? cumulativePayoutCount : data.payoutCount,
        cumulativePayoutCount,
        averagePayoutAmount: Math.round(averagePayoutAmount * 100) / 100
      };
    });

    console.log(`[ADMIN] Payout analytics response: ${result.length} data points, total payouts: $${cumulativePayouts}`);

    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        dateRange: { startDate: startDateObj.toISOString(), endDate: endDateObj.toISOString() },
        granularity: timeConfig.granularityType,
        cumulative,
        totalPayouts: cumulativePayouts,
        totalPayoutCount: cumulativePayoutCount,
        dataPoints: result.length
      }
    });

  } catch (error: any) {
    console.error('Error fetching payout analytics:', error);
    return NextResponse.json({
      error: 'Failed to fetch payout analytics',
      details: error.message
    }, { status: 500 });
  }
  }); // End withAdminContext
}
