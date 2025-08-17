/**
 * USD Earnings API Endpoint
 * 
 * Handles USD earnings operations including payout requests
 * Replaces the token-based earnings endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
// Use simple database queries instead of complex services
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { centsToDollars } from '../../../utils/formatCurrency';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[USD Earnings API] Loading simple earnings data for user: ${userId}`);

    // Get earnings data using simple database queries
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const db = admin.firestore();

    // Get balance data directly from database
    const balanceDoc = await db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES))
      .doc(userId)
      .get();

    const balance = balanceDoc.exists ? balanceDoc.data() : null;

    const completeData = {
      balance: balance ? {
        totalEarnings: balance.totalUsdCentsEarned ? balance.totalUsdCentsEarned / 100 : 0,
        availableBalance: balance.availableUsdCents ? balance.availableUsdCents / 100 : 0,
        pendingBalance: balance.pendingUsdCents ? balance.pendingUsdCents / 100 : 0,
        paidOutBalance: balance.paidOutUsdCents ? balance.paidOutUsdCents / 100 : 0
      } : null
    };

    if (!completeData.balance) {
      return NextResponse.json({
        success: false,
        error: 'No earnings data found'
      }, { status: 404 });
    }

    // Format response data using the actual balance data structure
    const responseData = {
      totalEarnings: completeData.balance.totalEarnings,
      availableBalance: completeData.balance.availableBalance,
      pendingBalance: completeData.balance.pendingBalance,
      paidOutBalance: completeData.balance.paidOutBalance,
      lastProcessedMonth: balance.lastProcessedMonth || null,
      hasEarnings: (completeData.balance.totalEarnings || 0) > 0,
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

      // Request payout using UsdEarningsService
      const result = await UsdEarningsService.requestPayout(userId, amountCents);

      if (result.success) {
        return NextResponse.json({
          success: true,
          data: {
            payoutId: result.data?.payoutId,
            amountCents: amountCents,
            amountDollars: amountCents ? centsToDollars(amountCents) : undefined
          },
          message: 'USD payout requested successfully'
        });
      } else {
        return NextResponse.json({
          error: result.error?.message || 'USD payout request failed',
          code: result.error?.code
        }, { status: 400 });
      }
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
