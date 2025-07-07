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

    console.log(`🎯 Token Balance API: Getting balance for user ${userId}`);

    // Get token balance
    const balance = await ServerTokenService.getUserTokenBalance(userId);

    console.log(`🎯 Token Balance API: Retrieved balance:`, balance);

    if (!balance) {
      console.log(`🎯 Token Balance API: No balance found for user ${userId}`);
      return NextResponse.json({
        balance: null,
        allocations: [],
        message: 'No token balance found. Subscribe to start allocating tokens.'
      });
    }

    // CRITICAL FIX: Verify token balance matches current subscription
    let finalBalance = balance;
    try {
      const { getUserSubscriptionServer } = await import('../../../firebase/subscription-server');
      const subscription = await getUserSubscriptionServer(userId, { verbose: false });

      if (subscription && subscription.status === 'active') {
        const { calculateTokensForAmount } = await import('../../../utils/subscriptionTiers');
        const expectedTokens = calculateTokensForAmount(subscription.amount);

        // If token balance doesn't match subscription, sync it
        if (balance.totalTokens !== expectedTokens) {
          console.log('🎯 Token Balance API: MISMATCH DETECTED - Syncing token balance with subscription', {
            currentTokens: balance.totalTokens,
            expectedTokens,
            subscriptionAmount: subscription.amount,
            userSubscription: subscription
          });

          // Update the token balance to match subscription
          await ServerTokenService.updateMonthlyTokenAllocation(userId, subscription.amount);

          // Fetch the updated balance
          const updatedBalance = await ServerTokenService.getUserTokenBalance(userId);
          if (updatedBalance) {
            console.log('🎯 Token Balance API: Token balance synced successfully', {
              oldTokens: balance.totalTokens,
              newTokens: updatedBalance.totalTokens
            });
            finalBalance = updatedBalance;
          }
        } else {
          console.log('🎯 Token Balance API: Token balance matches subscription', {
            tokens: balance.totalTokens,
            subscriptionAmount: subscription.amount
          });
        }
      } else {
        console.log('🎯 Token Balance API: No active subscription found for sync check');
      }
    } catch (syncError) {
      console.error('🎯 Token Balance API: Error syncing token balance:', syncError);
      // Continue with existing balance if sync fails
    }

    // Get current allocations
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