/**
 * Unified Caching Configuration
 * 
 * Consolidates all caching strategies across WeWrite into a single,
 * consistent configuration system. Replaces scattered cache TTLs
 * and provides centralized cache management.
 */

// Unified TTL Configuration - Single source of truth for all cache durations
export const UNIFIED_CACHE_TTL = {
  // Static data that rarely changes (8 hours)
  STATIC_DATA: 8 * 60 * 60 * 1000,
  
  // User data (profiles, settings) (6 hours)
  USER_DATA: 6 * 60 * 60 * 1000,
  
  // Page content and metadata (4 hours)
  PAGE_DATA: 4 * 60 * 60 * 1000,
  
  // Analytics and statistics (3 hours)
  ANALYTICS_DATA: 3 * 60 * 60 * 1000,
  
  // Search results (2 hours)
  SEARCH_DATA: 2 * 60 * 60 * 1000,
  
  // Session data (4 hours)
  SESSION_DATA: 4 * 60 * 60 * 1000,
  
  // Real-time data (30 minutes)
  REALTIME_DATA: 30 * 60 * 1000,
  
  // Live stats (2 minutes)
  LIVE_STATS: 2 * 60 * 1000,
  
  // Activity feeds (1 minute)
  ACTIVITY_DATA: 1 * 60 * 1000,
  
  // Default fallback (2 hours)
  DEFAULT: 2 * 60 * 60 * 1000
} as const;

// Cache type definitions for type safety
export type CacheType = keyof typeof UNIFIED_CACHE_TTL;

// Cache configuration for different data types
export interface CacheConfig {
  ttl: number;
  maxSize?: number;
  enableCompression?: boolean;
  enablePersistence?: boolean;
}

export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Static data - long TTL, large cache, persistent
  static: {
    ttl: UNIFIED_CACHE_TTL.STATIC_DATA,
    maxSize: 1000,
    enableCompression: true,
    enablePersistence: true
  },
  
  // User data - long TTL, medium cache, persistent
  user: {
    ttl: UNIFIED_CACHE_TTL.USER_DATA,
    maxSize: 500,
    enableCompression: false,
    enablePersistence: true
  },
  
  // Page data - medium TTL, large cache, persistent
  page: {
    ttl: UNIFIED_CACHE_TTL.PAGE_DATA,
    maxSize: 2000,
    enableCompression: true,
    enablePersistence: true
  },
  
  // Analytics - medium TTL, medium cache, not persistent
  analytics: {
    ttl: UNIFIED_CACHE_TTL.ANALYTICS_DATA,
    maxSize: 500,
    enableCompression: false,
    enablePersistence: false
  },
  
  // Search results - medium TTL, large cache, not persistent
  search: {
    ttl: UNIFIED_CACHE_TTL.SEARCH_DATA,
    maxSize: 1000,
    enableCompression: false,
    enablePersistence: false
  },
  
  // Session data - long TTL, small cache, persistent
  session: {
    ttl: UNIFIED_CACHE_TTL.SESSION_DATA,
    maxSize: 100,
    enableCompression: false,
    enablePersistence: true
  },
  
  // Real-time data - short TTL, small cache, not persistent
  realtime: {
    ttl: UNIFIED_CACHE_TTL.REALTIME_DATA,
    maxSize: 200,
    enableCompression: false,
    enablePersistence: false
  },
  
  // Live stats - very short TTL, small cache, not persistent
  stats: {
    ttl: UNIFIED_CACHE_TTL.LIVE_STATS,
    maxSize: 100,
    enableCompression: false,
    enablePersistence: false
  },
  
  // Activity data - very short TTL, medium cache, not persistent
  activity: {
    ttl: UNIFIED_CACHE_TTL.ACTIVITY_DATA,
    maxSize: 300,
    enableCompression: false,
    enablePersistence: false
  },
  
  // Default configuration
  default: {
    ttl: UNIFIED_CACHE_TTL.DEFAULT,
    maxSize: 500,
    enableCompression: false,
    enablePersistence: false
  }
};

/**
 * Get cache configuration for a specific data type
 */
export function getCacheConfig(dataType: string): CacheConfig {
  // Normalize data type
  const normalizedType = dataType.toLowerCase();
  
  // Map common aliases to standard types
  const typeMapping: Record<string, string> = {
    'profile': 'user',
    'subscription': 'user',
    'content': 'page',
    'metadata': 'page',
    'stats': 'analytics',
    'counters': 'analytics',
    'results': 'search',
    'live': 'realtime',
    'recent': 'activity'
  };
  
  const mappedType = typeMapping[normalizedType] || normalizedType;
  return CACHE_CONFIGS[mappedType] || CACHE_CONFIGS.default;
}

