/**
 * Main Payouts API Endpoint
 * 
 * Provides overview of user's payout status and recent payouts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { payoutService } from '../../services/payoutService';
import { payoutRateLimiter } from '../../utils/rateLimiter';

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

    // Get payout recipient info
    const recipient = await payoutService.getPayoutRecipient(userId);
    
    if (!recipient) {
      return NextResponse.json({
        hasPayoutSetup: false,
        message: 'Payout setup required',
        setupUrl: '/api/payouts/setup'
      });
    }

    // Get recent payouts
    const recentPayouts = await payoutService.getRecentPayouts(userId, 10);

    // Get payout summary
    const summary = {
      availableBalance: recipient.availableBalance,
      pendingPayouts: recentPayouts.filter(p => p.status === 'pending' || p.status === 'processing').length,
      completedPayouts: recentPayouts.filter(p => p.status === 'completed').length,
      failedPayouts: recentPayouts.filter(p => p.status === 'failed').length,
      totalEarnings: recipient.totalEarnings || 0,
      lastPayoutDate: recentPayouts.find(p => p.status === 'completed')?.completedAt || null
    };

    return NextResponse.json({
      hasPayoutSetup: true,
      recipient: {
        id: recipient.id,
        stripeConnectedAccountId: recipient.stripeConnectedAccountId,
        accountStatus: recipient.accountStatus,
        availableBalance: recipient.availableBalance,
        currency: recipient.currency,
        payoutPreferences: recipient.payoutPreferences
      },
      summary,
      recentPayouts: recentPayouts.map(payout => ({
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        createdAt: payout.createdAt,
        completedAt: payout.completedAt,
        failureReason: payout.failureReason
      }))
    });

  } catch (error) {
    console.error('Error getting payouts:', error);
    return NextResponse.json({
      error: 'Failed to get payouts'
    }, { status: 500 });
  }
}
