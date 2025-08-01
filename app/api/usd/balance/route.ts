import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { ServerUsdService } from '../../../services/usdService.server';

/**
 * GET /api/usd/balance
 * Get user's current USD balance and allocation summary
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🎯 USD Balance API: Getting balance for user ${userId}`);

    // Get USD balance (fast path - no heavy operations)
    const balance = await ServerUsdService.getUserUsdBalance(userId);

    console.log(`🎯 USD Balance API: Retrieved balance:`, balance);

    if (!balance) {
      console.log(`🎯 USD Balance API: No balance found for user ${userId}`);

      // Fast path: Return empty balance instead of heavy auto-initialization
      return NextResponse.json({
        balance: null,
        allocations: [],
        summary: {
          totalUsdCents: 0,
          allocatedUsdCents: 0,
          availableUsdCents: 0,
          allocationCount: 0
        },
        message: 'No USD balance found. Subscribe to start allocating funds.'
      });
    }

    // Fast path: Use existing balance without heavy sync operations
    let finalBalance = balance;

    // Get current allocations (fast path - only essential data)
    const allocations = await ServerUsdService.getUserUsdAllocations(userId);

    const response = {
      balance: finalBalance,
      allocations,
      summary: {
        totalUsdCents: finalBalance.totalUsdCents,
        allocatedUsdCents: finalBalance.allocatedUsdCents,
        availableUsdCents: finalBalance.availableUsdCents,
        allocationCount: allocations.length
      }
    };

    console.log(`🎯 USD Balance API: Returning response:`, {
      totalUsdCents: finalBalance.totalUsdCents,
      allocatedUsdCents: finalBalance.allocatedUsdCents,
      availableUsdCents: finalBalance.availableUsdCents,
      allocationCount: allocations.length
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('USD Balance API: Error getting balance:', error);
    return NextResponse.json({
      error: 'Failed to get USD balance'
    }, { status: 500 });
  }
}

/**
 * POST /api/usd/balance
 * Initialize or update user's USD balance
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, subscriptionAmount } = body;

    console.log(`🎯 USD Balance API: POST request for user ${userId}:`, { action, subscriptionAmount });

    if (action === 'initialize') {
      // Initialize USD balance for user with active subscription
      if (!subscriptionAmount || subscriptionAmount <= 0) {
        return NextResponse.json({
          error: 'Valid subscription amount is required for initialization'
        }, { status: 400 });
      }

      // Initialize the USD balance using server-side service with admin permissions
      await ServerUsdService.updateMonthlyUsdAllocation(userId, subscriptionAmount);

      // Get the newly created balance
      const balance = await ServerUsdService.getUserUsdBalance(userId);

      if (!balance) {
        return NextResponse.json({
          error: 'Failed to initialize USD balance'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        balance,
        message: 'USD balance initialized successfully'
      });
    }

    return NextResponse.json({
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('USD Balance API: Error in POST:', error);
    return NextResponse.json({
      error: 'Failed to process USD balance request'
    }, { status: 500 });
  }
}
