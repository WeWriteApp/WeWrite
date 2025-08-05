import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { pageCache } from '../../../utils/pageCache';
import { pagesListCache } from '../../../utils/pagesListCache';
import { userCache } from '../../../utils/userCache';
import { searchCache } from '../../../utils/searchCache';
import { analyticsCache } from '../../../utils/analyticsCache';
import { getReadStats } from '../../../utils/databaseReadTracker';
import { analyzeDatabaseReads } from '../../../utils/databaseReadAnalyzer';

/**
 * Optimization Dashboard API
 * 
 * Comprehensive monitoring of database read optimizations
 * Shows real-time impact of caching and optimization strategies
 */

interface OptimizationMetrics {
  caching: {
    pageCache: any;
    pagesListCache: any;
    userCache: any;
    searchCache: any;
    analyticsCache: any;
    totalCacheHits: number;
    totalCacheMisses: number;
    overallHitRate: number;
    estimatedCostSavings: {
      daily: number;
      monthly: number;
      yearly: number;
    };
  };
  databaseReads: {
    stats: any;
    analysis: any;
    recentOptimizations: string[];
  };
  performance: {
    averageResponseTime: number;
    cacheResponseTime: number;
    databaseResponseTime: number;
    optimizationEffectiveness: number;
  };
  recommendations: string[];
}

