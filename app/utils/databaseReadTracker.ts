/**
 * Database Read Tracker Utility
 *
 * Simple utility to track database reads for the monitoring system
 * without circular import issues. Now enhanced with advanced analysis.
 *
 * PRODUCTION MONITORING MODE: When enabled, tracks production collection usage
 * even when running in development environment for accurate cost analysis.
 */

import { recordDatabaseRead } from './databaseReadAnalyzer';

// Production monitoring mode - tracks production collections for cost analysis
const PRODUCTION_MONITORING_MODE = process.env.ENABLE_PRODUCTION_MONITORING === 'true' ||
                                   process.env.NODE_ENV === 'production';

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
 * Track a database read operation with production monitoring support
 */
export function trackDatabaseRead(
  endpoint: string,
  readCount: number = 1,
  responseTime: number = 0,
  fromCache: boolean = false,
  userId?: string,
  sessionId?: string,
  collectionName?: string
) {
  // Normalize endpoint for production monitoring
  const normalizedEndpoint = PRODUCTION_MONITORING_MODE ?
    normalizeEndpointForProduction(endpoint) : endpoint;

  // Normalize collection name for production monitoring
  const normalizedCollection = PRODUCTION_MONITORING_MODE && collectionName ?
    normalizeCollectionForProduction(collectionName) : collectionName;

  // Record in advanced analyzer with normalized names
  recordDatabaseRead(normalizedEndpoint, readCount, responseTime, fromCache, userId, sessionId);

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

/**
 * Normalize endpoint names for production monitoring
 * Removes dev-specific parameters and normalizes paths
 */
function normalizeEndpointForProduction(endpoint: string): string {
  if (!PRODUCTION_MONITORING_MODE) return endpoint;

  // Remove dev-specific query parameters
  let normalized = endpoint.replace(/[?&]dev=true/g, '');
  normalized = normalized.replace(/[?&]test=true/g, '');

  // Normalize user IDs to generic pattern for better aggregation
  normalized = normalized.replace(/\/user\/[a-zA-Z0-9_-]+/g, '/user/{userId}');
  normalized = normalized.replace(/\/pages\/[a-zA-Z0-9_-]+/g, '/pages/{pageId}');

  // Remove trailing query separators
  normalized = normalized.replace(/[?&]$/, '');

  return normalized;
}

/**
 * Normalize collection names for production monitoring
 * Removes DEV_ prefixes to track production collection equivalents
 */
function normalizeCollectionForProduction(collectionName: string): string {
  if (!PRODUCTION_MONITORING_MODE) return collectionName;

  // Remove DEV_ prefix to get production collection name
  return collectionName.replace(/^DEV_/, '');
}

/**
 * Get production monitoring status and configuration
 */
export function getProductionMonitoringInfo() {
  return {
    enabled: PRODUCTION_MONITORING_MODE,
    reason: process.env.ENABLE_PRODUCTION_MONITORING === 'true' ?
      'Explicitly enabled via ENABLE_PRODUCTION_MONITORING' :
      process.env.NODE_ENV === 'production' ?
      'Enabled because NODE_ENV=production' :
      'Disabled - development environment',
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  };
}
