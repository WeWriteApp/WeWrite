/**
 * Token Balance API
 * 
 * Get user's token balance and allocation information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { TokenService } from '../../../services/tokenService';
import { ServerTokenService } from '../../../services/tokenService.server';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get token balance
    const balance = await ServerTokenService.getUserTokenBalance(userId);

    if (!balance) {
      return NextResponse.json({
        balance: null,
        allocations: [],
        message: 'No token balance found. Subscribe to start allocating tokens.'
      });
    }

    // Get current allocations
    const allocations = await ServerTokenService.getUserTokenAllocations(userId);

    return NextResponse.json({
      balance,
      allocations,
      summary: {
        totalTokens: balance.totalTokens,
        allocatedTokens: balance.allocatedTokens,
        availableTokens: balance.availableTokens,
        allocationCount: allocations.length
      }
    });

  } catch (error) {
    console.error('Error getting token balance:', error);
    return NextResponse.json(
      { error: 'Failed to get token balance' },
      { status: 500 }
    );
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
    const { action, subscriptionAmount } = body;

    if (action === 'initialize') {
      // Initialize token balance for user with active subscription
      if (!subscriptionAmount || subscriptionAmount <= 0) {
        return NextResponse.json({
          error: 'Valid subscription amount is required for initialization'
        }, { status: 400 });
      }

      // Initialize the token balance using server-side service with admin permissions
      await ServerTokenService.updateMonthlyTokenAllocation(userId, subscriptionAmount);

      // Get the newly created balance
      const balance = await ServerTokenService.getUserTokenBalance(userId);

      if (!balance) {
        return NextResponse.json({
          error: 'Failed to initialize token balance'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        balance,
        message: 'Token balance initialized successfully'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Supported actions: initialize' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in token balance POST:', error);
    return NextResponse.json(
      { error: 'Failed to process token balance request' },
      { status: 500 }
    );
  }
}