/**
 * Get TTL for a specific cache type
 */
export function getCacheTTL(cacheType: CacheType | string): number {
  if (typeof cacheType === 'string') {
    const config = getCacheConfig(cacheType);
    return config.ttl;
  }
  return UNIFIED_CACHE_TTL[cacheType] || UNIFIED_CACHE_TTL.DEFAULT;
}

/**
 * React Query cache configuration generator
 */
export function getReactQueryConfig(queryType: string) {
  const config = getCacheConfig(queryType);
  
  return {
    staleTime: config.ttl,
    gcTime: config.ttl * 2, // Garbage collection time is 2x stale time
    retry: (failureCount: number, error: any) => {
      // Don't retry on 4xx errors (client errors)
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000)
  };
}

/**
 * Server cache configuration generator
 */
export function getServerCacheConfig(dataType: string) {
  const config = getCacheConfig(dataType);
  
  return {
    ttl: config.ttl,
    maxSize: config.maxSize || 500,
    enableCompression: config.enableCompression || false
  };
}

/**
 * Cache invalidation patterns
 */
export const CACHE_INVALIDATION_PATTERNS = {
  // When user data changes
  USER_UPDATE: ['user', 'session', 'analytics'],
  
  // When page data changes
  PAGE_UPDATE: ['page', 'search', 'activity', 'analytics'],
  
  // When activity occurs
  ACTIVITY_UPDATE: ['activity', 'realtime', 'analytics'],
  
  // When stats need refresh
  STATS_UPDATE: ['stats', 'analytics'],
  
  // Global cache clear
  GLOBAL_CLEAR: ['user', 'page', 'search', 'activity', 'stats', 'analytics']
} as const;

/**
 * Get cache types to invalidate for a specific event
 */
export function getCacheInvalidationTypes(event: keyof typeof CACHE_INVALIDATION_PATTERNS): string[] {
  return CACHE_INVALIDATION_PATTERNS[event] || [];
}

/**
 * Unified cache key generator
 */
export function generateUnifiedCacheKey(
  namespace: string,
  identifier: string,
  params?: Record<string, any>
): string {
  const baseKey = `${namespace}:${identifier}`;
  
  if (!params || Object.keys(params).length === 0) {
    return baseKey;
  }
  
  // Sort params for consistent key generation
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
    
  return `${baseKey}?${sortedParams}`;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  memoryUsage?: number;
}

/**
 * Unified cache interface for all cache implementations
 */
export interface UnifiedCacheInterface<T = any> {
  get(key: string): T | null;
  set(key: string, value: T, ttl?: number): void;
  delete(key: string): boolean;
  clear(): void;
  has(key: string): boolean;
  size(): number;
  getStats(): CacheStats;
  cleanup(): void;
}

/**
 * Cache performance monitoring
 */
export class CachePerformanceMonitor {
  private stats = new Map<string, CacheStats>();
  
  recordHit(cacheType: string): void {
    const stats = this.getOrCreateStats(cacheType);
    stats.hits++;
    this.updateHitRate(stats);
  }
  
  recordMiss(cacheType: string): void {
    const stats = this.getOrCreateStats(cacheType);
    stats.misses++;
    this.updateHitRate(stats);
  }
  
  recordEviction(cacheType: string): void {
    const stats = this.getOrCreateStats(cacheType);
    stats.evictions++;
  }
  
  updateSize(cacheType: string, size: number): void {
    const stats = this.getOrCreateStats(cacheType);
    stats.size = size;
  }
  
  getStats(cacheType: string): CacheStats | null {
    return this.stats.get(cacheType) || null;
  }
  
  getAllStats(): Record<string, CacheStats> {
    const result: Record<string, CacheStats> = {};
    for (const [type, stats] of this.stats.entries()) {
      result[type] = { ...stats };
    }
    return result;
  }
  
  private getOrCreateStats(cacheType: string): CacheStats {
    if (!this.stats.has(cacheType)) {
      this.stats.set(cacheType, {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        hitRate: 0
      });
    }
    return this.stats.get(cacheType)!;
  }
  
  private updateHitRate(stats: CacheStats): void {
    const total = stats.hits + stats.misses;
    stats.hitRate = total > 0 ? stats.hits / total : 0;
  }
}

// Global cache performance monitor
export const cachePerformanceMonitor = new CachePerformanceMonitor();

/**
 * Export unified cache configuration for backward compatibility
 */
export const CACHE_TTL = UNIFIED_CACHE_TTL;
export const CACHE_CONFIG = CACHE_CONFIGS;
