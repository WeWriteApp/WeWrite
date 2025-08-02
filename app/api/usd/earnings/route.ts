/**
 * USD Earnings API Endpoint
 * 
 * Handles USD earnings operations including payout requests
 * Replaces the token-based earnings endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { UsdEarningsService } from '../../../services/usdEarningsService';
import { centsToDollars } from '../../../utils/formatCurrency';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[USD Earnings API] Loading earnings data for user: ${userId}`);

    // Get complete USD earnings data
    const completeData = await UsdEarningsService.getCompleteWriterEarnings(userId);

    if (!completeData.balance) {
      return NextResponse.json({
        success: false,
        error: 'No USD earnings data found'
      }, { status: 404 });
    }

    // Format response data
    const responseData = {
      totalEarnings: centsToDollars(completeData.balance.totalUsdCentsEarned),
      availableBalance: centsToDollars(completeData.balance.availableUsdCents),
      pendingBalance: centsToDollars(completeData.balance.pendingUsdCents),
      paidOutBalance: centsToDollars(completeData.balance.paidOutUsdCents),
      lastProcessedMonth: completeData.balance.lastProcessedMonth,
      earningsHistory: completeData.earnings.map(earning => ({
        id: earning.id,
        month: earning.month,
        totalUsdAmount: centsToDollars(earning.totalUsdCentsReceived),
        status: earning.status,
        allocations: earning.allocations,
        processedAt: earning.processedAt,
        createdAt: earning.createdAt
      })),
      unfundedEarnings: completeData.unfunded ? {
        totalUnfundedUsdAmount: completeData.unfunded.totalUnfundedUsdAmount,
        loggedOutUsdAmount: completeData.unfunded.loggedOutUsdAmount,
        noSubscriptionUsdAmount: completeData.unfunded.noSubscriptionUsdAmount,
        message: completeData.unfunded.message,
        allocations: completeData.unfunded.allocations
      } : null,
      pendingAllocations: completeData.pendingAllocations ? {
        totalPendingUsdAmount: completeData.pendingAllocations.totalPendingUsdAmount,
        allocations: completeData.pendingAllocations.allocations,
        timeUntilDeadline: completeData.pendingAllocations.timeUntilDeadline
      } : null
    };

    return NextResponse.json({
      success: true,
      earnings: responseData
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
