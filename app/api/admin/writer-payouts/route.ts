/**
 * Admin API: Writer Payouts Analytics
 * Provides comprehensive writer payouts data for admin dashboard
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

    console.log(`[ADMIN] Writer payouts request: ${startDate} to ${endDate}, cumulative: ${cumulative}`);

    let totalPayouts = 0;
    let totalPayoutCount = 0;
    let monthlyPayouts = 0;
    let cumulativePayouts = 0;
    let pendingPayouts = 0;

    if (cumulative) {
      // Get all-time payouts data
      const payoutsSnapshot = await db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).get();
      
      payoutsSnapshot.docs.forEach(doc => {
        const payout = doc.data();
        const amount = payout.amountCents ? payout.amountCents / 100 : payout.amount || 0;
        
        if (payout.status === 'completed') {
          cumulativePayouts += amount;
          totalPayoutCount++;
        } else if (payout.status === 'pending' || payout.status === 'processing') {
          pendingPayouts += amount;
        }
      });

      totalPayouts = cumulativePayouts;

    } else {
      // Get period-specific payouts data
      if (!startDate || !endDate) {
        return NextResponse.json({
          error: 'Start date and end date are required for period analysis'
        }, { status: 400 });
      }

      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      // Query payouts within the date range
      const payoutsQuery = db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
        .where('requestedAt', '>=', admin.firestore.Timestamp.fromDate(startDateObj))
        .where('requestedAt', '<=', admin.firestore.Timestamp.fromDate(endDateObj));
      
      const payoutsSnapshot = await payoutsQuery.get();
      
      payoutsSnapshot.docs.forEach(doc => {
        const payout = doc.data();
        const amount = payout.amountCents ? payout.amountCents / 100 : payout.amount || 0;
        
        if (payout.status === 'completed') {
          totalPayouts += amount;
          totalPayoutCount++;
        } else if (payout.status === 'pending' || payout.status === 'processing') {
          pendingPayouts += amount;
        }
      });

      // Get current month payouts for comparison
      const currentMonth = new Date();
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      if (monthStart >= startDateObj && monthEnd <= endDateObj) {
        const monthlyQuery = db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
          .where('requestedAt', '>=', admin.firestore.Timestamp.fromDate(monthStart))
          .where('requestedAt', '<=', admin.firestore.Timestamp.fromDate(monthEnd))
          .where('status', '==', 'completed');
        
        const monthlySnapshot = await monthlyQuery.get();
        monthlySnapshot.docs.forEach(doc => {
          const payout = doc.data();
          const amount = payout.amountCents ? payout.amountCents / 100 : payout.amount || 0;
          monthlyPayouts += amount;
        });
      }
    }

    // Get pending payouts (always current, regardless of date range)
    if (!cumulative) {
      const pendingQuery = db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
        .where('status', 'in', ['pending', 'processing']);
      
      const pendingSnapshot = await pendingQuery.get();
      pendingPayouts = 0; // Reset since we're recalculating
      
      pendingSnapshot.docs.forEach(doc => {
        const payout = doc.data();
        const amount = payout.amountCents ? payout.amountCents / 100 : payout.amount || 0;
        pendingPayouts += amount;
      });
    }

    const averagePayoutAmount = totalPayoutCount > 0 ? totalPayouts / totalPayoutCount : 0;

    const responseData = {
      totalPayouts,
      totalPayoutCount,
      averagePayoutAmount,
      monthlyPayouts,
      cumulativePayouts: cumulative ? cumulativePayouts : totalPayouts,
      pendingPayouts,
      period: cumulative ? 'all-time' : `${startDate} to ${endDate}`,
      generatedAt: new Date().toISOString()
    };

    console.log(`[ADMIN] Writer payouts response:`, {
      totalPayouts: responseData.totalPayouts,
      totalPayoutCount: responseData.totalPayoutCount,
      pendingPayouts: responseData.pendingPayouts,
      cumulative
    });

      return NextResponse.json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('[ADMIN] Error fetching writer payouts:', error);

      return NextResponse.json({
        error: 'Failed to fetch writer payouts data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }); // End withAdminContext
}
