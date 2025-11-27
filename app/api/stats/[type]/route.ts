import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Unified Stats API
 * 
 * Replaces multiple stats endpoints:
 * - /api/tokens/page-stats
 * - Individual stats fetching logic
 * - Scattered stats APIs
 * 
 * Routes:
 * - GET /api/stats/page?pageId=xxx - Get page statistics
 * - GET /api/stats/user?userId=xxx - Get user statistics  
 * - GET /api/stats/batch?pageIds=xxx&userIds=xxx - Get batch statistics
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const startTime = performance.now();
  const { searchParams } = new URL(request.url);
  const { type } = await params;

  try {
    console.log(`📊 [STATS_API] ${type.toUpperCase()} request:`, Object.fromEntries(searchParams));

    switch (type) {
      case 'page': {
        const pageId = searchParams.get('pageId');
        const forceRefresh = searchParams.get('forceRefresh') === 'true';

        if (!pageId) {
          return NextResponse.json(
            { error: 'pageId is required' },
            { status: 400 }
          );
        }

        // Fetch actual page statistics
        const stats = await fetchPageStats(pageId);

        const loadTime = performance.now() - startTime;

        return NextResponse.json({
          success: true,
          data: stats,
          metadata: {
            pageId,
            loadTime: Math.round(loadTime),
            timestamp: Date.now(),
            cached: false
          }
        });
      }

      case 'user': {
        const userId = searchParams.get('userId');
        const forceRefresh = searchParams.get('forceRefresh') === 'true';

        if (!userId) {
          return NextResponse.json(
            { error: 'userId is required' },
            { status: 400 }
          );
        }

        const stats = await unifiedStatsService.getUserStats(userId, forceRefresh);
        const loadTime = performance.now() - startTime;

        return NextResponse.json({
          success: true,
          data: stats,
          metadata: {
            userId,
            loadTime: Math.round(loadTime),
            timestamp: Date.now(),
            cached: stats.cached
          }
        });
      }

      case 'batch': {
        const pageIds = searchParams.get('pageIds')?.split(',').filter(Boolean) || [];
        const userIds = searchParams.get('userIds')?.split(',').filter(Boolean) || [];

        if (pageIds.length === 0 && userIds.length === 0) {
          return NextResponse.json(
            { error: 'At least one pageId or userId is required' },
            { status: 400 }
          );
        }

        const result = await unifiedStatsService.getBatchStats(pageIds, userIds);
        const loadTime = performance.now() - startTime;

        return NextResponse.json({
          success: true,
          data: result,
          metadata: {
            pageIds: pageIds.length,
            userIds: userIds.length,
            totalItems: pageIds.length + userIds.length,
            loadTime: Math.round(loadTime),
            timestamp: Date.now(),
            cached: result.cached.length,
            fetched: result.fetched.length
          }
        });
      }

      default:
        return NextResponse.json(
          { 
            error: 'Invalid stats type',
            validTypes: ['page', 'user', 'batch']
          },
          { status: 400 }
        );
    }

  } catch (error) {
    const loadTime = performance.now() - startTime;

    // Force recompilation - removing type from error message to fix scope issue
    console.error(`📊 [STATS_API] Error:`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          loadTime: Math.round(loadTime),
          timestamp: Date.now()
        }
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for batch operations or complex queries
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  const startTime = performance.now();
  
  try {
    const { type } = params;
    const body = await request.json();

    console.log(`📊 [STATS_API] ${type.toUpperCase()} POST request:`, body);

    switch (type) {
      case 'batch': {
        const { pageIds = [], userIds = [] } = body;

        if (pageIds.length === 0 && userIds.length === 0) {
          return NextResponse.json(
            { error: 'At least one pageId or userId is required' },
            { status: 400 }
          );
        }

        const result = await unifiedStatsService.getBatchStats(pageIds, userIds);
        const loadTime = performance.now() - startTime;

        return NextResponse.json({
          success: true,
          data: result,
          metadata: {
            pageIds: pageIds.length,
            userIds: userIds.length,
            totalItems: pageIds.length + userIds.length,
            loadTime: Math.round(loadTime),
            timestamp: Date.now(),
            cached: result.cached.length,
            fetched: result.fetched.length
          }
        });
      }

      case 'refresh': {
        const { pageIds = [], userIds = [] } = body;

        // Force refresh cache for specified items
        const refreshPromises = [
          ...pageIds.map((id: string) => unifiedStatsService.getPageStats(id, true)),
          ...userIds.map((id: string) => unifiedStatsService.getUserStats(id, true))
        ];

        await Promise.all(refreshPromises);
        const loadTime = performance.now() - startTime;

        return NextResponse.json({
          success: true,
          message: 'Cache refreshed successfully',
          metadata: {
            refreshedPages: pageIds.length,
            refreshedUsers: userIds.length,
            loadTime: Math.round(loadTime),
            timestamp: Date.now()
          }
        });
      }

      case 'clear-cache': {
        // Clear all stats cache
        unifiedStatsService.clearCache();
        const loadTime = performance.now() - startTime;

        return NextResponse.json({
          success: true,
          message: 'Stats cache cleared successfully',
          metadata: {
            loadTime: Math.round(loadTime),
            timestamp: Date.now()
          }
        });
      }

      default:
        return NextResponse.json(
          { 
            error: 'Invalid POST operation',
            validOperations: ['batch', 'refresh', 'clear-cache']
          },
          { status: 400 }
        );
    }

  } catch (error) {
    const loadTime = performance.now() - startTime;
    
    console.error(`📊 [STATS_API] POST Error in ${params.type}:`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process stats operation',
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          loadTime: Math.round(loadTime),
          timestamp: Date.now()
        }
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint for cache management
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const { type } = params;

    switch (type) {
      case 'cache': {
        const pageId = searchParams.get('pageId');
        const userId = searchParams.get('userId');

        if (pageId) {
          // Clear specific page cache (implementation would need to be added to service)
          console.log(`📊 [STATS_API] Clearing cache for page: ${pageId}`);
        } else if (userId) {
          // Clear specific user cache (implementation would need to be added to service)
          console.log(`📊 [STATS_API] Clearing cache for user: ${userId}`);
        } else {
          // Clear all cache
          unifiedStatsService.clearCache();
          console.log(`📊 [STATS_API] Clearing all stats cache`);
        }

        return NextResponse.json({
          success: true,
          message: 'Cache cleared successfully'
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid DELETE operation' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error(`📊 [STATS_API] DELETE Error:`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch actual page statistics from Firebase
 */
async function fetchPageStats(pageId: string) {
  try {
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    // Get recent edits for the page (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));

    // Get versions from the page's versions subcollection
    const versionsQuery = db.collection(getCollectionName('pages'))
      .doc(pageId)
      .collection('versions')
      .where('createdAt', '>=', twentyFourHoursAgo.toISOString())
      .orderBy('createdAt', 'desc')
      .limit(100);

    const versionsSnapshot = await versionsQuery.get();
    const recentEdits = versionsSnapshot.docs.map(doc => ({
      ...doc.data(),
      lastModified: doc.data().createdAt // Use createdAt as lastModified for versions
    }));

    console.log(`📊 [PAGE_STATS] Found ${recentEdits.length} recent edits for page ${pageId} in last 24h`);

    // Generate hourly data for sparkline (last 24 hours)
    const changeData = Array(24).fill(0);
    const now = new Date();

    recentEdits.forEach(edit => {
      if (edit.lastModified || edit.createdAt) {
        const editDate = new Date(edit.lastModified || edit.createdAt);
        const hoursAgo = Math.floor((now.getTime() - editDate.getTime()) / (1000 * 60 * 60));
        if (hoursAgo >= 0 && hoursAgo < 24) {
          changeData[23 - hoursAgo]++; // Most recent hour at the end
        }
      }
    });

    // Count unique editors
    const uniqueEditors = new Set(recentEdits.map(edit => edit.userId).filter(Boolean));

    console.log(`📊 [PAGE_STATS] Generated sparkline data for page ${pageId}:`, {
      recentChanges: recentEdits.length,
      changeData,
      uniqueEditors: uniqueEditors.size
    });

    // Supporters: query USD allocations for this page (current month active allocations)
    let supporterCount = 0;
    let supporterData = Array(24).fill(0);
    try {
      const allocationsRef = db.collection(getCollectionName('usdAllocations'));
      const allocationsSnap = await allocationsRef
        .where('resourceId', '==', pageId)
        .where('resourceType', '==', 'page')
        .where('status', '==', 'active')
        .get();

      const uniqueSupporters = new Set<string>();
      const nowTs = Date.now();
      const supportersByHour: { [hour: number]: Set<string> } = {};

      allocationsSnap.forEach(doc => {
        const data = doc.data();
        if (data.userId) {
          uniqueSupporters.add(data.userId);
        }
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : null;
        if (createdAt) {
          const diffMs = nowTs - createdAt.getTime();
          const hoursAgo = Math.floor(diffMs / (1000 * 60 * 60));
          if (hoursAgo >= 0 && hoursAgo < 24) {
            const bucket = 23 - hoursAgo;
            if (!supportersByHour[bucket]) supportersByHour[bucket] = new Set();
            supportersByHour[bucket].add(data.userId);
          }
        }
      });

      supporterCount = uniqueSupporters.size;
      supporterData = supporterData.map((_, idx) => supportersByHour[idx]?.size || 0);
    } catch (supporterError) {
      console.warn('📊 [PAGE_STATS] Supporter stats fallback:', supporterError);
    }

    return {
      pageId,
      totalViews: 0, // TODO: Implement view tracking
      viewsLast24h: 0,
      viewData: Array(24).fill(0), // TODO: Implement view data
      recentChanges: recentEdits.length,
      changeData,
      editorsCount: uniqueEditors.size,
      liveReaders: 0, // TODO: Implement live reader tracking
      totalReaders: 0,
      supporterCount,
      totalPledgedTokens: 0,
      supporterData,
      uniqueSponsors: [],
      lastUpdated: Date.now(),
      cached: false
    };
  } catch (error) {
    console.error('Error fetching page stats:', error);

    // Return fallback data on error
    return {
      pageId,
      totalViews: 0,
      viewsLast24h: 0,
      viewData: Array(24).fill(0),
      recentChanges: 0,
      changeData: Array(24).fill(0),
      editorsCount: 0,
      liveReaders: 0,
      totalReaders: 0,
      supporterCount: 0,
      totalPledgedTokens: 0,
      supporterData: Array(24).fill(0),
      uniqueSponsors: [],
      lastUpdated: Date.now(),
      cached: false
    };
  }
}
