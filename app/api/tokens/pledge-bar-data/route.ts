/**
 * Fast PledgeBar Data API
 * 
 * Optimized endpoint specifically for PledgeBar component that returns
 * only the essential data needed for fast loading.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { ServerTokenService } from '../../../services/tokenService.server';
import { PendingTokenAllocationService } from '../../../services/pendingTokenAllocationService';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json({ 
        error: 'Page ID is required' 
      }, { status: 400 });
    }

    // Get essential data in parallel for speed
    const [balance, currentAllocation] = await Promise.all([
      ServerTokenService.getUserTokenBalance(userId),
      PendingTokenAllocationService.getCurrentPageAllocation(userId, pageId)
    ]);

    // Calculate basic token info
    const totalTokens = balance?.totalTokens || 0;
    const allocatedTokens = balance?.allocatedTokens || 0;
    const availableTokens = totalTokens - allocatedTokens;

    return NextResponse.json({
      success: true,
      data: {
        tokenBalance: {
          totalTokens,
          allocatedTokens,
          availableTokens,
          lastUpdated: balance?.updatedAt || new Date()
        },
        currentPageAllocation: currentAllocation,
        hasSubscription: !!balance && totalTokens > 0
      }
    });

  } catch (error) {
    console.error('Error getting pledge bar data:', error);
    return NextResponse.json(
      { error: 'Failed to get pledge bar data' },
      { status: 500 }
    );
  }
}
