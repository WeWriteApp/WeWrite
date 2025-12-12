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
  allocatedCents: number;           // Total allocated (may exceed subscription)
  fundedAllocatedCents: number;     // Min(allocated, subscription) - what's actually backed by money
  overspentUnfundedCents: number;   // Max(0, allocated - subscription) - unfunded portion
  unallocatedCents: number;         // Max(0, subscription - allocated) - leftover subscription
  grossEarningsCents: number;       // Funded earnings before fees (= fundedAllocatedCents)
  platformFeeCents: number;         // 7% of funded allocated
  netCreatorPayoutCents: number;    // Funded allocated minus platform fee
  stripeCustomerId: string;
  status: string;
}

interface WriterEarningsDetail {
  userId: string;
  email: string;
  name: string | null;
  grossEarningsCents: number;       // Total earnings before platform fee
  platformFeeCents: number;         // 7% fee taken from earnings
  netPayoutCents: number;           // Amount writer receives after fee
  pendingEarningsCents: number;     // Current month earnings (not yet available)
  availableEarningsCents: number;   // Previous months (available for payout)
  bankAccountStatus: 'not_setup' | 'pending' | 'verified' | 'restricted' | 'rejected';
  stripeConnectedAccountId: string | null;
  canReceivePayout: boolean;
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

          // CRITICAL: Calculate funded vs unfunded allocations
          // Funded = min(allocated, subscription) - what's actually backed by money
          // Overspent/Unfunded = max(0, allocated - subscription) - allocations exceeding subscription
          // Unallocated = max(0, subscription - allocated) - leftover subscription money
          const fundedAllocatedCents = Math.min(allocatedCents, amountCents);
          const overspentUnfundedCents = Math.max(0, allocatedCents - amountCents);
          const unallocatedCents = Math.max(0, amountCents - allocatedCents);

          // Platform fee and net payout are based on FUNDED allocations only
          const platformFeeCents = Math.round(fundedAllocatedCents * 0.07);
          const netCreatorPayoutCents = fundedAllocatedCents - platformFeeCents;

