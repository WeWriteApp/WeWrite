/**
 * Database Reads Monitoring API
 * GET /api/monitoring/database-reads
 * POST /api/monitoring/database-reads (reset stats)
 *
 * Provides cost monitoring data for the admin dashboard.
 * Uses the unified costMonitor for all tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getCostStats, costMonitor } from '../../../utils/costMonitor';
import { apiCache } from '../../../utils/serverCache';

export async function GET(_request: NextRequest) {
  try {
    const costStats = getCostStats();
    const cacheStats = apiCache.getStats();

    // Calculate derived metrics
    const totalReads = costStats.totalOperations;
    const hourlyReads = Math.round(costStats.hourlyCost / (0.00036 / 1000)); // Convert cost back to reads
    const estimatedDailyCost = costStats.projectedDailyCost;

    // Calculate cache hit rate from cache stats
    const cacheHitRate = cacheStats.hitRate || 0;

    // Build top endpoints from cost breakdown
    const topEndpoints = Object.entries(costStats.breakdown)
      .map(([endpoint, cost]) => ({
        endpoint,
        reads: Math.round(cost / (0.00036 / 1000)),
        lastAccess: new Date().toISOString(),
        avgResponseTime: 0, // Not tracked
        cacheHitRate
      }))
      .sort((a, b) => b.reads - a.reads)
      .slice(0, 10);

    // Calculate quota status (50k free tier daily)
    const dailyQuota = 50000;
    const currentUsage = hourlyReads * 24; // Projected
    const percentageUsed = (currentUsage / dailyQuota) * 100;

    let status: 'OK' | 'PROJECTED_OVERAGE' | 'OVER_QUOTA' = 'OK';
    if (percentageUsed > 100) {
      status = 'OVER_QUOTA';
    } else if (percentageUsed > 80) {
      status = 'PROJECTED_OVERAGE';
    }

    // Generate recommendations based on stats
    const recommendations: string[] = [];
    if (cacheHitRate < 50) {
      recommendations.push('Cache hit rate is low - consider increasing TTL values');
    }
    if (estimatedDailyCost > 5) {
      recommendations.push('Daily costs are elevated - review expensive operations');
    }
    if (costStats.alerts.warning) {
      recommendations.push('Cost warning threshold exceeded - optimize queries');
    }
    if (costStats.alerts.critical) {
      recommendations.push('CRITICAL: Immediate action needed to reduce costs');
    }

    return NextResponse.json({
      stats: {
        totalReads,
        hourlyReads,
        estimatedDailyCost,
        cacheHitRate,
        lastUpdated: new Date().toISOString()
      },
      topEndpoints,
      recommendations,
      quotaStatus: {
        dailyQuota,
        currentUsage,
        percentageUsed,
        projectedDailyUsage: currentUsage,
        status
      }
    });

  } catch (error) {
    console.error('Error in database reads monitoring:', error);
    return NextResponse.json({
      error: 'Failed to get monitoring data'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reset cost monitor stats
    costMonitor.reset();

    return NextResponse.json({
      success: true,
      message: 'Stats reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error resetting stats:', error);
    return NextResponse.json({
      error: 'Failed to reset stats'
    }, { status: 500 });
  }
}
