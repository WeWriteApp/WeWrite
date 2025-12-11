/**
 * Monthly Financials API
 *
 * Returns current month fund status and historical monthly financial data.
 * Shows allocations tracked in Firebase, Stripe balance breakdown, and
 * creator obligations vs platform revenue.
 *
 * DATA SOURCES:
 * - Stripe: Active subscriptions (source of truth for revenue)
 * - Firebase USD_BALANCES: Allocations tracking
 * - Firebase monthly_processing: Historical snapshots (if available)
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

interface StripeSubscriptionData {
  totalActiveSubscriptions: number;
  totalMRRCents: number; // Monthly recurring revenue
  subscriptionBreakdown: {
    amount: number;
    count: number;
  }[];
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

    // Initialize Stripe
    const stripe = new Stripe(getStripeSecretKey() || '', {
      apiVersion: '2024-06-20'
    });

    // ========================================
    // 1. Get ACTUAL subscription data from Stripe (source of truth)
    // ========================================
    let stripeSubscriptionData: StripeSubscriptionData = {
      totalActiveSubscriptions: 0,
      totalMRRCents: 0,
      subscriptionBreakdown: []
    };

    try {
      // Get all active subscriptions from Stripe
      const subscriptions = await stripe.subscriptions.list({
        status: 'active',
        limit: 100, // Adjust if you have more than 100 subscribers
        expand: ['data.items.data.price']
      });

      const amountCounts: Record<number, number> = {};

      for (const sub of subscriptions.data) {
        // Get the subscription amount from the first item
        const item = sub.items.data[0];
        if (item && item.price) {
          const amountCents = item.price.unit_amount || 0;
          stripeSubscriptionData.totalMRRCents += amountCents;
          stripeSubscriptionData.totalActiveSubscriptions += 1;

          // Track breakdown by amount
          amountCounts[amountCents] = (amountCounts[amountCents] || 0) + 1;
        }
      }

      // Convert breakdown to array
      stripeSubscriptionData.subscriptionBreakdown = Object.entries(amountCounts)
        .map(([amount, count]) => ({
          amount: parseInt(amount),
          count
        }))
        .sort((a, b) => b.amount - a.amount);

    } catch (stripeSubError) {
      console.error('Error fetching Stripe subscriptions:', stripeSubError);
    }

    // ========================================
    // 2. Get allocation data from Firebase (tracks what users have allocated)
    // ========================================
    const balancesRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES));
    const balancesSnapshot = await balancesRef.get();

    let firebaseData = {
      totalAllocatedCents: 0,
      totalMonthlyAllocationCents: 0, // What Firebase thinks subscriptions are
      usersWithBalances: 0
    };

    for (const doc of balancesSnapshot.docs) {
      const data = doc.data();

      // What Firebase thinks the monthly allocation is
      const monthlyAllocation = typeof data.monthlyAllocationCents === 'number'
        ? data.monthlyAllocationCents
        : (typeof data.totalUsdCents === 'number' ? data.totalUsdCents : 0);

      // What users have actually allocated to creators
      const allocatedCents = typeof data.allocatedUsdCents === 'number'
        ? data.allocatedUsdCents
        : 0;

      if (monthlyAllocation > 0 || allocatedCents > 0) {
        firebaseData.totalMonthlyAllocationCents += monthlyAllocation;
        firebaseData.totalAllocatedCents += allocatedCents;
        firebaseData.usersWithBalances += 1;
      }
    }

    // ========================================
    // 3. Calculate current month financials
    // Use Stripe as source of truth for subscription revenue
    // ========================================
    const totalSubscriptionCents = stripeSubscriptionData.totalMRRCents;
    const totalAllocatedCents = firebaseData.totalAllocatedCents;

    let currentMonthData: MonthlyFinancialData = {
      month: currentMonth,
      totalSubscriptionCents,
      totalAllocatedCents,
      totalUnallocatedCents: Math.max(0, totalSubscriptionCents - totalAllocatedCents),
      platformFeeCents: Math.round(totalAllocatedCents * 0.07),
      creatorPayoutsCents: 0,
      platformRevenueCents: 0,
      userCount: stripeSubscriptionData.totalActiveSubscriptions,
      allocationRate: totalSubscriptionCents > 0
        ? (totalAllocatedCents / totalSubscriptionCents) * 100
        : 0,
      status: 'in_progress'
    };

    // Calculate derived values
    currentMonthData.creatorPayoutsCents = totalAllocatedCents - currentMonthData.platformFeeCents;
    currentMonthData.platformRevenueCents = currentMonthData.totalUnallocatedCents + currentMonthData.platformFeeCents;

    // ========================================
    // 4. Get historical monthly data from monthly_processing collection
    // ========================================
    const processingRef = db.collection(await getCollectionNameAsync('monthly_processing'));
    const processingSnapshot = await processingRef.orderBy('processedAt', 'desc').limit(12).get();

    const historicalData: MonthlyFinancialData[] = [];

    for (const doc of processingSnapshot.docs) {
      const data = doc.data();
      const month = data.month || doc.id;

      const histTotalSubscriptionCents = data.totalSubscriptionCents || 0;
      const histTotalAllocatedCents = data.totalAllocatedCents || 0;
      const histTotalUnallocatedCents = data.totalUnallocatedCents || histTotalSubscriptionCents - histTotalAllocatedCents;
      const histPlatformFeeCents = data.platformFeeCents || Math.round(histTotalAllocatedCents * 0.07);

      historicalData.push({
        month,
        totalSubscriptionCents: histTotalSubscriptionCents,
        totalAllocatedCents: histTotalAllocatedCents,
        totalUnallocatedCents: histTotalUnallocatedCents,
        platformFeeCents: histPlatformFeeCents,
        creatorPayoutsCents: histTotalAllocatedCents - histPlatformFeeCents,
        platformRevenueCents: histTotalUnallocatedCents + histPlatformFeeCents,
        userCount: data.userCount || 0,
        allocationRate: histTotalSubscriptionCents > 0
          ? (histTotalAllocatedCents / histTotalSubscriptionCents) * 100
          : 0,
        status: 'processed'
      });
    }

    // ========================================
    // 5. Get Stripe balance breakdown
    // ========================================
    let stripeBalance = null;
    try {
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
    } catch (stripeBalanceError) {
      console.error('Error fetching Stripe balance:', stripeBalanceError);
    }

    // ========================================
    // 6. Calculate totals across all historical data
    // ========================================
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

    // ========================================
    // 7. Data reconciliation check
    // Compare Stripe subscription amounts vs Firebase recorded amounts
    // ========================================
    const reconciliation = {
      stripeSubscriptionsCents: stripeSubscriptionData.totalMRRCents,
      firebaseRecordedCents: firebaseData.totalMonthlyAllocationCents,
      discrepancyCents: stripeSubscriptionData.totalMRRCents - firebaseData.totalMonthlyAllocationCents,
      stripeSubscriberCount: stripeSubscriptionData.totalActiveSubscriptions,
      firebaseUserCount: firebaseData.usersWithBalances,
      userCountDiscrepancy: stripeSubscriptionData.totalActiveSubscriptions - firebaseData.usersWithBalances,
      isInSync: Math.abs(stripeSubscriptionData.totalMRRCents - firebaseData.totalMonthlyAllocationCents) < 100 // Allow $1 margin
    };

    return NextResponse.json({
      success: true,
      currentMonth: {
        data: currentMonthData,
        daysRemaining,
        processingDate: `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`
      },
      historicalData,
      stripeBalance,
      stripeSubscriptions: stripeSubscriptionData,
      totals,
      reconciliation,
      dataSources: {
        subscriptionRevenue: 'Stripe (source of truth)',
        allocations: 'Firebase USD_BALANCES',
        historicalData: historicalData.length > 0 ? 'Firebase monthly_processing' : 'None available'
      },
      metadata: {
        platformFeeRate: 0.07,
        fundFlowModel: 'monthly_bulk_processing',
        description: 'Subscription revenue from Stripe. Allocations tracked in Firebase. Bulk transfer to Storage Balance at month-end for payouts. Unallocated funds become platform revenue.'
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
