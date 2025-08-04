/**
 * Database Read Tracker Utility
 *
 * Simple utility to track database reads for the monitoring system
 * without circular import issues. Now enhanced with advanced analysis.
 */

import { recordDatabaseRead } from './databaseReadAnalyzer';

// Global read tracking
let readStats = {
  totalReads: 0,
  hourlyReads: 0,
  lastHourReset: Date.now(),
  apiEndpointReads: new Map<string, number>(),
  cacheHitRate: 0,
  estimatedCost: 0,
  lastUpdated: Date.now()
};

// Track reads by endpoint
const endpointReadTracker = new Map<string, {
  count: number;
  lastAccess: number;
  avgResponseTime: number;
  cacheHits: number;
  cacheMisses: number;
}>();

/**
 * Track a database read operation
 */
export function trackDatabaseRead(
  endpoint: string,
  readCount: number = 1,
  responseTime: number = 0,
  fromCache: boolean = false,
  userId?: string,
  sessionId?: string
) {
  // Record in advanced analyzer
  recordDatabaseRead(endpoint, readCount, responseTime, fromCache, userId, sessionId);
  // Update global stats
  readStats.totalReads += readCount;
  readStats.hourlyReads += readCount;
  readStats.estimatedCost = readStats.totalReads * 0.00036 / 1000; // Firestore pricing
  readStats.lastUpdated = Date.now();

  // Reset hourly counter if needed
  const now = Date.now();
  if (now - readStats.lastHourReset > 60 * 60 * 1000) {
    readStats.hourlyReads = 0;
    readStats.lastHourReset = now;
  }

  // Track by endpoint
  const existing = endpointReadTracker.get(endpoint) || {
    count: 0,
    lastAccess: 0,
    avgResponseTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  existing.count += readCount;
  existing.lastAccess = now;
  existing.avgResponseTime = (existing.avgResponseTime + responseTime) / 2;
  
  if (fromCache) {
    existing.cacheHits++;
  } else {
    existing.cacheMisses++;
  }

  endpointReadTracker.set(endpoint, existing);

  // Update global cache hit rate
  const totalCacheOperations = Array.from(endpointReadTracker.values())
    .reduce((sum, stats) => sum + stats.cacheHits + stats.cacheMisses, 0);
  const totalCacheHits = Array.from(endpointReadTracker.values())
    .reduce((sum, stats) => sum + stats.cacheHits, 0);
  
  readStats.cacheHitRate = totalCacheOperations > 0 ? (totalCacheHits / totalCacheOperations) * 100 : 0;

  // Log critical thresholds
  if (readStats.hourlyReads > 10000) {
    console.warn(`🚨 HIGH READ VOLUME: ${readStats.hourlyReads} reads in current hour`);
  }
  
  if (readStats.estimatedCost > 5) {
    console.error(`🚨 COST ALERT: Estimated daily cost $${readStats.estimatedCost.toFixed(2)}`);
  }

  // Log the read for debugging (only for high-volume endpoints)
  if (readCount > 5 || !fromCache) {
    console.log(`📊 DB READ: ${endpoint} - ${readCount} reads, ${responseTime}ms, cache: ${fromCache}`);
  }
}

/**
 * Get current statistics
 */
export function getReadStats() {
  // Get top endpoints by read count
  const topEndpoints = Array.from(endpointReadTracker.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([endpoint, stats]) => ({
      endpoint,
      reads: stats.count,
      lastAccess: new Date(stats.lastAccess).toISOString(),
      avgResponseTime: Math.round(stats.avgResponseTime),
      cacheHitRate: stats.cacheHits + stats.cacheMisses > 0 
        ? Math.round((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100)
        : 0
    }));

  // Calculate optimization recommendations
  const recommendations = [];
  
  if (readStats.cacheHitRate < 50) {
    recommendations.push('URGENT: Cache hit rate below 50% - implement more aggressive caching');
  }
  
  if (readStats.hourlyReads > 5000) {
    recommendations.push('HIGH: Hourly read volume exceeds 5K - investigate request deduplication');
  }

  // Find endpoints with low cache hit rates
  for (const [endpoint, stats] of endpointReadTracker.entries()) {
    const hitRate = stats.cacheHits + stats.cacheMisses > 0 
      ? (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100
      : 0;
    
    if (stats.count > 100 && hitRate < 30) {
      recommendations.push(`ENDPOINT: ${endpoint} has ${hitRate.toFixed(1)}% cache hit rate with ${stats.count} reads`);
    }
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    stats: {
      totalReads: readStats.totalReads,
      hourlyReads: readStats.hourlyReads,
      estimatedDailyCost: readStats.estimatedCost,
      cacheHitRate: Math.round(readStats.cacheHitRate * 100) / 100,
      lastUpdated: new Date(readStats.lastUpdated).toISOString()
    },
    topEndpoints,
    recommendations,
    quotaStatus: {
      dailyQuota: 50000,
      currentUsage: readStats.totalReads,
      percentageUsed: (readStats.totalReads / 50000) * 100,
      projectedDailyUsage: readStats.hourlyReads * 24,
      status: readStats.totalReads > 50000 ? 'OVER_QUOTA' : 
              readStats.hourlyReads * 24 > 50000 ? 'PROJECTED_OVERAGE' : 'OK'
    }
  };
}

/**
 * Reset statistics
 */
export function resetReadStats() {
  readStats = {
    totalReads: 0,
    hourlyReads: 0,
    lastHourReset: Date.now(),
    apiEndpointReads: new Map(),
    cacheHitRate: 0,
    estimatedCost: 0,
    lastUpdated: Date.now()
  };

  endpointReadTracker.clear();
}
