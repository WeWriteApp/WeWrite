/**
 * Token Balance API
 * 
 * Get user's token balance and allocation information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { TokenService } from '../../../services/tokenService';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get token balance
    const balance = await TokenService.getUserTokenBalance(userId);
    
    if (!balance) {
      return NextResponse.json({
        balance: null,
        allocations: [],
        message: 'No token balance found. Subscribe to start allocating tokens.'
      });
    }

    // Get current allocations
    const allocations = await TokenService.getUserAllocations(userId);

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

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