export async function GET(request: NextRequest) {
  try {
    // Optional: Require admin access for monitoring
    const userId = await getUserIdFromRequest(request);
    
    console.log('📊 Optimization Dashboard: Generating comprehensive metrics...');
    
    // Get cache statistics
    const pageCacheStats = pageCache.getStats();
    const pagesListCacheStats = pagesListCache.getStats();
    const userCacheStats = userCache.getStats();
    const searchCacheStats = searchCache.getStats();
    const analyticsCacheStats = analyticsCache.getStats();
    
    // Get database read statistics (with fallback)
    let dbReadStats = { totalReads: 0, hourlyReads: 0 };
    let dbAnalysis = { recommendations: [] };

    try {
      dbReadStats = getReadStats();
    } catch (error) {
      console.warn('Database read stats not available:', error.message);
    }

    try {
      dbAnalysis = analyzeDatabaseReads();
    } catch (error) {
      console.warn('Database read analysis not available:', error.message);
    }
    
    // Calculate combined cache metrics
    const totalCacheHits = pageCacheStats.hits + pagesListCacheStats.hits + userCacheStats.hits + searchCacheStats.hits + analyticsCacheStats.hits;
    const totalCacheMisses = pageCacheStats.misses + pagesListCacheStats.misses + userCacheStats.misses + searchCacheStats.misses + analyticsCacheStats.misses;
    const totalRequests = totalCacheHits + totalCacheMisses;
    const overallHitRate = totalRequests > 0 ? (totalCacheHits / totalRequests) * 100 : 0;
    
    // Calculate cost savings (Firestore read cost: $0.00036 per 1000 reads)
    const readCostPer1000 = 0.00036;
    const costPerRead = readCostPer1000 / 1000;
    const totalCostSavings = totalCacheHits * costPerRead;
    
    const estimatedCostSavings = {
      daily: totalCostSavings * 24,
      monthly: totalCostSavings * 24 * 30,
      yearly: totalCostSavings * 24 * 365
    };
    
    // Generate performance metrics
    const performance = {
      averageResponseTime: calculateAverageResponseTime(),
      cacheResponseTime: 50, // Estimated cache response time in ms
      databaseResponseTime: 300, // Estimated database response time in ms
      optimizationEffectiveness: Math.min(overallHitRate, 100)
    };
    
    // Generate optimization recommendations
    const recommendations = generateOptimizationRecommendations({
      pageCacheStats,
      pagesListCacheStats,
      userCacheStats,
      searchCacheStats,
      analyticsCacheStats,
      overallHitRate,
      dbReadStats,
      performance
    });
    
    const metrics: OptimizationMetrics = {
      caching: {
        pageCache: {
          ...pageCacheStats,
          tierBreakdown: pageCache.getTierBreakdown()
        },
        pagesListCache: pagesListCacheStats,
        userCache: {
          ...userCacheStats,
          tierBreakdown: userCacheStats.tierBreakdown
        },
        searchCache: {
          ...searchCacheStats,
          tierBreakdown: searchCacheStats.tierBreakdown,
          typeBreakdown: searchCacheStats.typeBreakdown,
          popularSearches: searchCache.getPopularSearches(5)
        },
        analyticsCache: {
          ...analyticsCacheStats,
          tierBreakdown: analyticsCacheStats.tierBreakdown,
          typeBreakdown: analyticsCacheStats.typeBreakdown
        },
        totalCacheHits,
        totalCacheMisses,
        overallHitRate: Math.round(overallHitRate * 100) / 100,
        estimatedCostSavings: {
          daily: Math.round(estimatedCostSavings.daily * 10000) / 10000,
          monthly: Math.round(estimatedCostSavings.monthly * 100) / 100,
          yearly: Math.round(estimatedCostSavings.yearly * 100) / 100
        }
      },
      databaseReads: {
        stats: dbReadStats,
        analysis: dbAnalysis,
        recentOptimizations: [
          'Enhanced page cache with multi-tier TTL',
          'Aggressive pages list caching',
          'Smart cache eviction strategies',
          'Enhanced user profile caching system',
          'Batch user data optimization',
          'Advanced search result caching',
          'Multi-type search optimization',
          'Analytics query result caching',
          'Pre-computed analytics aggregations',
          'Production monitoring mode enabled'
        ]
      },
      performance,
      recommendations
    };
    
    console.log(`✅ Optimization Dashboard: Generated metrics - ${overallHitRate.toFixed(1)}% hit rate, $${estimatedCostSavings.monthly.toFixed(4)} monthly savings`);
    
    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
      summary: {
        hitRate: `${overallHitRate.toFixed(1)}%`,
        monthlySavings: `$${estimatedCostSavings.monthly.toFixed(4)}`,
        totalCacheHits,
        optimizationLevel: getOptimizationLevel(overallHitRate)
      }
    });
    
  } catch (error) {
    console.error('Error generating optimization dashboard:', error);
    return NextResponse.json({
      error: 'Failed to generate optimization metrics',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Calculate average response time (placeholder - would need real metrics)
 */
function calculateAverageResponseTime(): number {
  // This would integrate with actual performance monitoring
  // For now, return estimated value based on cache hit rate
  const pageCacheStats = pageCache.getStats();
  const hitRate = pageCacheStats.hitRate || 0;
  
  // Estimate: cache hits ~50ms, cache misses ~300ms
  return Math.round(50 + (100 - hitRate) * 2.5);
}

/**
 * Generate optimization recommendations based on current metrics
 */
function generateOptimizationRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];

  const { pageCacheStats, pagesListCacheStats, userCacheStats, searchCacheStats, analyticsCacheStats, overallHitRate, dbReadStats } = metrics;
  
  // Cache hit rate recommendations
  if (overallHitRate < 30) {
    recommendations.push('🔴 CRITICAL: Cache hit rate is very low. Consider increasing cache TTL and implementing preloading.');
  } else if (overallHitRate < 60) {
    recommendations.push('🟡 MODERATE: Cache hit rate could be improved. Consider optimizing cache eviction strategy.');
  } else if (overallHitRate > 80) {
    recommendations.push('🟢 EXCELLENT: Cache performance is optimal. Monitor for continued effectiveness.');
  }
  
  // Page cache specific recommendations
  if (pageCacheStats.size < 100) {
    recommendations.push('Consider increasing page cache size to store more frequently accessed pages.');
  }
  
  // Pages list cache recommendations
  if (pagesListCacheStats.hitRate < 50) {
    recommendations.push('Pages list cache hit rate is low. Consider implementing query result preloading.');
  }

  // User cache recommendations
  if (userCacheStats.hitRate < 60) {
    recommendations.push('User cache hit rate is low. Consider preloading frequently accessed user profiles.');
  }

  if (userCacheStats.size > 800) {
    recommendations.push('User cache is near capacity. Consider increasing cache size or optimizing eviction strategy.');
  }

  // Search cache recommendations
  if (searchCacheStats.hitRate < 40) {
    recommendations.push('Search cache hit rate is low. Consider increasing search result TTL or implementing query normalization.');
  }

  if (searchCacheStats.averageResultCount < 5) {
    recommendations.push('Search queries returning few results. Consider improving search algorithms or query expansion.');
  }

  if (searchCacheStats.size > 1800) {
    recommendations.push('Search cache is near capacity. Consider optimizing search result storage or increasing cache size.');
  }

  // Analytics cache recommendations
  if (analyticsCacheStats.hitRate < 50) {
    recommendations.push('Analytics cache hit rate is low. Consider implementing pre-computed aggregations or increasing TTL.');
  }

  if (analyticsCacheStats.averageComputationCost > 200) {
    recommendations.push('Analytics queries are expensive. Consider optimizing query patterns or implementing more aggressive caching.');
  }

  if (analyticsCacheStats.size > 900) {
    recommendations.push('Analytics cache is near capacity. Consider implementing data archiving or increasing cache size.');
  }
  
  // Database read recommendations
  if (dbReadStats.totalReads > 1000) {
    recommendations.push('High database read volume detected. Focus on caching most frequently accessed endpoints.');
  }
  
  // Performance recommendations
  if (metrics.performance.averageResponseTime > 200) {
    recommendations.push('Average response time is high. Consider implementing more aggressive caching.');
  }
  
  return recommendations;
}

/**
 * Determine optimization level based on hit rate
 */
function getOptimizationLevel(hitRate: number): string {
  if (hitRate >= 80) return 'EXCELLENT';
  if (hitRate >= 60) return 'GOOD';
  if (hitRate >= 40) return 'MODERATE';
  if (hitRate >= 20) return 'POOR';
  return 'CRITICAL';
}

/**
 * POST /api/monitoring/optimization-dashboard
 * Trigger optimization actions
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { action } = await request.json();
    
    switch (action) {
      case 'clear-all-caches':
        pageCache.clear();
        pagesListCache.clear();
        userCache.clear();
        searchCache.clear();
        analyticsCache.clear();
        return NextResponse.json({
          success: true,
          message: 'All caches cleared successfully',
          timestamp: new Date().toISOString()
        });

      case 'cleanup-caches':
        pageCache.cleanup();
        pagesListCache.cleanup();
        userCache.cleanup();
        searchCache.cleanup();
        analyticsCache.cleanup();
        return NextResponse.json({
          success: true,
          message: 'Cache cleanup completed',
          timestamp: new Date().toISOString()
        });
        
      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['clear-all-caches', 'cleanup-caches']
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error in optimization dashboard action:', error);
    return NextResponse.json({
      error: 'Failed to perform optimization action',
      details: error.message
    }, { status: 500 });
  }
}
