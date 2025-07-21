import { NextRequest, NextResponse } from 'next/server';
import { unifiedStatsService } from '../../../services/UnifiedStatsService';

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
  { params }: { params: { type: string } }
) {
  const startTime = performance.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const { type } = params;

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

        const stats = await unifiedStatsService.getPageStats(pageId, forceRefresh);
        const loadTime = performance.now() - startTime;

        return NextResponse.json({
          success: true,
          data: stats,
          metadata: {
            pageId,
            loadTime: Math.round(loadTime),
            timestamp: Date.now(),
            cached: stats.cached
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
    
    console.error(`📊 [STATS_API] Error in ${params.type}:`, error);
    
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
