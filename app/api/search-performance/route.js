import { NextResponse } from "next/server";
import { searchPerformanceTracker } from '../../utils/searchPerformanceTracker.js';

// Add export for dynamic route handling
export const dynamic = 'force-dynamic';

/**
 * OPTIMIZATION: Search Performance Monitoring API
 * 
 * Provides detailed performance metrics and recommendations for search optimization.
 * This endpoint helps identify bottlenecks and track improvements over time.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const detailed = searchParams.get('detailed') === 'true';

    // Get performance statistics
    const stats = searchPerformanceTracker.getStats();

    if (format === 'summary') {
      // Return summary for dashboard display
      return NextResponse.json({
        summary: {
          totalSearches: stats.totalSearches,
          averageSearchTime: stats.averageSearchTime,
          cacheHitRate: stats.cacheHitRate,
          slowSearchPercentage: Math.round((stats.slowSearches + stats.verySlowSearches) / stats.totalSearches * 100) || 0,
          errorRate: Math.round(stats.apiErrors / stats.totalSearches * 100) || 0
        },
        status: getPerformanceStatus(stats),
        lastUpdated: new Date().toISOString()
      }, { status: 200 });
    }

    if (detailed) {
      // Return detailed metrics for analysis
      return NextResponse.json({
        metrics: stats,
        analysis: generatePerformanceAnalysis(stats),
        timestamp: new Date().toISOString()
      }, { status: 200 });
    }

    // Return standard metrics
    return NextResponse.json({
      performance: {
        totalSearches: stats.totalSearches,
        averageSearchTime: stats.averageSearchTime,
        speedDistribution: {
          fast: stats.fastSearches,
          normal: stats.normalSearches,
          slow: stats.slowSearches,
          verySlow: stats.verySlowSearches
        },
        cacheMetrics: {
          hitRate: stats.cacheHitRate,
          hits: stats.cacheHits,
          misses: stats.cacheMisses
        },
        errors: {
          total: stats.apiErrors,
          timeouts: stats.timeouts
        }
      },
      recentSearches: stats.recentSearches,
      alerts: stats.performanceAlerts,
      recommendations: stats.recommendations,
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching search performance metrics:', error);
    return NextResponse.json({
      error: 'Failed to fetch performance metrics',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Reset performance metrics (useful for testing)
 */
export async function DELETE(request) {
  try {
    searchPerformanceTracker.reset();
    
    return NextResponse.json({
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('Error resetting performance metrics:', error);
    return NextResponse.json({
      error: 'Failed to reset performance metrics',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Determine overall performance status
 */
function getPerformanceStatus(stats) {
  if (stats.totalSearches === 0) {
    return { status: 'unknown', message: 'No search data available' };
  }

  const slowPercentage = (stats.slowSearches + stats.verySlowSearches) / stats.totalSearches * 100;
  const errorRate = stats.apiErrors / stats.totalSearches * 100;

  if (errorRate > 5) {
    return { status: 'critical', message: 'High error rate detected' };
  }

  if (slowPercentage > 20) {
    return { status: 'poor', message: 'Too many slow searches' };
  }

  if (stats.averageSearchTime > 1000) {
    return { status: 'poor', message: 'Average search time too high' };
  }

  if (stats.cacheHitRate < 30) {
    return { status: 'warning', message: 'Low cache hit rate' };
  }

  if (slowPercentage > 10 || stats.averageSearchTime > 500) {
    return { status: 'warning', message: 'Performance could be improved' };
  }

  return { status: 'good', message: 'Search performance is healthy' };
}

/**
 * Generate detailed performance analysis
 */
function generatePerformanceAnalysis(stats) {
  const analysis = {
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: []
  };

  // Analyze strengths
  if (stats.cacheHitRate > 60) {
    analysis.strengths.push('High cache hit rate indicates effective caching strategy');
  }

  if (stats.fastSearches > stats.totalSearches * 0.7) {
    analysis.strengths.push('Majority of searches are fast (< 200ms)');
  }

  if (stats.apiErrors / stats.totalSearches < 0.01) {
    analysis.strengths.push('Very low error rate indicates stable search API');
  }

  // Analyze weaknesses
  if (stats.averageSearchTime > 800) {
    analysis.weaknesses.push('Average search time is too high');
  }

  if (stats.verySlowSearches > stats.totalSearches * 0.05) {
    analysis.weaknesses.push('Too many very slow searches (> 1000ms)');
  }

  if (stats.cacheHitRate < 40) {
    analysis.weaknesses.push('Cache hit rate is below optimal threshold');
  }

  // Analyze opportunities
  if (stats.cacheMisses > stats.cacheHits) {
    analysis.opportunities.push('Improve caching strategy to reduce database queries');
  }

  if (stats.slowSearches > 0) {
    analysis.opportunities.push('Optimize database indexes for common search patterns');
  }

  // Analyze threats
  if (stats.apiErrors > stats.totalSearches * 0.02) {
    analysis.threats.push('Increasing error rate may impact user experience');
  }

  if (stats.timeouts > 0) {
    analysis.threats.push('Search timeouts indicate potential infrastructure issues');
  }

  return analysis;
}
