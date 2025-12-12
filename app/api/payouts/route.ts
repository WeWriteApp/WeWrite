/**
 * Main Payouts API Endpoint
 * 
 * Provides overview of user's payout status and recent payouts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { payoutRateLimiter } from '../../utils/rateLimiter';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import { PayoutService } from '../../services/payoutServiceUnified';
import { ServerUsdEarningsService } from '../../services/usdEarningsService.server';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apply rate limiting
    const rateLimitResult = await payoutRateLimiter.checkLimit(userId);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please wait before trying again.',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      }, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
        }
      });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    const db = admin.firestore();

    // Get user doc for connected account id
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    const userData = userDoc.data() || {};
    const stripeConnectedAccountId = userData.stripeConnectedAccountId || null;

    // Get balances calculated from earnings (Phase 2 - single source of truth)
    const balance = await ServerUsdEarningsService.getWriterUsdBalance(userId);
    const availableCents = balance?.availableUsdCents || 0;
    const totalEarnedCents = balance?.totalUsdCentsEarned || 0;

    // Get recent payouts from unified service
    const recentPayouts = await PayoutService.getPayoutHistory(userId);
    const summary = {
      availableBalance: availableCents / 100,
      pendingPayouts: recentPayouts.filter(p => p.status === 'pending').length,
      completedPayouts: recentPayouts.filter(p => p.status === 'completed').length,
      failedPayouts: recentPayouts.filter(p => p.status === 'failed').length,
      totalEarnings: totalEarnedCents / 100,
      lastPayoutDate: recentPayouts.find(p => p.status === 'completed')?.completedAt || null
    };

    return NextResponse.json({
      hasPayoutSetup: !!stripeConnectedAccountId,
      recipient: {
        id: userId,
        stripeConnectedAccountId,
        availableBalance: availableCents / 100,
        currency: 'usd'
      },
      summary,
      recentPayouts: recentPayouts.map(payout => ({
        id: payout.id,
        amount: payout.amountCents / 100,
        currency: 'usd',
        status: payout.status,
        createdAt: payout.requestedAt,
        completedAt: payout.completedAt,
        failureReason: payout.failureReason,
        stripePayoutId: payout.stripePayoutId
      }))
    });

  } catch (error) {
    console.error('Error getting payouts:', error);
    return NextResponse.json({
      error: 'Failed to get payouts'
    }, { status: 500 });
  }
}
