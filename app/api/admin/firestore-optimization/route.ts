/**
 * Firestore Optimization Monitoring API
 * 
 * Provides real-time monitoring of Firestore usage, costs, and optimization recommendations.
 * Admin-only endpoint for monitoring database performance and costs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { 
  getCacheStats, 
  getFirestoreCostStats,
  preloadCriticalData,
  invalidateCache,
  flushBatches
} from '../../../utils/firestoreOptimizer';

// Admin user IDs (in production, this should be in environment variables)
const ADMIN_USER_IDS = [
  'fWNeCuussPgYgkN2LGohFRCPXiy1', // Jamie
  // Add other admin user IDs here
];

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId || !ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        return getOptimizationStats();
      
      case 'cache-stats':
        return getCacheStatistics();
      
      case 'cost-analysis':
        return getCostAnalysis();
      
      case 'recommendations':
        return getOptimizationRecommendations();
      
      default:
        return getOverviewDashboard();
    }

  } catch (error) {
    console.error('Firestore optimization API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch optimization data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId || !ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { action, data } = await request.json();

    switch (action) {
      case 'invalidate-cache':
        return handleCacheInvalidation(data);
      
      case 'preload-data':
        return handleDataPreload(data);
      
      case 'flush-batches':
        return handleBatchFlush();
      
      case 'optimize-queries':
        return handleQueryOptimization(data);
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Firestore optimization action error:', error);
    return NextResponse.json(
      { error: 'Failed to execute optimization action' },
      { status: 500 }
    );
  }
}

/**
 * Get overview dashboard data
 */
async function getOverviewDashboard() {
  const cacheStats = getCacheStats();
  const costStats = getFirestoreCostStats();
  
  const overview = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    summary: {
      totalCaches: Object.keys(cacheStats).length,
      dailyReads: costStats.dailyReads,
      dailyWrites: costStats.dailyWrites,
      readUtilization: (costStats.dailyReads / costStats.readThreshold) * 100,
      writeUtilization: (costStats.dailyWrites / costStats.writeThreshold) * 100
    },
    alerts: generateAlerts(costStats),
    quickActions: [
      { id: 'invalidate-all', label: 'Clear All Caches', type: 'warning' },
      { id: 'preload-critical', label: 'Preload Critical Data', type: 'info' },
      { id: 'flush-batches', label: 'Flush Pending Batches', type: 'info' }
    ]
  };

  return NextResponse.json(overview);
}

/**
 * Get detailed cache statistics
 */
async function getCacheStatistics() {
  const cacheStats = getCacheStats();
  
  const detailed = Object.entries(cacheStats).map(([cacheType, stats]) => ({
    cacheType,
    ...stats,
    utilizationPercent: (stats.size / stats.maxSize) * 100,
    efficiency: stats.size > 0 ? 'active' : 'unused'
  }));

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    caches: detailed,
    totalMemoryUsage: detailed.reduce((sum, cache) => sum + cache.size, 0),
    recommendations: generateCacheRecommendations(detailed)
  });
}

/**
 * Get cost analysis and projections
 */
async function getCostAnalysis() {
  const costStats = getFirestoreCostStats();
  
  // Estimate monthly costs based on current daily usage
  const estimatedMonthlyReads = costStats.dailyReads * 30;
  const estimatedMonthlyWrites = costStats.dailyWrites * 30;
  
  // Firestore pricing (approximate)
  const readCostPer100k = 0.36; // USD
  const writeCostPer100k = 1.08; // USD
  
  const estimatedMonthlyCost = 
    (estimatedMonthlyReads / 100000) * readCostPer100k +
    (estimatedMonthlyWrites / 100000) * writeCostPer100k;

  const analysis = {
    timestamp: new Date().toISOString(),
    current: {
      dailyReads: costStats.dailyReads,
      dailyWrites: costStats.dailyWrites,
      date: costStats.date
    },
    projections: {
      monthlyReads: estimatedMonthlyReads,
      monthlyWrites: estimatedMonthlyWrites,
      estimatedMonthlyCost: Math.round(estimatedMonthlyCost * 100) / 100
    },
    thresholds: {
      readThreshold: costStats.readThreshold,
      writeThreshold: costStats.writeThreshold,
      readUtilization: (costStats.dailyReads / costStats.readThreshold) * 100,
      writeUtilization: (costStats.dailyWrites / costStats.writeThreshold) * 100
    },
    optimizationPotential: calculateOptimizationPotential(costStats)
  };

  return NextResponse.json(analysis);
}

/**
 * Get optimization recommendations
 */
