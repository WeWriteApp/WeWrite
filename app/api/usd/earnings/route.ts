/**
 * USD Earnings API Endpoint
 *
 * Handles USD earnings operations including payout requests
 * Replaces the token-based earnings endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { centsToDollars } from '../../../utils/formatCurrency';
import { UsdEarningsService } from '../../../services/usdEarningsService';
import { getMinimumPayoutThreshold } from '../../../utils/feeCalculations';
import type { UsdPayout } from '../../../types/database';

/**
 * Calculate funded pending allocations for current month
 * This shows what the user will earn from current month allocations
 * after applying funding ratios for over-allocated sponsors
 */
async function calculateFundedPendingAllocations(userId: string): Promise<number> {
  const admin = getFirebaseAdmin();
  if (!admin) return 0;

  const db = admin.firestore();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

  const allocationsQuery = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS))
    .where('recipientUserId', '==', userId)
    .where('month', '==', currentMonth)
    .where('status', '==', 'active');

  const allocationsSnapshot = await allocationsQuery.get();
  let totalFundedPendingCents = 0;

  for (const doc of allocationsSnapshot.docs) {
    const allocation = doc.data();
    let allocationCents = allocation.usdCents || 0;

    // Check sponsor's funding status
    try {
      const sponsorBalanceDoc = await db.collection(getCollectionName(USD_COLLECTIONS.USD_BALANCES))
        .doc(allocation.userId)
        .get();

      if (sponsorBalanceDoc.exists) {
        const sponsorBalance = sponsorBalanceDoc.data();
        const sponsorSubscriptionCents = sponsorBalance?.totalUsdCents || 0;
        const sponsorAllocatedCents = sponsorBalance?.allocatedUsdCents || 0;

        // Calculate funded portion if sponsor is over-allocated
        if (sponsorAllocatedCents > sponsorSubscriptionCents && sponsorAllocatedCents > 0) {
          const fundingRatio = sponsorSubscriptionCents / sponsorAllocatedCents;
          allocationCents = Math.round(allocationCents * fundingRatio);
        }
      }
    } catch (error) {
      // If we can't check sponsor balance, use the full allocation (fail open)
      console.warn(`[USD Earnings API] Error checking sponsor balance for ${allocation.userId}:`, error);
    }

    totalFundedPendingCents += allocationCents;
  }

  return totalFundedPendingCents;
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[USD Earnings API] Loading earnings data for user: ${userId}`);

    // Use UsdEarningsService to get balance (single source of truth)
    const balance = await UsdEarningsService.getWriterUsdBalance(userId);

    // Calculate funded pending from current month allocations
    const totalFundedPendingCents = await calculateFundedPendingAllocations(userId);

    // Format response data
    const responseData = {
      totalEarnings: balance ? balance.totalUsdCentsEarned / 100 : 0,
      availableBalance: balance ? balance.availableUsdCents / 100 : 0,
      pendingBalance: totalFundedPendingCents / 100,
      paidOutBalance: balance ? balance.paidOutUsdCents / 100 : 0,
      lastProcessedMonth: balance?.lastProcessedMonth || null,
      hasEarnings: balance ? balance.totalUsdCentsEarned > 0 : false,
      // For now, return empty arrays for history data - these would need separate queries
      earningsHistory: [],
      pendingAllocations: null,
      payoutHistory: []
    };

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error: any) {
    console.error('[USD Earnings API] Error loading earnings data:', error);
    return NextResponse.json({
      error: 'Failed to load USD earnings data',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, amount } = body;

    if (action === 'request_payout') {
      console.log(`[USD Earnings API] Processing payout request for user: ${userId}`);

      // Convert amount to cents if provided, otherwise use all available
      let amountCents: number | undefined;
      if (amount !== undefined) {
        amountCents = Math.round(amount * 100);
      }

      // Get writer balance to validate payout request
      const balance = await UsdEarningsService.getWriterUsdBalance(userId);
      if (!balance) {
        return NextResponse.json({
          error: 'No USD balance found for user'
        }, { status: 404 });
      }

      const requestedAmountCents = amountCents || balance.availableUsdCents;
      const requestedAmountDollars = centsToDollars(requestedAmountCents);

      // Validate payout request
      if (requestedAmountCents > balance.availableUsdCents) {
        return NextResponse.json({
          error: 'Insufficient available USD for payout',
          details: {
            requestedAmountCents,
            availableUsdCents: balance.availableUsdCents
          }
        }, { status: 400 });
      }

      const minimumThreshold = getMinimumPayoutThreshold();
      if (requestedAmountDollars < minimumThreshold) {
        return NextResponse.json({
          error: `Payout amount below minimum threshold of $${minimumThreshold}`,
          details: {
            requestedAmountDollars,
            minimumThreshold
          }
        }, { status: 400 });
      }

      // Create payout request using Admin SDK
      const admin = getFirebaseAdmin();
      if (!admin) {
        return NextResponse.json({
          error: 'Database not available'
        }, { status: 500 });
      }

      const db = admin.firestore();
      const payoutId = `usd_payout_${userId}_${Date.now()}`;

      const payout: Omit<UsdPayout, 'id'> = {
        userId,
        amountCents: requestedAmountCents,
        currency: 'usd',
        status: 'pending',
        earningsIds: [], // Would need to fetch relevant earnings
        requestedAt: new Date(),
        minimumThresholdMet: requestedAmountDollars >= minimumThreshold
      };

      await db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).doc(payoutId).set({
        id: payoutId,
        ...payout
      });

      return NextResponse.json({
        success: true,
        data: {
          payoutId: payoutId,
          amountCents: requestedAmountCents,
          amountDollars: requestedAmountDollars
        },
        message: 'USD payout requested successfully'
      });
    }

    return NextResponse.json({
      error: 'Invalid action. Supported actions: request_payout'
    }, { status: 400 });

  } catch (error: any) {
    console.error('[USD Earnings API] Error processing request:', error);
    return NextResponse.json({
      error: 'Failed to process USD earnings request',
      details: error.message
    }, { status: 500 });
  }
}
