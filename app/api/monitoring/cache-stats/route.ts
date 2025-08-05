import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { pageCache } from '../../../utils/pageCache';

/**
 * Cache Statistics API
 * 
 * Provides real-time insights into cache performance
 * to measure optimization effectiveness
 */

export async function GET(request: NextRequest) {
  try {
    // Optional: Require admin access for monitoring
    const userId = await getUserIdFromRequest(request);
    
    // Get comprehensive cache statistics
    const stats = pageCache.getStats();
    const tierBreakdown = pageCache.getTierBreakdown();
    
    // Calculate cost savings
    const totalRequests = stats.hits + stats.misses;
    const cacheSavings = stats.hits * 0.00036 / 1000; // Firestore read cost per hit avoided
    const potentialMonthlySavings = cacheSavings * 30 * 24; // Extrapolate to monthly
    
    return NextResponse.json({
      success: true,
      cache: {
        stats,
        tierBreakdown,
        performance: {
          hitRate: stats.hitRate,
          totalRequests,
          cacheSavings: {
            immediate: cacheSavings.toFixed(6),
            dailyProjection: (cacheSavings * 24).toFixed(4),
            monthlyProjection: potentialMonthlySavings.toFixed(2)
          }
        },
        recommendations: generateCacheRecommendations(stats, tierBreakdown)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return NextResponse.json({
      error: 'Failed to get cache statistics',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Generate cache optimization recommendations
 */
function generateCacheRecommendations(
  stats: any, 
  tierBreakdown: { hot: number; warm: number; cold: number }
): string[] {
  const recommendations: string[] = [];
  
  if (stats.hitRate < 50) {
    recommendations.push('Cache hit rate is low - consider increasing cache TTL or preloading popular pages');
  } else if (stats.hitRate > 90) {
    recommendations.push('Excellent cache performance! Consider expanding cache size for more pages');
  }
  
  if (tierBreakdown.cold > tierBreakdown.hot + tierBreakdown.warm) {
    recommendations.push('Many cold cache entries - consider implementing page preloading for popular content');
  }
  
  if (stats.evictions > stats.hits * 0.1) {
    recommendations.push('High eviction rate - consider increasing cache size or improving eviction strategy');
  }
  
  if (stats.totalReads > 1000 && stats.hitRate > 70) {
    recommendations.push('Cache is performing well at scale - monitor for continued optimization opportunities');
  }
  
  return recommendations;
}

/**
 * POST /api/monitoring/cache-stats
 * Clear cache or trigger cache operations
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { action } = await request.json();
    
    switch (action) {
      case 'clear':
        pageCache.clear();
        return NextResponse.json({
          success: true,
          message: 'Cache cleared successfully',
          timestamp: new Date().toISOString()
        });
        
      case 'cleanup':
        pageCache.cleanup();
        return NextResponse.json({
          success: true,
          message: 'Cache cleanup completed',
          timestamp: new Date().toISOString()
        });
        
      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['clear', 'cleanup']
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error in cache operation:', error);
    return NextResponse.json({
      error: 'Failed to perform cache operation',
      details: error.message
    }, { status: 500 });
  }
}
