/**
 * Admin API: Writer Earnings Analytics
 * Provides comprehensive writer earnings data for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

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

    console.log(`[ADMIN] Writer earnings request: ${startDate} to ${endDate}, cumulative: ${cumulative}`);

    if (!cumulative && (!startDate || !endDate)) {
      return NextResponse.json({
        error: 'Start date and end date are required for period analysis'
      }, { status: 400 });
    }

    let totalEarnings = 0;
    let totalWriters = 0;
    let monthlyEarnings = 0;
    let cumulativeEarnings = 0;

    if (cumulative) {
      // Get all-time earnings data by aggregating from earnings records (Phase 2 - single source of truth)
      const earningsSnapshot = await db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)).get();

      const writerEarnings = new Map<string, number>();

      earningsSnapshot.docs.forEach(doc => {
        const earning = doc.data();
        const cents = earning.totalUsdCentsReceived || earning.totalCentsReceived || 0;
        if (cents > 0) {
          const earnings = cents / 100; // Convert cents to dollars
          const userId = earning.userId;
          const currentTotal = writerEarnings.get(userId) || 0;
          writerEarnings.set(userId, currentTotal + earnings);
          cumulativeEarnings += earnings;
        }
      });

      totalWriters = writerEarnings.size;
      totalEarnings = cumulativeEarnings;

    } else {
      // Get period-specific earnings data
      const startDateObj = new Date(startDate!);
      const endDateObj = new Date(endDate!);
      
      // Generate month strings for the period
      const months: string[] = [];
      const current = new Date(startDateObj);
      
      while (current <= endDateObj) {
        const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        months.push(monthStr);
        current.setMonth(current.getMonth() + 1);
      }

      // Get earnings for each month in the period
      const writerEarnings = new Map<string, number>();
      
      for (const month of months) {
        const earningsQuery = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
          .where('month', '==', month);
        
        const earningsSnapshot = await earningsQuery.get();
        
        earningsSnapshot.docs.forEach(doc => {
          const earning = doc.data();
          if (earning.totalUsdCentsReceived > 0) {
            const earnings = earning.totalUsdCentsReceived / 100; // Convert cents to dollars
            const currentEarnings = writerEarnings.get(earning.userId) || 0;
            writerEarnings.set(earning.userId, currentEarnings + earnings);
            totalEarnings += earnings;
          }
        });
      }

      totalWriters = writerEarnings.size;

      // Get current month earnings for comparison
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      if (months.includes(currentMonth)) {
        const currentMonthQuery = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
          .where('month', '==', currentMonth);
        
        const currentMonthSnapshot = await currentMonthQuery.get();
        currentMonthSnapshot.docs.forEach(doc => {
          const earning = doc.data();
          monthlyEarnings += (earning.totalUsdCentsReceived || 0) / 100;
        });
      }
    }

    const averageEarningsPerWriter = totalWriters > 0 ? totalEarnings / totalWriters : 0;

    const responseData = {
      totalEarnings,
      totalWriters,
      averageEarningsPerWriter,
      monthlyEarnings,
      cumulativeEarnings: cumulative ? cumulativeEarnings : totalEarnings,
      period: cumulative ? 'all-time' : `${startDate} to ${endDate}`,
      generatedAt: new Date().toISOString()
    };

    console.log(`[ADMIN] Writer earnings response:`, {
      totalEarnings: responseData.totalEarnings,
      totalWriters: responseData.totalWriters,
      cumulative
    });

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('[ADMIN] Error fetching writer earnings:', error);
    
    return NextResponse.json({
      error: 'Failed to fetch writer earnings data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
    }
  }); // End withAdminContext
}
