/**
 * API endpoint for writer token earnings
 * Handles getting earnings data and requesting payouts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { TokenEarningsService } from '../../../services/tokenEarningsService';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    const limit = parseInt(url.searchParams.get('limit') || '12');

    if (month) {
      // Get earnings for specific month
      const earnings = await TokenEarningsService.getWriterEarningsForMonth(userId, month);
      return NextResponse.json({
        success: true,
        data: earnings
      });
    } else {
      // Get complete writer data
      const [balance, earnings, payouts] = await Promise.all([
        TokenEarningsService.getWriterTokenBalance(userId),
        TokenEarningsService.getWriterEarningsHistory(userId, limit),
        TokenEarningsService.getPayoutHistory(userId, 10)
      ]);

      return NextResponse.json({
        success: true,
        data: {
          balance,
          earnings,
          payouts
        }
      });
    }

  } catch (error) {
    console.error('Error getting token earnings:', error);
    return NextResponse.json({
      error: 'Failed to get token earnings'
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
      // Request payout for available tokens
      const result = await TokenEarningsService.requestPayout(userId, amount);
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          data: {
            payoutId: result.payoutId
          },
          message: 'Payout requested successfully'
        });
      } else {
        return NextResponse.json({
          error: result.error
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Error processing token earnings request:', error);
    return NextResponse.json({
      error: 'Failed to process request'
    }, { status: 500 });
  }
}
