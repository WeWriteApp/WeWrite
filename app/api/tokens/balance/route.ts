/**
 * Token Balance API
 *
 * DEPRECATED: This API is being migrated to USD-based system
 * Use /api/usd/balance for new implementations
 *
 * Get user's token balance and allocation information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { TokenService } from '../../../services/tokenService';
import { ServerTokenService } from '../../../services/tokenService.server';
import { ServerUsdService } from '../../../services/usdService.server';
import { centsToDollars, migrateTokensToUsdCents } from '../../../utils/formatCurrency';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🎯 Token Balance API: Getting balance for user ${userId}`);

    // Get token balance (fast path - no heavy operations)
    const balance = await ServerTokenService.getUserTokenBalance(userId);

    console.log(`🎯 Token Balance API: Retrieved balance:`, balance);

    if (!balance) {
      console.log(`🎯 Token Balance API: No balance found for user ${userId}`);

      // Fast path: Return empty balance instead of heavy auto-initialization
      return NextResponse.json({
        balance: null,
        allocations: [],
        summary: {
          totalTokens: 0,
          allocatedTokens: 0,
          availableTokens: 0,
          allocationCount: 0
        },
        message: 'No token balance found. Subscribe to start allocating tokens.'
      });
    }

    // Fast path: Use existing balance without heavy sync operations
    let finalBalance = balance;

    // Get current allocations (fast path - only essential data)
    const allocations = await ServerTokenService.getUserTokenAllocations(userId);

    const response = {
      balance: finalBalance,
      allocations,
      summary: {
        totalTokens: finalBalance.totalTokens,
        allocatedTokens: finalBalance.allocatedTokens,
        availableTokens: finalBalance.availableTokens,
        allocationCount: allocations.length
      }
    };

    console.log(`🎯 Token Balance API: Returning response:`, {
      totalTokens: finalBalance.totalTokens,
      allocatedTokens: finalBalance.allocatedTokens,
      availableTokens: finalBalance.availableTokens,
      allocationCount: allocations.length
    });

    return NextResponse.json(response);

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

/**
 * Helper function to get token balance from USD system (for migration)
 */
async function getTokenBalanceFromUsdSystem(userId: string) {
  try {
    const usdBalance = await ServerUsdService.getUserUsdBalance(userId);
    if (!usdBalance) {
      return null;
    }

    // Convert USD cents to token equivalents for backward compatibility
    const totalTokens = Math.floor(centsToDollars(usdBalance.totalUsdCents) * 10);
    const allocatedTokens = Math.floor(centsToDollars(usdBalance.allocatedUsdCents) * 10);
    const availableTokens = Math.floor(centsToDollars(usdBalance.availableUsdCents) * 10);

    const allocations = await ServerUsdService.getUserUsdAllocations(userId);
    const tokenAllocations = allocations.map(allocation => ({
      ...allocation,
      tokens: Math.floor(centsToDollars(allocation.usdCents) * 10),
      usdValue: centsToDollars(allocation.usdCents)
    }));

    return {
      balance: {
        userId: usdBalance.userId,
        totalTokens,
        allocatedTokens,
        availableTokens,
        monthlyAllocation: Math.floor(centsToDollars(usdBalance.monthlyAllocationCents) * 10),
        lastAllocationDate: usdBalance.lastAllocationDate,
        createdAt: usdBalance.createdAt,
        updatedAt: usdBalance.updatedAt
      },
      allocations: tokenAllocations,
      summary: {
        totalTokens,
        allocatedTokens,
        availableTokens,
        allocationCount: allocations.length
      }
    };
  } catch (error) {
    console.error('Error getting token balance from USD system:', error);
    return null;
  }
}