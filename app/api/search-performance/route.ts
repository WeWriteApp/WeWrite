import { NextRequest, NextResponse } from "next/server";
import { searchPerformanceTracker } from '../../utils/searchPerformanceTracker';

export const dynamic = 'force-dynamic';

interface PerformanceStats {
  totalSearches: number;
  averageSearchTime: number;
  cacheHitRate: number;
  fastSearches: number;
  normalSearches: number;
  slowSearches: number;
  verySlowSearches: number;
  cacheHits: number;
  cacheMisses: number;
  apiErrors: number;
  timeouts: number;
  recentSearches: unknown[];
  performanceAlerts: string[];
  recommendations: string[];
}

interface PerformanceStatus {
  status: 'unknown' | 'critical' | 'poor' | 'warning' | 'good';
  message: string;
}

interface PerformanceAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

function getPerformanceStatus(stats: PerformanceStats): PerformanceStatus {
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

function generatePerformanceAnalysis(stats: PerformanceStats): PerformanceAnalysis {
  const analysis: PerformanceAnalysis = {
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const detailed = searchParams.get('detailed') === 'true';

    const stats = searchPerformanceTracker.getStats() as PerformanceStats;

    if (format === 'summary') {
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
      });
    }

    if (detailed) {
      return NextResponse.json({
        metrics: stats,
        analysis: generatePerformanceAnalysis(stats),
        timestamp: new Date().toISOString()
      });
    }

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
    });

  } catch (error) {
    console.error('Error fetching search performance metrics:', error);
    return NextResponse.json({
      error: 'Failed to fetch performance metrics',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  try {
    searchPerformanceTracker.reset();

    return NextResponse.json({
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error resetting performance metrics:', error);
    return NextResponse.json({
      error: 'Failed to reset performance metrics',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
