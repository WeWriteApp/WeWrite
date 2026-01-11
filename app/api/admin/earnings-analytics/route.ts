/**
 * Earnings Analytics API
 *
 * Provides time-series data for writer earnings with status filtering.
 * Used by the product-kpis dashboard for pending and final earnings graphs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

interface EarningsDataPoint {
  date: string;
  label: string;
  earnings: number;
  writers: number;
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
      const status = searchParams.get('status') || 'all'; // 'pending', 'final', or 'all'

      console.log(`[ADMIN] Earnings analytics request: ${startDate} to ${endDate}, cumulative: ${cumulative}, status: ${status}`);

      if (!startDate || !endDate) {
        return NextResponse.json({
          error: 'Start date and end date are required'
        }, { status: 400 });
      }

      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      // Generate month strings for the period
      const months: string[] = [];
      const current = new Date(startDateObj);

      while (current <= endDateObj) {
        const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        months.push(monthStr);
        current.setMonth(current.getMonth() + 1);
      }

      // Build the query based on status filter
      const earningsCollection = getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS);
      let query = db.collection(earningsCollection);

      // We need to query all earnings and filter by month and status
      // Firestore doesn't support OR queries well, so we'll filter in memory for 'final' status
      const earningsSnapshot = await query.get();

      // Group earnings by month
      const earningsByMonth = new Map<string, { totalCents: number; writerSet: Set<string> }>();

      // Initialize all months with zeros
      months.forEach(month => {
        earningsByMonth.set(month, { totalCents: 0, writerSet: new Set() });
      });

      // Process each earnings record
      earningsSnapshot.docs.forEach(doc => {
        const earning = doc.data();
        const earningMonth = earning.month;

        // Skip if not in our date range
        if (!months.includes(earningMonth)) {
          return;
        }

        // Apply status filter
        const earningStatus = earning.status || 'pending';
        if (status === 'pending' && earningStatus !== 'pending') {
          return;
        }
        if (status === 'final' && earningStatus !== 'available' && earningStatus !== 'paid_out') {
          return;
        }
        // 'all' passes everything

        const cents = earning.totalUsdCentsReceived || 0;
        if (cents > 0) {
          const monthData = earningsByMonth.get(earningMonth);
          if (monthData) {
            monthData.totalCents += cents;
            monthData.writerSet.add(earning.userId);
          }
        }
      });

      // Convert to time-series data
      let data: EarningsDataPoint[] = months.map(month => {
        const monthData = earningsByMonth.get(month) || { totalCents: 0, writerSet: new Set() };
        const [year, monthNum] = month.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const label = `${monthNames[parseInt(monthNum) - 1]} '${year.slice(2)}`;

        return {
          date: month,
          label,
          earnings: monthData.totalCents,
          writers: monthData.writerSet.size
        };
      });

      // Apply cumulative transformation if requested
      if (cumulative) {
        let runningTotal = 0;
        let allWriters = new Set<string>();

        data = data.map(point => {
          runningTotal += point.earnings;
          // For cumulative writers, we need to re-calculate
          // But since we don't have writer IDs in the output, we'll just sum earnings
          return {
            ...point,
            earnings: runningTotal
          };
        });
      }

      // Calculate totals
      let totalEarnings = 0;
      const uniqueWriters = new Set<string>();

      earningsByMonth.forEach(monthData => {
        totalEarnings += monthData.totalCents;
        monthData.writerSet.forEach(w => uniqueWriters.add(w));
      });

      const responseData = {
        success: true,
        data,
        metadata: {
          totalEarnings,
          totalWriters: uniqueWriters.size,
          period: `${startDate} to ${endDate}`,
          status,
          cumulative
        }
      };

      console.log(`[ADMIN] Earnings analytics response:`, {
        totalEarnings: responseData.metadata.totalEarnings,
        totalWriters: responseData.metadata.totalWriters,
        dataPoints: data.length,
        status,
        cumulative
      });

      return NextResponse.json(responseData);

    } catch (error) {
      console.error('[ADMIN] Error fetching earnings analytics:', error);

      return NextResponse.json({
        error: 'Failed to fetch earnings analytics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }); // End withAdminContext
}
