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
 *
 * Query Parameters:
 * - sync=true: Automatically sync Firebase USD_BALANCES with Stripe subscription data
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin, FieldValue } from '../../../firebase/firebaseAdmin';
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
  subscribers: SubscriberDetail[];
}

interface SubscriberDetail {
  id: string;
  email: string;
  name: string | null;
  subscriptionAmountCents: number;
  allocatedCents: number;
  unallocatedCents: number;
  grossEarningsCents: number;  // What creators earn before fees
  platformFeeCents: number;    // 7% of allocated
  netCreatorPayoutCents: number; // What creators actually receive
  stripeCustomerId: string;
  status: string;
}

export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    // Check for sync parameter
    const { searchParams } = new URL(request.url);
    const shouldSync = searchParams.get('sync') === 'true';

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get current month in YYYY-MM format
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Initialize Stripe
    const stripeKey = getStripeSecretKey() || '';
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-06-20'
    });

    // DEBUG: Log environment info
    const usdBalancesCollection = await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES);
    console.log('[MONTHLY FINANCIALS DEBUG] Environment:', {
      nodeEnv: process.env.NODE_ENV,
      stripeKeyPrefix: stripeKey.substring(0, 12),
      usdBalancesCollection,
      isDev: process.env.NODE_ENV === 'development'
    });

    // ========================================
    // 1. Get ACTUAL subscription data from Stripe (source of truth)
    // ========================================
    let stripeSubscriptionData: StripeSubscriptionData = {
      totalActiveSubscriptions: 0,
      totalMRRCents: 0,
      subscriptionBreakdown: [],
      subscribers: []
    };

    // Map to store customer ID -> Firebase user allocation data
    const customerAllocations: Map<string, { allocatedCents: number; userId: string }> = new Map();

    try {
      // Get all active subscriptions from Stripe
      const subscriptions = await stripe.subscriptions.list({
        status: 'active',
        limit: 100, // Adjust if you have more than 100 subscribers
        expand: ['data.items.data.price', 'data.customer']
      });

      const amountCounts: Record<number, number> = {};

      // First, get allocation data from Firebase for each subscriber
      const balancesRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES));
      const balancesSnapshot = await balancesRef.get();

      // Also get users collection to look up stripeCustomerId
      const usersCollectionName = await getCollectionNameAsync('users');
      const usersRef = db.collection(usersCollectionName);

      // Build a map of Stripe customer ID to allocation data
      // Try USD_BALANCES.stripeCustomerId first, then fall back to users collection
      for (const doc of balancesSnapshot.docs) {
        const data = doc.data();
        const userId = doc.id;
        let stripeCustomerId = data.stripeCustomerId;

        // If stripeCustomerId not in USD_BALANCES, look it up in users collection
        if (!stripeCustomerId) {
          try {
            const userDoc = await usersRef.doc(userId).get();
            if (userDoc.exists) {
              stripeCustomerId = userDoc.data()?.stripeCustomerId;
            }
          } catch (err) {
            console.warn(`[MONTHLY FINANCIALS] Could not fetch user doc for ${userId}:`, err);
          }
        }

        if (stripeCustomerId) {
          customerAllocations.set(stripeCustomerId, {
            allocatedCents: typeof data.allocatedUsdCents === 'number' ? data.allocatedUsdCents : 0,
            userId: doc.id
          });
        }
      }

      for (const sub of subscriptions.data) {
        // Get the subscription amount from the first item
        const item = sub.items.data[0];
        if (item && item.price) {
          const amountCents = item.price.unit_amount || 0;
          stripeSubscriptionData.totalMRRCents += amountCents;
          stripeSubscriptionData.totalActiveSubscriptions += 1;

          // Track breakdown by amount
          amountCounts[amountCents] = (amountCounts[amountCents] || 0) + 1;

          // Get customer details
          const customer = sub.customer as Stripe.Customer;
          const customerId = typeof sub.customer === 'string' ? sub.customer : customer?.id || '';
          const customerEmail = customer?.email || 'Unknown';
          const customerName = customer?.name || null;

          // Get allocation data for this customer
          const allocationData = customerAllocations.get(customerId);
          const allocatedCents = allocationData?.allocatedCents || 0;
          const unallocatedCents = Math.max(0, amountCents - allocatedCents);
          const platformFeeCents = Math.round(allocatedCents * 0.07);
          const netCreatorPayoutCents = allocatedCents - platformFeeCents;

          stripeSubscriptionData.subscribers.push({
            id: allocationData?.userId || customerId,
            email: customerEmail,
            name: customerName,
            subscriptionAmountCents: amountCents,
            allocatedCents,
            unallocatedCents,
            grossEarningsCents: allocatedCents, // Gross = what was allocated to creators
            platformFeeCents,
            netCreatorPayoutCents,
            stripeCustomerId: customerId,
            status: sub.status
          });
        }
      }

      // Sort subscribers by subscription amount descending
      stripeSubscriptionData.subscribers.sort((a, b) => b.subscriptionAmountCents - a.subscriptionAmountCents);

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
    // 2. Calculate Firebase totals from already-fetched data
    // (balancesSnapshot was fetched above in section 1)
    // ========================================
    let firebaseData = {
      totalAllocatedCents: 0,
      totalMonthlyAllocationCents: 0, // What Firebase thinks subscriptions are
      usersWithBalances: 0
    };

    // Re-use the balancesSnapshot from above (already fetched)
    const balancesRefForTotals = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES));
    const balancesSnapshotForTotals = await balancesRefForTotals.get();

    for (const doc of balancesSnapshotForTotals.docs) {
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
    // 7. Data reconciliation check with detailed discrepancy analysis
    // Compare Stripe subscription amounts vs Firebase recorded amounts
    // ========================================

    // Build a map of Stripe customer ID -> subscription data for easy lookup
    const stripeCustomerMap = new Map<string, { email: string; amountCents: number }>();
    for (const sub of stripeSubscriptionData.subscribers) {
      stripeCustomerMap.set(sub.stripeCustomerId, {
        email: sub.email,
        amountCents: sub.subscriptionAmountCents
      });
    }

    // Build a map of all Firebase balance records with stripeCustomerId
    const firebaseBalanceMap = new Map<string, {
      docId: string;
      stripeCustomerId: string;
      monthlyAllocationCents: number;
      allocatedCents: number;
    }>();

    const balancesCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES);
    const allBalancesSnapshot = await db.collection(balancesCollectionName).get();

    // Re-use the usersRef from earlier for looking up stripeCustomerId
    const reconUsersCollectionName = await getCollectionNameAsync('users');
    const reconUsersRef = db.collection(reconUsersCollectionName);

    for (const doc of allBalancesSnapshot.docs) {
      const data = doc.data();
      const userId = doc.id;
      let stripeCustomerId = data.stripeCustomerId;

      // If stripeCustomerId not in USD_BALANCES, look it up in users collection
      if (!stripeCustomerId) {
        try {
          const userDoc = await reconUsersRef.doc(userId).get();
          if (userDoc.exists) {
            stripeCustomerId = userDoc.data()?.stripeCustomerId;
          }
        } catch (err) {
          console.warn(`[MONTHLY FINANCIALS] Recon: Could not fetch user doc for ${userId}:`, err);
        }
      }

      if (stripeCustomerId) {
        firebaseBalanceMap.set(stripeCustomerId, {
          docId: doc.id,
          stripeCustomerId,
          monthlyAllocationCents: typeof data.monthlyAllocationCents === 'number' ? data.monthlyAllocationCents : 0,
          allocatedCents: typeof data.allocatedUsdCents === 'number' ? data.allocatedUsdCents : 0
        });
      }
    }

    // Identify discrepancies
    const discrepancies: Array<{
      type: 'stale_firebase' | 'missing_firebase' | 'amount_mismatch';
      stripeCustomerId: string;
      email: string;
      stripeAmountCents: number;
      firebaseAmountCents: number;
      firebaseDocId?: string;
    }> = [];

    // Check for stale Firebase records (no active Stripe subscription)
    for (const [stripeCustomerId, fbData] of firebaseBalanceMap) {
      if (!stripeCustomerMap.has(stripeCustomerId) && fbData.monthlyAllocationCents > 0) {
        discrepancies.push({
          type: 'stale_firebase',
          stripeCustomerId,
          email: 'Unknown (no active subscription)',
          stripeAmountCents: 0,
          firebaseAmountCents: fbData.monthlyAllocationCents,
          firebaseDocId: fbData.docId
        });
      }
    }

    // Check for missing Firebase records and amount mismatches
    for (const [stripeCustomerId, stripeData] of stripeCustomerMap) {
      const fbData = firebaseBalanceMap.get(stripeCustomerId);
      if (!fbData) {
        discrepancies.push({
          type: 'missing_firebase',
          stripeCustomerId,
          email: stripeData.email,
          stripeAmountCents: stripeData.amountCents,
          firebaseAmountCents: 0
        });
      } else if (fbData.monthlyAllocationCents !== stripeData.amountCents) {
        discrepancies.push({
          type: 'amount_mismatch',
          stripeCustomerId,
          email: stripeData.email,
          stripeAmountCents: stripeData.amountCents,
          firebaseAmountCents: fbData.monthlyAllocationCents,
          firebaseDocId: fbData.docId
        });
      }
    }

    // If sync=true, fix the discrepancies
    let syncResults: {
      synced: boolean;
      staleRecordsFixed: number;
      missingRecordsCreated: number;
      amountMismatchesFixed: number;
      errors: string[];
    } | null = null;

    if (shouldSync && discrepancies.length > 0) {
      syncResults = {
        synced: true,
        staleRecordsFixed: 0,
        missingRecordsCreated: 0,
        amountMismatchesFixed: 0,
        errors: []
      };

      const batch = db.batch();
      let batchCount = 0;

      for (const discrepancy of discrepancies) {
        try {
          if (discrepancy.type === 'stale_firebase' && discrepancy.firebaseDocId) {
            // Zero out the monthlyAllocationCents for stale records
            const docRef = db.collection(balancesCollectionName).doc(discrepancy.firebaseDocId);
            const fbData = firebaseBalanceMap.get(discrepancy.stripeCustomerId);
            const allocatedCents = fbData?.allocatedCents || 0;
            batch.update(docRef, {
              monthlyAllocationCents: 0,
              totalUsdCents: 0,
              availableUsdCents: -allocatedCents,
              updatedAt: FieldValue.serverTimestamp()
            });
            syncResults.staleRecordsFixed++;
            batchCount++;
          } else if (discrepancy.type === 'amount_mismatch' && discrepancy.firebaseDocId) {
            // Update the monthlyAllocationCents to match Stripe
            const docRef = db.collection(balancesCollectionName).doc(discrepancy.firebaseDocId);
            const fbData = firebaseBalanceMap.get(discrepancy.stripeCustomerId);
            const allocatedCents = fbData?.allocatedCents || 0;
            batch.update(docRef, {
              monthlyAllocationCents: discrepancy.stripeAmountCents,
              totalUsdCents: discrepancy.stripeAmountCents,
              availableUsdCents: discrepancy.stripeAmountCents - allocatedCents,
              updatedAt: FieldValue.serverTimestamp()
            });
            syncResults.amountMismatchesFixed++;
            batchCount++;
          }
          // Note: We don't create missing Firebase records here as that requires
          // knowing the Firebase userId, which we don't have from just the Stripe customer ID.
          // Missing records will be created when the user logs in next.
        } catch (err) {
          syncResults.errors.push(`Error processing ${discrepancy.stripeCustomerId}: ${err}`);
        }
      }

      if (batchCount > 0) {
        try {
          await batch.commit();
          console.log(`[MONTHLY FINANCIALS] Synced ${batchCount} Firebase records with Stripe`);
        } catch (batchError) {
          console.error('[MONTHLY FINANCIALS] Error committing sync batch:', batchError);
          syncResults.errors.push(`Batch commit error: ${batchError}`);
        }
      }
    }

    const reconciliation = {
      stripeSubscriptionsCents: stripeSubscriptionData.totalMRRCents,
      firebaseRecordedCents: firebaseData.totalMonthlyAllocationCents,
      discrepancyCents: stripeSubscriptionData.totalMRRCents - firebaseData.totalMonthlyAllocationCents,
      stripeSubscriberCount: stripeSubscriptionData.totalActiveSubscriptions,
      firebaseUserCount: firebaseData.usersWithBalances,
      userCountDiscrepancy: stripeSubscriptionData.totalActiveSubscriptions - firebaseData.usersWithBalances,
      isInSync: discrepancies.length === 0,
      discrepancies,
      syncResults
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
      },
      // DEBUG: Include environment info in response
      debug: {
        environment: process.env.NODE_ENV,
        stripeMode: stripeKey.startsWith('sk_test') ? 'TEST' : stripeKey.startsWith('sk_live') ? 'LIVE' : 'UNKNOWN',
        firebaseCollection: usdBalancesCollection,
        stripeSubscriptionCount: stripeSubscriptionData.totalActiveSubscriptions,
        firebaseRecordCount: firebaseData.usersWithBalances
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
