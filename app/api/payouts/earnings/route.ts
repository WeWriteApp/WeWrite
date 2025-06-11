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
  setDoc
} from 'firebase/firestore';

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
      const payoutsQuery = query(
        collection(db, 'payouts'),
        where('recipientId', '==', recipientId),
        orderBy('scheduledAt', 'desc'),
        limit(pageSize)
      );

      const payoutsSnapshot = await getDocs(payoutsQuery);
      payouts = payoutsSnapshot.docs.map(payoutDoc => {
        const payout = payoutDoc.data();
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
          retryCount: payout.retryCount || 0
        };
      });
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

      if (recipient.availableBalance < recipient.payoutPreferences.minimumThreshold) {
        return NextResponse.json({
          error: `Minimum payout threshold is $${recipient.payoutPreferences.minimumThreshold}`
        }, { status: 400 });
      }

      // Create manual payout
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
        scheduledAt: new Date(),
        retryCount: 0
      };

      await setDoc(doc(db, 'payouts', payoutId), payout);

      return NextResponse.json({
        success: true,
        data: payout,
        message: 'Payout requested successfully'
      });
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
