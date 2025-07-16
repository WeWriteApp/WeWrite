/**
 * User Earnings API Endpoint
 * 
 * Provides a unified view of user earnings including:
 * - Pending token allocations (current month)
 * - Available token balance (ready for payout)
 * - Historical earnings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { PendingTokenAllocationService } from '../../../services/pendingTokenAllocationService';
import { TokenEarningsService } from '../../../services/tokenEarningsService';
import { ServerTokenService } from '../../../services/tokenService.server';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pending allocations from new system
    const pendingData = await PendingTokenAllocationService.getRecipientPendingAllocations(userId);

    // Get pending allocations from old system (current token allocations)
    const oldSystemAllocations = await ServerTokenService.getAllocationsToUser(userId);

    // Get token balance (available for payout)
    const tokenBalance = await TokenEarningsService.getWriterTokenBalance(userId);

    // Calculate totals from both systems
    const newSystemPendingBalance = pendingData.totalPendingUsdValue || 0;
    const oldSystemPendingBalance = oldSystemAllocations.totalUsdValue || 0;
    const totalPendingBalance = newSystemPendingBalance + oldSystemPendingBalance;

    const availableBalance = tokenBalance?.availableUsdValue || 0;
    const totalEarnings = (tokenBalance?.totalUsdEarned || 0) + totalPendingBalance;

    const earnings = {
      totalEarnings,
      availableBalance,
      pendingBalance: totalPendingBalance,
      hasEarnings: totalEarnings > 0 || availableBalance > 0 || totalPendingBalance > 0,
      pendingAllocations: [
        ...(pendingData.allocations || []),
        ...(oldSystemAllocations.allocations || [])
      ],
      timeUntilDeadline: pendingData.timeUntilDeadline
    };

    return NextResponse.json({
      success: true,
      earnings
    });

  } catch (error) {
    console.error('Error getting user earnings:', error);

    // Handle permission errors gracefully - return empty data instead of failing
    if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
      console.log('[TokenEarningsService] Permission denied for token earnings, returning empty data (expected for non-writers)');
      return NextResponse.json({
        success: true,
        data: {
          balance: null,
          earnings: [],
          payouts: []
        }
      });
    }

    return NextResponse.json({
      error: 'Failed to get user earnings'
    }, { status: 500 });
  }
}