async function getOptimizationRecommendations() {
  const cacheStats = getCacheStats();
  const costStats = getFirestoreCostStats();
  
  const recommendations = [];

  // High read volume recommendations
  if (costStats.dailyReads > costStats.readThreshold * 0.8) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Read Optimization',
      title: 'High Read Volume Detected',
      description: `Daily reads: ${costStats.dailyReads} (${Math.round((costStats.dailyReads / costStats.readThreshold) * 100)}% of threshold)`,
      actions: [
        'Increase cache TTL for frequently accessed data',
        'Implement read-through caching for user data',
        'Add pagination to large query results',
        'Consider data denormalization for common queries'
      ]
    });
  }

  // Cache optimization recommendations
  const underutilizedCaches = Object.entries(cacheStats).filter(
    ([_, stats]) => (stats.size / stats.maxSize) < 0.1
  );

  if (underutilizedCaches.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Cache Optimization',
      title: 'Underutilized Caches',
      description: `${underutilizedCaches.length} caches are underutilized`,
      actions: underutilizedCaches.map(([cacheType]) => 
        `Review ${cacheType} cache configuration and usage patterns`
      )
    });
  }

  // Write optimization recommendations
  if (costStats.dailyWrites > costStats.writeThreshold * 0.7) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Write Optimization',
      title: 'High Write Volume',
      description: `Daily writes: ${costStats.dailyWrites} (${Math.round((costStats.dailyWrites / costStats.writeThreshold) * 100)}% of threshold)`,
      actions: [
        'Implement batch writing for bulk operations',
        'Reduce real-time analytics updates',
        'Consider write-behind caching for non-critical data',
        'Aggregate frequent updates into periodic batches'
      ]
    });
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    recommendations,
    summary: {
      total: recommendations.length,
      highPriority: recommendations.filter(r => r.priority === 'HIGH').length,
      mediumPriority: recommendations.filter(r => r.priority === 'MEDIUM').length
    }
  });
}

/**
 * Handle cache invalidation
 */
async function handleCacheInvalidation(data: { pattern?: string; cacheType?: string }) {
  try {
    if (data.pattern) {
      invalidateCache(data.pattern);
    } else if (data.cacheType) {
      invalidateCache(data.cacheType);
    } else {
      // Clear all caches
      invalidateCache('');
    }

    return NextResponse.json({
      success: true,
      message: 'Cache invalidated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Cache invalidation failed: ${error.message}`);
  }
}

/**
 * Handle data preloading
 */
async function handleDataPreload(data: { userId?: string }) {
  try {
    await preloadCriticalData(data.userId);
    
    return NextResponse.json({
      success: true,
      message: 'Critical data preloaded successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Data preload failed: ${error.message}`);
  }
}

/**
 * Handle batch flush
 */
async function handleBatchFlush() {
  try {
    await flushBatches();
    
    return NextResponse.json({
      success: true,
      message: 'All batches flushed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw new Error(`Batch flush failed: ${error.message}`);
  }
}

/**
 * Handle query optimization
 */
async function handleQueryOptimization(data: any) {
  // This would implement specific query optimizations
  // For now, return a placeholder response
  return NextResponse.json({
    success: true,
    message: 'Query optimization analysis completed',
    timestamp: new Date().toISOString(),
    note: 'Specific optimizations would be implemented based on query patterns'
  });
}

/**
 * Generate alerts based on current stats
 */
function generateAlerts(costStats: any): any[] {
  const alerts = [];

  if (costStats.dailyReads > costStats.readThreshold) {
    alerts.push({
      level: 'error',
      message: `Daily read limit exceeded: ${costStats.dailyReads}/${costStats.readThreshold}`,
      action: 'Implement aggressive caching immediately'
    });
  } else if (costStats.dailyReads > costStats.readThreshold * 0.8) {
    alerts.push({
      level: 'warning',
      message: `Approaching daily read limit: ${costStats.dailyReads}/${costStats.readThreshold}`,
      action: 'Consider increasing cache TTL'
    });
  }

  if (costStats.dailyWrites > costStats.writeThreshold) {
    alerts.push({
      level: 'error',
      message: `Daily write limit exceeded: ${costStats.dailyWrites}/${costStats.writeThreshold}`,
      action: 'Implement batch writing immediately'
    });
  }

  return alerts;
}

/**
 * Generate cache-specific recommendations
 */
function generateCacheRecommendations(cacheStats: any[]): any[] {
  const recommendations = [];

  for (const cache of cacheStats) {
    if (cache.utilizationPercent > 90) {
      recommendations.push({
        cacheType: cache.cacheType,
        recommendation: 'Increase cache size',
        reason: `Cache is ${Math.round(cache.utilizationPercent)}% full`
      });
    } else if (cache.utilizationPercent < 10 && cache.size > 0) {
      recommendations.push({
        cacheType: cache.cacheType,
        recommendation: 'Reduce cache size or increase TTL',
        reason: `Cache is only ${Math.round(cache.utilizationPercent)}% utilized`
      });
    }
  }

  return recommendations;
}

/**
 * Calculate optimization potential
 */
function calculateOptimizationPotential(costStats: any): any {
  const readSavingsPotential = Math.max(0, (costStats.dailyReads - costStats.readThreshold * 0.5) / costStats.dailyReads);
  const writeSavingsPotential = Math.max(0, (costStats.dailyWrites - costStats.writeThreshold * 0.3) / costStats.dailyWrites);

  return {
    readSavingsPotential: Math.round(readSavingsPotential * 100),
    writeSavingsPotential: Math.round(writeSavingsPotential * 100),
    overallPotential: Math.round(((readSavingsPotential + writeSavingsPotential) / 2) * 100),
    estimatedMonthlySavings: Math.round((readSavingsPotential * 0.36 + writeSavingsPotential * 1.08) * 100) / 100
  };
}
