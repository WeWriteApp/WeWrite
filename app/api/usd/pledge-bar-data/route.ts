import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { ServerUsdService } from '../../../services/usdService.server';
import { formatUsdCents } from '../../../utils/formatCurrency';
import { trackDatabaseRead } from '../../../utils/databaseReadTracker';

// 🚨 CRITICAL COST OPTIMIZATION: Aggressive caching for allocation bar data
const allocationBarDataCache = new Map<string, { data: any; timestamp: number }>();
const ALLOCATION_BAR_CACHE_TTL = 60 * 1000; // 1 minute cache (short for real-time feel)

/**
 * GET /api/usd/allocation-bar-data
 * Get essential data for USD allocation bar component
 * NOW WITH AGGRESSIVE CACHING TO PREVENT 9.2M READ OVERAGE
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

    // 🚨 CRITICAL: Check cache first to prevent massive read costs
    const cacheKey = `allocation-bar:${userId}:${pageId || recipientUserId}`;
    const cached = allocationBarDataCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < ALLOCATION_BAR_CACHE_TTL) {
      console.log(`🚀 COST OPTIMIZATION: Returning cached allocation bar data for ${pageId || recipientUserId}`);

      // Track cache hit
      trackDatabaseRead('/api/usd/allocation-bar-data', 0, 0, true);

      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
    }

    console.log(`🎯 USD Allocation Bar Data API: Getting data for user ${userId}:`, {
      pageId,
      recipientUserId
    });

    const startTime = Date.now();

    // Get essential data in parallel for speed
    const [balance, currentAllocation] = await Promise.all([
      ServerUsdService.getUserUsdBalance(userId),
      pageId
        ? ServerUsdService.getCurrentPageAllocation(userId, pageId)
        : recipientUserId
        ? ServerUsdService.getCurrentUserAllocation(userId, recipientUserId)
        : Promise.resolve(0)
    ]);

    // Track database reads (estimate 2-3 reads per request)
    const responseTime = Date.now() - startTime;
    trackDatabaseRead('/api/usd/allocation-bar-data', 3, responseTime, false);

    console.log(`🎯 USD Allocation Bar Data API: Retrieved data:`, {
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

    // 🚨 CRITICAL: Cache the response to prevent future reads
    allocationBarDataCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    // Clean cache periodically (every 100 requests)
    if (Math.random() < 0.01) {
      const now = Date.now();
      for (const [key, value] of allocationBarDataCache.entries()) {
        if (now - value.timestamp > ALLOCATION_BAR_CACHE_TTL * 2) {
          allocationBarDataCache.delete(key);
        }
      }
    }

    console.log(`🎯 USD Allocation Bar Data API: Returning response:`, {
      totalUsdCents,
      allocatedUsdCents,
      availableUsdCents,
      currentAllocation,
      hasSubscription: responseData.data.hasSubscription
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('USD Allocation Bar Data API: Error getting allocation bar data:', error);
    return NextResponse.json({
      error: 'Failed to get USD allocation bar data',
      details: error.message
    }, { status: 500 });
  }
}