          stripeSubscriptionData.subscribers.push({
            id: allocationData?.userId || customerId,
            email: customerEmail,
            name: customerName,
            subscriptionAmountCents: amountCents,
            allocatedCents,
            fundedAllocatedCents,
            overspentUnfundedCents,
            unallocatedCents,
            grossEarningsCents: fundedAllocatedCents, // Gross = FUNDED allocations only
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
    // Use FUNDED allocations (from subscribers) for accurate creator payouts
    // ========================================
    const totalSubscriptionCents = stripeSubscriptionData.totalMRRCents;
    const totalAllocatedCents = firebaseData.totalAllocatedCents;

    // Calculate funded totals from the subscriber data we already computed
    const totalFundedAllocatedCents = stripeSubscriptionData.subscribers.reduce(
      (sum, sub) => sum + sub.fundedAllocatedCents, 0
    );
    const totalOverspentUnfundedCents = stripeSubscriptionData.subscribers.reduce(
      (sum, sub) => sum + sub.overspentUnfundedCents, 0
    );

    // Platform fee and creator payouts are based on FUNDED allocations only
    const fundedPlatformFeeCents = Math.round(totalFundedAllocatedCents * 0.07);
    const fundedCreatorPayoutsCents = totalFundedAllocatedCents - fundedPlatformFeeCents;

    let currentMonthData: MonthlyFinancialData = {
      month: currentMonth,
      totalSubscriptionCents,
      totalAllocatedCents: totalFundedAllocatedCents, // Only show funded allocations
      totalUnallocatedCents: Math.max(0, totalSubscriptionCents - totalFundedAllocatedCents),
      platformFeeCents: fundedPlatformFeeCents,
      creatorPayoutsCents: fundedCreatorPayoutsCents,
      platformRevenueCents: 0,
      userCount: stripeSubscriptionData.totalActiveSubscriptions,
      allocationRate: totalSubscriptionCents > 0
        ? (totalFundedAllocatedCents / totalSubscriptionCents) * 100
        : 0,
      status: 'in_progress'
    };

    // Calculate platform revenue (unallocated + platform fee)
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
    // Build a map of userId -> email for looking up user emails
    const userEmailMap = new Map<string, string>();
    for (const doc of allBalancesSnapshot.docs) {
      const userId = doc.id;
      try {
        const userDoc = await reconUsersRef.doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userEmailMap.set(userId, userData?.email || 'Unknown email');
        }
      } catch (err) {
        console.warn(`[MONTHLY FINANCIALS] Could not fetch email for ${userId}:`, err);
      }
    }

    for (const [stripeCustomerId, fbData] of firebaseBalanceMap) {
      if (!stripeCustomerMap.has(stripeCustomerId) && fbData.monthlyAllocationCents > 0) {
        // Look up the user's email from our map
        const userEmail = userEmailMap.get(fbData.docId) || 'Unknown email';
        discrepancies.push({
          type: 'stale_firebase',
          stripeCustomerId,
          email: `${userEmail} (cancelled)`,
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

    // ========================================
    // 8. Get writer earnings data for CURRENT MONTH only
    // IMPORTANT: Scale writer earnings to match funded subscriber allocations
    // This ensures "Total Gross Earnings" = "Total Allocated by Subscribers"
    // ========================================
    const writerEarnings: WriterEarningsDetail[] = [];

    try {
      // Get writer earnings for the CURRENT MONTH from writerUsdEarnings collection
      const writerEarningsCollectionName = await getCollectionNameAsync('writerUsdEarnings');
      const currentMonthEarningsSnapshot = await db.collection(writerEarningsCollectionName)
        .where('month', '==', currentMonth)
        .get();

      // First pass: calculate total raw writer earnings
      let totalRawWriterEarningsCents = 0;
      const rawEarningsMap = new Map<string, number>();

      for (const doc of currentMonthEarningsSnapshot.docs) {
        const earningsData = doc.data();
        const userId = earningsData.userId;
        const rawEarnings = earningsData.totalUsdCentsReceived || 0;
        if (rawEarnings > 0) {
          rawEarningsMap.set(userId, rawEarnings);
          totalRawWriterEarningsCents += rawEarnings;
        }
      }

      // Calculate global funding ratio to scale writer earnings to match funded allocations
      // This ensures Total Gross Earnings = Total Funded Allocations from subscriber table
      // Cap at 1.0 (never inflate, only reduce if raw > funded)
      const globalFundingRatio = totalRawWriterEarningsCents > 0
        ? Math.min(1, totalFundedAllocatedCents / totalRawWriterEarningsCents)
        : 1;

      console.log('[MONTHLY FINANCIALS] Writer earnings scaling:', {
        totalRawWriterEarningsCents,
        totalFundedAllocatedCents,
        globalFundingRatio,
        writerCount: rawEarningsMap.size
      });

      // Get user data for each writer
      const usersCollectionForWriters = await getCollectionNameAsync('users');

      for (const doc of currentMonthEarningsSnapshot.docs) {
        const earningsData = doc.data();
        const userId = earningsData.userId;

        // Get raw earnings and apply global funding ratio
        const rawEarningsCents = earningsData.totalUsdCentsReceived || 0;
        if (rawEarningsCents <= 0) continue;

        // Scale to funded amount using global ratio
        const fundedEarningsCents = Math.round(rawEarningsCents * globalFundingRatio);
        if (fundedEarningsCents <= 0) continue;

        // Calculate platform fee (7%) and net payout based on FUNDED earnings
        const platformFeeCents = Math.round(fundedEarningsCents * 0.07);
        const netPayoutCents = fundedEarningsCents - platformFeeCents;

        // Get user details
        let email = 'Unknown';
        let name = null;
        let stripeConnectedAccountId: string | null = null;

        try {
          const userDoc = await db.collection(usersCollectionForWriters).doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            email = userData?.email || 'Unknown';
            name = userData?.username || userData?.displayName || null;
            stripeConnectedAccountId = userData?.stripeConnectedAccountId || null;
          }
        } catch (err) {
          console.warn(`[MONTHLY FINANCIALS] Could not fetch user data for writer ${userId}:`, err);
        }

        // Determine bank account status
        let bankAccountStatus: WriterEarningsDetail['bankAccountStatus'] = 'not_setup';
        if (stripeConnectedAccountId) {
          // If they have a connected account, check its status via Stripe
          try {
            const connectedAccount = await stripe.accounts.retrieve(stripeConnectedAccountId);
            if (connectedAccount.payouts_enabled) {
              bankAccountStatus = 'verified';
            } else if (connectedAccount.requirements?.currently_due?.length) {
              bankAccountStatus = 'pending';
            } else if (connectedAccount.requirements?.disabled_reason) {
              bankAccountStatus = 'restricted';
            }
          } catch (stripeErr) {
            console.warn(`[MONTHLY FINANCIALS] Could not fetch Stripe account for ${stripeConnectedAccountId}:`, stripeErr);
            bankAccountStatus = 'pending';
          }
        }

        // For current month earnings: all are pending (not yet available for payout)
        // The earnings doc status tells us, but for current month it's always pending
        const earningsStatus = earningsData.status || 'pending';
        const pendingEarningsCents = earningsStatus === 'pending' ? fundedEarningsCents : 0;
        const availableEarningsCents = earningsStatus === 'available' ? fundedEarningsCents : 0;

        writerEarnings.push({
          userId,
          email,
          name,
          grossEarningsCents: fundedEarningsCents, // Only show FUNDED earnings (from active subscribers)
          platformFeeCents,
          netPayoutCents,
          pendingEarningsCents,
          availableEarningsCents,
          bankAccountStatus,
          stripeConnectedAccountId,
          canReceivePayout: bankAccountStatus === 'verified' && availableEarningsCents > 0
        });
      }

      // Sort by gross earnings descending
      writerEarnings.sort((a, b) => b.grossEarningsCents - a.grossEarningsCents);

    } catch (writerEarningsError) {
      console.error('[MONTHLY FINANCIALS] Error fetching writer earnings:', writerEarningsError);
    }

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
      writerEarnings,
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
