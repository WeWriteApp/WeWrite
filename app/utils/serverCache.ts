/**
 * Server-Side Caching Utility for Firebase Cost Optimization
 * 
 * Provides in-memory caching for API routes to reduce Firebase reads
 * and improve response times. Implements LRU eviction and TTL expiration.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  hitRate: number;
  memoryUsage: number;
}

class ServerCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
    hitRate: 0,
    memoryUsage: 0
  };

  private readonly MAX_CACHE_SIZE = 1000;
  private readonly DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes default
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Get cached data if valid
   */
  get<T>(key: string): T | null {
    this.stats.totalRequests++;
    
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    this.stats.hits++;
    this.updateHitRate();
    
    return entry.data;
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastRecentlyUsed();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl,
      accessCount: 1,
      lastAccessed: now
    });

    this.updateMemoryUsage();
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateMemoryUsage();
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.updateMemoryUsage();
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern: string | RegExp): number {
    let deletedCount = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    this.updateMemoryUsage();
    return deletedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastRecentlyUsed(): void {
    if (this.cache.size === 0) return;

    // Find the least recently used entry
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[ServerCache] Cleaned up ${deletedCount} expired entries`);
      this.updateMemoryUsage();
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0;
  }

  /**
   * Update memory usage estimation
   */
  private updateMemoryUsage(): void {
    // Rough estimation of memory usage
    this.stats.memoryUsage = this.cache.size * 1024; // Assume 1KB per entry average
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// Create global cache instances for different data types
export const apiCache = new ServerCache();
export const userCache = new ServerCache();
export const pageCache = new ServerCache();
export const analyticsCache = new ServerCache();

// Base TTL values
const FAST_TTL = process.env.NODE_ENV === 'development' ? 5 * 1000 : 10 * 1000; // 5s dev, 10s prod
const SLOW_TTL = process.env.NODE_ENV === 'development' ? 30 * 1000 : 60 * 1000; // 30s dev, 1min prod

// Unified cache TTL constants (consolidated from unifiedCache.ts)
export const UNIFIED_CACHE_TTL = {
  STATIC_DATA: SLOW_TTL,
  USER_DATA: SLOW_TTL,
  PAGE_DATA: FAST_TTL,
  ANALYTICS_DATA: FAST_TTL,
  SEARCH_DATA: FAST_TTL,
  SESSION_DATA: SLOW_TTL,
  REALTIME_DATA: FAST_TTL,
  LIVE_STATS: FAST_TTL,
  ACTIVITY_DATA: FAST_TTL,
  DEFAULT: FAST_TTL
};

// Cache TTL constants for convenience
export const CACHE_TTL = {
  STATIC_DATA: UNIFIED_CACHE_TTL.STATIC_DATA,
  USER_DATA: UNIFIED_CACHE_TTL.USER_DATA,
  PAGE_DATA: UNIFIED_CACHE_TTL.PAGE_DATA,
  ANALYTICS: UNIFIED_CACHE_TTL.ANALYTICS_DATA,
  SEARCH_RESULTS: UNIFIED_CACHE_TTL.SEARCH_DATA,
  LIVE_DATA: UNIFIED_CACHE_TTL.REALTIME_DATA,
  DEFAULT: UNIFIED_CACHE_TTL.DEFAULT,
};

/**
 * React Query configuration helper
 * Returns appropriate caching config based on data type
 */
export function getReactQueryConfig(queryType: string) {
  // Base retry config
  const retryConfig = {
    retry: false, // Disable retries to prevent Firebase quota abuse
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000)
  };

  switch (queryType) {
    case 'static':
    case 'config':
      // Static data rarely changes - cache aggressively
      return {
        staleTime: 30 * 60 * 1000, // 30 minutes
        gcTime: 60 * 60 * 1000, // 1 hour
        ...retryConfig
      };

    case 'user':
    case 'profile':
      // User data changes occasionally - moderate caching
      return {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 15 * 60 * 1000, // 15 minutes
        ...retryConfig
      };

    case 'page':
    case 'content':
      // Page content - moderate caching, users expect fresh content
      return {
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        ...retryConfig
      };

    case 'analytics':
    case 'stats':
      // Analytics can be stale - cache aggressively
      return {
        staleTime: 10 * 60 * 1000, // 10 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        ...retryConfig
      };

    case 'search':
    case 'results':
      // Search results - short cache, users expect fresh results
      return {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
        ...retryConfig
      };

    case 'realtime':
    case 'activity':
    case 'live':
      // Real-time data - very short cache
      return {
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 2 * 60 * 1000, // 2 minutes
        ...retryConfig
      };

    default:
      // Default - moderate caching
      return {
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        ...retryConfig
      };
  }
}

/**
 * Generate a cache key from multiple parts
 */
export function cacheKey(...parts: (string | number | boolean | undefined | null)[]): string {
  return parts.filter(p => p !== undefined && p !== null).join(':');
}

/**
 * Cached query wrapper - for Firebase/database queries (moved from globalCache.ts)
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  customTtl?: number
): Promise<T> {
  const cached = apiCache.get<T>(key);
  if (cached !== null) {
    console.log(`🚀 CACHE HIT: ${key}`);
    return cached;
  }

  console.log(`💸 CACHE MISS: ${key} - executing query`);
  const result = await queryFn();
  apiCache.set(key, result, customTtl || CACHE_TTL.DEFAULT);

  return result;
}

/**
 * Simple cache instance for general use (replaces simpleCache.ts)
 */
export const cache = {
  get: <T>(key: string): T | null => apiCache.get<T>(key),
  set: <T>(key: string, data: T, ttl?: number): void => apiCache.set(key, data, ttl),
  delete: (key: string): boolean => apiCache.delete(key),
  has: (key: string): boolean => apiCache.has(key),
  clear: (): void => apiCache.clear(),
};

/**
 * Cached API call wrapper
 */
export const withCache = <T>(
  cache: ServerCache,
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Check cache first
      const cached = cache.get<T>(key);
      if (cached !== null) {
        resolve(cached);
        return;
      }

      // Fetch fresh data
      const data = await fetcher();
      
      // Cache the result
      cache.set(key, data, ttl);
      
      resolve(data);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Convenience functions for common cache operations
 */
export const cacheHelpers = {
  // User data caching
  getUserData: <T>(userId: string, fetcher: () => Promise<T>) =>
    withCache(userCache, `user:${userId}`, fetcher, CACHE_TTL.USER_DATA),

  // Page data caching
  getPageData: <T>(pageId: string, fetcher: () => Promise<T>) =>
    withCache(pageCache, `page:${pageId}`, fetcher, CACHE_TTL.PAGE_DATA),

  // Analytics caching
  getAnalytics: <T>(key: string, fetcher: () => Promise<T>) =>
    withCache(analyticsCache, `analytics:${key}`, fetcher, CACHE_TTL.ANALYTICS),

  // Search results caching
  getSearchResults: <T>(query: string, fetcher: () => Promise<T>) =>
    withCache(apiCache, `search:${query}`, fetcher, CACHE_TTL.SEARCH_RESULTS),

  // Generic API caching
  getApiData: <T>(key: string, fetcher: () => Promise<T>, ttl?: number) =>
    withCache(apiCache, key, fetcher, ttl || CACHE_TTL.DEFAULT),
};

/**
 * Cache invalidation helpers
 */
export const invalidateCache = {
  user: (userId: string) => userCache.invalidate(`user:${userId}`),
  page: (pageId: string) => pageCache.invalidate(`page:${pageId}`),
  analytics: () => analyticsCache.clear(),
  search: () => apiCache.invalidate(/^search:/),
  all: () => {
    apiCache.clear();
    userCache.clear();
    pageCache.clear();
    analyticsCache.clear();
  },
};

/**
 * Get combined cache statistics
 */
export const getCacheStats = () => {
  return {
    api: apiCache.getStats(),
    user: userCache.getStats(),
    page: pageCache.getStats(),
    analytics: analyticsCache.getStats(),
    total: {
      size: apiCache.size() + userCache.size() + pageCache.size() + analyticsCache.size(),
      memoryUsage: apiCache.getStats().memoryUsage + userCache.getStats().memoryUsage + 
                   pageCache.getStats().memoryUsage + analyticsCache.getStats().memoryUsage,
    }
  };
};
