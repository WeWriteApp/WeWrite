/**
 * Monthly Financials API
 *
 * Returns current month fund status and historical monthly financial data.
 * Shows allocations tracked in Firebase, Stripe balance breakdown, and
 * creator obligations vs platform revenue.
 *
 * IMPORTANT: This reflects the ACTUAL fund flow model:
 * - Allocations are tracked in Firebase throughout the month
 * - At month-end, bulk processing moves funds to Storage Balance for payouts
 * - Unallocated funds become platform revenue ("use it or lose it")
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionNameAsync, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';

interface MonthlyFinancialData {
  month: string;
  totalSubscriptionCents: number;
  totalAllocatedCents: number;
  totalUnallocatedCents: number;
  platformFeeCents: number; // 7% of allocated
  creatorPayoutsCents: number; // Allocated - platform fee
  platformRevenueCents: number; // Unallocated + platform fee
  userCount: number;
  allocationRate: number; // Percentage allocated
  status: 'in_progress' | 'processed' | 'pending';
}

export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get current month in YYYY-MM format
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Calculate current month data from USD balances
    const balancesRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES));
    const balancesSnapshot = await balancesRef.get();

    let currentMonthData: MonthlyFinancialData = {
      month: currentMonth,
      totalSubscriptionCents: 0,
      totalAllocatedCents: 0,
      totalUnallocatedCents: 0,
      platformFeeCents: 0,
      creatorPayoutsCents: 0,
      platformRevenueCents: 0,
      userCount: 0,
      allocationRate: 0,
      status: 'in_progress'
    };

    for (const doc of balancesSnapshot.docs) {
      const data = doc.data();

      // Monthly allocation is the subscription amount for the current month
      const monthlyCents = typeof data.monthlyAllocationCents === 'number'
        ? data.monthlyAllocationCents
        : (typeof data.totalUsdCents === 'number' ? data.totalUsdCents : 0);

      // Allocated is what users have allocated to creators
      const allocatedCents = typeof data.allocatedUsdCents === 'number'
        ? data.allocatedUsdCents
        : 0;

      if (monthlyCents > 0) {
        currentMonthData.totalSubscriptionCents += monthlyCents;
        currentMonthData.totalAllocatedCents += allocatedCents;
        currentMonthData.userCount += 1;
      }
    }

    // Calculate derived values for current month
    currentMonthData.totalUnallocatedCents = Math.max(0,
      currentMonthData.totalSubscriptionCents - currentMonthData.totalAllocatedCents
    );
    currentMonthData.platformFeeCents = Math.round(currentMonthData.totalAllocatedCents * 0.07);
    currentMonthData.creatorPayoutsCents = currentMonthData.totalAllocatedCents - currentMonthData.platformFeeCents;
    currentMonthData.platformRevenueCents = currentMonthData.totalUnallocatedCents + currentMonthData.platformFeeCents;
    currentMonthData.allocationRate = currentMonthData.totalSubscriptionCents > 0
      ? (currentMonthData.totalAllocatedCents / currentMonthData.totalSubscriptionCents) * 100
      : 0;

    // Get historical monthly data from monthly_processing collection
    const processingRef = db.collection(await getCollectionNameAsync('monthly_processing'));
    const processingSnapshot = await processingRef.orderBy('processedAt', 'desc').limit(12).get();

    const historicalData: MonthlyFinancialData[] = [];

    for (const doc of processingSnapshot.docs) {
      const data = doc.data();
      const month = data.month || doc.id;

      const totalSubscriptionCents = data.totalSubscriptionCents || 0;
      const totalAllocatedCents = data.totalAllocatedCents || 0;
      const totalUnallocatedCents = data.totalUnallocatedCents || totalSubscriptionCents - totalAllocatedCents;
      const platformFeeCents = data.platformFeeCents || Math.round(totalAllocatedCents * 0.07);

      historicalData.push({
        month,
        totalSubscriptionCents,
        totalAllocatedCents,
        totalUnallocatedCents,
        platformFeeCents,
        creatorPayoutsCents: totalAllocatedCents - platformFeeCents,
        platformRevenueCents: totalUnallocatedCents + platformFeeCents,
        userCount: data.userCount || 0,
        allocationRate: totalSubscriptionCents > 0
          ? (totalAllocatedCents / totalSubscriptionCents) * 100
          : 0,
        status: 'processed'
      });
    }

    // Get Stripe balance breakdown (if available)
    let stripeBalance = null;
    try {
      const stripe = new Stripe(getStripeSecretKey() || '', {
        apiVersion: '2024-06-20'
      });

      const balance = await stripe.balance.retrieve();

      // Find USD balances
      const usdAvailable = balance.available.find(b => b.currency === 'usd');
      const usdPending = balance.pending.find(b => b.currency === 'usd');

      stripeBalance = {
        availableCents: usdAvailable?.amount || 0,
        pendingCents: usdPending?.amount || 0,
        totalCents: (usdAvailable?.amount || 0) + (usdPending?.amount || 0),
        lastUpdated: new Date().toISOString()
      };
    } catch (stripeError) {
      console.error('Error fetching Stripe balance:', stripeError);
      // Continue without Stripe data
    }

    // Calculate totals across all historical data
    const totals = {
      totalSubscriptionCents: historicalData.reduce((sum, d) => sum + d.totalSubscriptionCents, 0),
      totalAllocatedCents: historicalData.reduce((sum, d) => sum + d.totalAllocatedCents, 0),
      totalUnallocatedCents: historicalData.reduce((sum, d) => sum + d.totalUnallocatedCents, 0),
      totalPlatformFeeCents: historicalData.reduce((sum, d) => sum + d.platformFeeCents, 0),
      totalCreatorPayoutsCents: historicalData.reduce((sum, d) => sum + d.creatorPayoutsCents, 0),
      totalPlatformRevenueCents: historicalData.reduce((sum, d) => sum + d.platformRevenueCents, 0),
      averageAllocationRate: historicalData.length > 0
        ? historicalData.reduce((sum, d) => sum + d.allocationRate, 0) / historicalData.length
        : 0
    };

    // Days remaining in current month
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = lastDayOfMonth.getDate() - now.getDate();

    return NextResponse.json({
      success: true,
      currentMonth: {
        data: currentMonthData,
        daysRemaining,
        processingDate: `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`
      },
      historicalData,
      stripeBalance,
      totals,
      metadata: {
        platformFeeRate: 0.07,
        fundFlowModel: 'monthly_bulk_processing',
        description: 'Allocations tracked in Firebase. Bulk transfer to Storage Balance at month-end for payouts. Unallocated funds become platform revenue.'
      }
    });

  } catch (error) {
    console.error('Error fetching monthly financials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly financials data' },
      { status: 500 }
    );
  }
}
