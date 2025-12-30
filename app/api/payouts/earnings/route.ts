/**
 * API endpoint for getting user earnings and payout history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { PayoutService } from '../../../services/payoutService';
import { UsdEarningsService } from '../../../services/usdEarningsService';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { db } from '../../../firebase/config';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { TransactionTrackingService } from '../../../services/transactionTrackingService';
import { FinancialUtils } from '../../../types/financial';
import { getCollectionName, USD_COLLECTIONS } from "../../../utils/environmentConfig";
import { getMinimumPayoutThreshold } from '../../../utils/feeCalculations';
import { payoutRateLimiter } from '../../../utils/rateLimiter';
import { FeeConfigurationService } from '../../../services/feeConfigurationService';
import { centsToDollars } from '../../../utils/formatCurrency';

// Fee calculation function using centralized fee service
async function calculatePayoutFees(grossAmount: number, payoutMethod: 'standard' | 'instant' = 'standard') {
  try {
    // Use centralized fee calculation service
    const result = await FeeConfigurationService.calculatePayoutFees(grossAmount, payoutMethod);

    return {
      grossAmount: result.grossAmount,
      stripeFee: result.stripeConnectFee,
      stripeFeeFixed: result.stripePayoutFee,
      platformFee: result.platformFee,
      totalFees: result.totalFees,
      netAmount: result.netAmount
    };
  } catch (error) {
    console.error('Error calculating fees with centralized service, using fallback:', error);

    // Fallback to basic calculation
    const stripeFee = grossAmount * 0.0025; // 0.25% Stripe Connect fee
    const stripeFeeFixed = payoutMethod === 'instant' ? 0.50 : 0.00;
    const platformFee = 0; // 0% platform fee
    const totalFees = stripeFee + stripeFeeFixed + platformFee;
    const netAmount = Math.max(0, grossAmount - totalFees);

    return {
      grossAmount,
      stripeFee,
      stripeFeeFixed,
      platformFee,
      totalFees,
      netAmount
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const type = searchParams.get('type'); // 'earnings' or 'payouts'

    const recipientId = `recipient_${userId}`;

    // Get USD earnings data using UsdEarningsService
    const balance = await UsdEarningsService.getWriterUsdBalance(userId);
    const earningsHistory = await UsdEarningsService.getWriterEarningsHistory(userId, 6);
    const completeUsdData = {
      balance,
      earnings: earningsHistory,
      unfunded: null,
      pendingAllocations: null
    };

    let earnings = [];
    let payouts = [];

    if (!type || type === 'earnings') {
      // Convert USD earnings to the expected format
      earnings = completeUsdData.earnings.map(earning => ({
        id: earning.id,
        amount: centsToDollars(earning.totalUsdCentsReceived),
        source: 'USD Allocation',
        date: earning.createdAt,
        type: 'usd',
        status: earning.status,
        pageId: earning.allocations?.[0]?.resourceId,
        pageTitle: 'USD Earnings',
        month: earning.month,
        allocations: earning.allocations
      }));
    }

    if (!type || type === 'payouts') {
      // Get USD payouts using Admin SDK
      const admin = getFirebaseAdmin();
      if (admin) {
        const adminDb = admin.firestore();
        const payoutsQuery = adminDb.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
          .where('userId', '==', userId)
          .orderBy('requestedAt', 'desc')
          .limit(10);

        const payoutsSnapshot = await payoutsQuery.get();
        const usdPayouts = payoutsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        payouts = await Promise.all(usdPayouts.map(async (payout: any) => {
          const feeBreakdown = await calculatePayoutFees(centsToDollars(payout.amountCents));

          return {
            id: payout.id,
            amount: centsToDollars(payout.amountCents),
            currency: payout.currency,
            status: payout.status,
            period: payout.month,
            scheduledAt: payout.requestedAt,
            processedAt: payout.processedAt?.toDate?.()?.toISOString() || payout.processedAt,
            completedAt: payout.completedAt?.toDate?.()?.toISOString() || payout.completedAt,
            failureReason: payout.failureReason,
            retryCount: payout.retryCount || 0,
            feeBreakdown
          };
        }));
      }
    }

    // Create USD earnings breakdown
    const usdBreakdown = completeUsdData.balance ? {
      totalEarnings: centsToDollars(completeUsdData.balance.totalUsdCentsEarned),
      availableBalance: centsToDollars(completeUsdData.balance.availableUsdCents),
      pendingBalance: centsToDollars(completeUsdData.balance.pendingUsdCents),
      paidOutBalance: centsToDollars(completeUsdData.balance.paidOutUsdCents),
      currency: 'usd',
      lastProcessedMonth: completeUsdData.balance.lastProcessedMonth
    } : null;

    return NextResponse.json({
      success: true,
      data: {
        breakdown: usdBreakdown,
        earnings,
        payouts,
        pagination: {
          page,
          pageSize,
          hasMore: earnings.length === pageSize || payouts.length === pageSize
        }
      }
    });

  } catch (error) {
    console.error('Error getting earnings:', error);
    return NextResponse.json({
      error: 'Failed to get earnings'
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

    // Apply rate limiting for payout requests
    const rateLimitResult = await payoutRateLimiter.checkLimit(userId);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: `Too many payout requests. You can make ${rateLimitResult.remaining} more requests. Try again after ${new Date(rateLimitResult.resetTime).toISOString()}`,
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
        }
      });
    }

    const body = await request.json();
    const { action, period } = body;

    if (action === 'request_payout') {
      // Use unified PayoutService for payout request
      const result = await PayoutService.requestPayout(userId);

      if (result.success) {
        return NextResponse.json({
          success: true,
          data: {
            payoutId: result.payoutId,
            message: 'Payout requested successfully'
          }
        });
      } else {
        return NextResponse.json({
          error: result.error || 'Payout request failed'
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Error processing earnings request:', error);
    return NextResponse.json({
      error: 'Failed to process request'
    }, { status: 500 });
  }
}
