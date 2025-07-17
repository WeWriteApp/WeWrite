/**
 * API endpoint for getting user earnings and payout history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { payoutService } from '../../../services/payoutService';
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
import { StripePayoutService } from '../../../services/stripePayoutService';
import { TransactionTrackingService } from '../../../services/transactionTrackingService';
import { FinancialUtils } from '../../../types/financial';
import { getCollectionName } from "../../../utils/environmentConfig";
import { getMinimumPayoutThreshold } from '../../../utils/feeCalculations';
import { payoutRateLimiter } from '../../../utils/rateLimiter';
import { FeeConfigurationService } from '../../../services/feeConfigurationService';

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

    // Get earnings breakdown
    const earningsBreakdown = await payoutService.getEarningsBreakdown(userId);

    let earnings = [];
    let payouts = [];

    if (!type || type === 'earnings') {
      // Get recent earnings
      const earningsQuery = query(
        collection(db, 'earnings'),
        where('recipientId', '==', recipientId),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

      const earningsSnapshot = await getDocs(earningsQuery);
      earnings = await Promise.all(
        earningsSnapshot.docs.map(async (earningDoc) => {
          const earning = earningDoc.data();
          
          // Get page/group details
          let resourceTitle = 'Unknown';
          try {
            const resourceDoc = await getDoc(doc(db, earning.resourceType === 'page' ? 'pages' : 'groups', earning.resourceId));
            if (resourceDoc.exists()) {
              const resourceData = resourceDoc.data();
              resourceTitle = resourceData.title || resourceData.name || 'Untitled';
            }
          } catch (error) {
            console.error('Error fetching resource details:', error);
          }

          return {
            id: earning.id,
            amount: earning.amount,
            netAmount: earning.netAmount,
            platformFee: earning.platformFee,
            sourceType: earning.sourceType,
            resourceType: earning.resourceType,
            resourceTitle,
            period: earning.period,
            status: earning.status,
            createdAt: earning.createdAt?.toDate?.()?.toISOString() || earning.createdAt,
            metadata: earning.metadata
          };
        })
      );
    }

    if (!type || type === 'payouts') {
      // Get recent payouts
      const payoutsQuery = db.collection(getCollectionName('payouts'))
        .where('recipientId', '==', recipientId)
        .orderBy('scheduledAt', 'desc')
        .limit(pageSize);

      const payoutsSnapshot = await getDocs(payoutsQuery);
      payouts = await Promise.all(payoutsSnapshot.docs.map(async (payoutDoc) => {
        const payout = payoutDoc.data();
        const feeBreakdown = await calculatePayoutFees(payout.amount);

        return {
          id: payout.id,
          amount: payout.amount,
          currency: payout.currency,
          status: payout.status,
          period: payout.period,
          scheduledAt: payout.scheduledAt?.toDate?.()?.toISOString() || payout.scheduledAt,
          processedAt: payout.processedAt?.toDate?.()?.toISOString() || payout.processedAt,
          completedAt: payout.completedAt?.toDate?.()?.toISOString() || payout.completedAt,
          failureReason: payout.failureReason,
          retryCount: payout.retryCount || 0,
          feeBreakdown
        };
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        breakdown: earningsBreakdown,
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
      // Manual payout request
      const recipient = await payoutService.getPayoutRecipient(userId);
      
      if (!recipient) {
        return NextResponse.json({
          error: 'Payout recipient not found'
        }, { status: 404 });
      }

      // Use the higher of system minimum or user preference
      const systemMinimum = getMinimumPayoutThreshold();
      const userMinimum = recipient.payoutPreferences.minimumThreshold;
      const effectiveMinimum = Math.max(systemMinimum, userMinimum);

      if (recipient.availableBalance < effectiveMinimum) {
        return NextResponse.json({
          error: `Minimum payout threshold is $${effectiveMinimum} (system minimum: $${systemMinimum}, your preference: $${userMinimum})`
        }, { status: 400 });
      }

      // Create manual payout with proper tracking
      const correlationId = FinancialUtils.generateCorrelationId();
      const payoutId = `payout_${userId}_${Date.now()}`;
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

      const payout = {
        id: payoutId,
        recipientId: `recipient_${userId}`,
        amount: recipient.availableBalance,
        currency: recipient.payoutPreferences.currency,
        status: 'pending',
        earningIds: [], // Would need to fetch relevant earnings
        period: period || currentPeriod,
        scheduledAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        retryCount: 0,
        metadata: {
          source: 'manual_request',
          correlationId,
          requestedBy: userId
        }
      };

await setDoc(doc(db, getCollectionName("payouts"), payoutId), payout);

      // Track the payout request
      const trackingResult = await TransactionTrackingService.trackPayoutRequest(
        payoutId,
        `recipient_${userId}`,
        recipient.availableBalance,
        undefined,
        correlationId
      );

      if (!trackingResult.success) {
        console.error('Failed to track payout request:', trackingResult.error);
        // Continue processing but log the error
      }

      // Process the payout through Stripe immediately for manual requests
      try {
        const stripePayoutService = StripePayoutService.getInstance();
        const stripeResult = await stripePayoutService.processPayout(payoutId);

        if (stripeResult.success) {
          const feeBreakdown = await calculatePayoutFees(payout.amount);

          return NextResponse.json({
            success: true,
            data: {
              ...payout,
              status: 'processing',
              stripeTransferId: stripeResult.data?.id,
              feeBreakdown
            },
            message: 'Payout initiated and processing through Stripe',
            correlationId
          });
        } else {
          // Payout failed, but record was created for retry
          const feeBreakdown = await calculatePayoutFees(payout.amount);

          return NextResponse.json({
            success: false,
            error: stripeResult.error,
            data: {
              ...payout,
              feeBreakdown
            },
            message: 'Payout request created but Stripe processing failed. Will retry automatically.',
            correlationId
          }, { status: 202 }); // Accepted but not processed
        }
      } catch (stripeError: any) {
        console.error('Error processing payout through Stripe:', stripeError);

        return NextResponse.json({
          success: false,
          error: 'Failed to process payout through Stripe',
          data: payout,
          message: 'Payout request created but processing failed. Will retry automatically.',
          correlationId,
          details: stripeError.message
        }, { status: 202 }); // Accepted but not processed
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