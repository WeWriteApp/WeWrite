import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { ServerUsdService } from '../../../services/usdService.server';
import { formatUsdCents } from '../../../utils/formatCurrency';

/**
 * GET /api/usd/pledge-bar-data
 * Get essential data for USD pledge bar component
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const recipientUserId = searchParams.get('recipientUserId');

    if (!pageId && !recipientUserId) {
      return NextResponse.json({ 
        error: 'Either pageId or recipientUserId is required' 
      }, { status: 400 });
    }

    console.log(`🎯 USD Pledge Bar Data API: Getting data for user ${userId}:`, {
      pageId,
      recipientUserId
    });

    // Get essential data in parallel for speed
    const [balance, currentAllocation] = await Promise.all([
      ServerUsdService.getUserUsdBalance(userId),
      pageId 
        ? ServerUsdService.getCurrentPageAllocation(userId, pageId)
        : recipientUserId
        ? ServerUsdService.getCurrentUserAllocation(userId, recipientUserId)
        : Promise.resolve(0)
    ]);

    console.log(`🎯 USD Pledge Bar Data API: Retrieved data:`, {
      pageId,
      recipientUserId,
      currentAllocation,
      hasBalance: !!balance
    });

    // Calculate basic USD info
    const totalUsdCents = balance?.totalUsdCents || 0;
    const allocatedUsdCents = balance?.allocatedUsdCents || 0;
    const availableUsdCents = totalUsdCents - allocatedUsdCents;

    const responseData = {
      success: true,
      data: {
        usdBalance: {
          totalUsdCents,
          allocatedUsdCents,
          availableUsdCents,
          totalFormatted: formatUsdCents(totalUsdCents),
          allocatedFormatted: formatUsdCents(allocatedUsdCents),
          availableFormatted: formatUsdCents(availableUsdCents),
          lastUpdated: balance?.updatedAt || new Date()
        },
        currentAllocation,
        currentAllocationFormatted: formatUsdCents(currentAllocation),
        hasSubscription: !!balance && totalUsdCents > 0,
        resourceType: pageId ? 'page' : 'user',
        resourceId: pageId || recipientUserId
      }
    };

    console.log(`🎯 USD Pledge Bar Data API: Returning response:`, {
      totalUsdCents,
      allocatedUsdCents,
      availableUsdCents,
      currentAllocation,
      hasSubscription: responseData.data.hasSubscription
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('USD Pledge Bar Data API: Error getting pledge bar data:', error);
    return NextResponse.json({
      error: 'Failed to get USD pledge bar data',
      details: error.message
    }, { status: 500 });
  }
}
