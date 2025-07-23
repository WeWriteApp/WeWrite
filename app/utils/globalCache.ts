/**
 * Global Cache System for Firebase Cost Optimization
 * 
 * Implements aggressive caching to prevent repeated Firebase reads
 * and reduce costs dramatically.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  estimatedSavings: number;
}

class GlobalCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    totalSavings: 0
  };

  // Default TTL values for different data types
  private readonly DEFAULT_TTLS = {
    userProfile: 300000,      // 5 minutes
    pageData: 180000,         // 3 minutes
    recentEdits: 60000,       // 1 minute
    subscriptionData: 600000, // 10 minutes
    tokenBalance: 120000,     // 2 minutes
    pageConnections: 300000,  // 5 minutes
    relatedPages: 600000,     // 10 minutes
    notifications: 30000,     // 30 seconds
    default: 180000           // 3 minutes
  };

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update hit count and stats
    entry.hits++;
    this.stats.hits++;
    this.stats.totalSavings += 0.001; // Estimate $0.001 saved per cache hit

    return entry.data;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, customTtl?: number): void {
    const ttl = customTtl || this.getTtlForKey(key);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0
    });

    // Clean up old entries if cache gets too large
    this.cleanup();
  }

  /**
   * Get TTL based on key pattern
   */
  private getTtlForKey(key: string): number {
    if (key.startsWith('user:') || key.startsWith('profile:')) {
      return this.DEFAULT_TTLS.userProfile;
    }
    if (key.startsWith('page:')) {
      return this.DEFAULT_TTLS.pageData;
    }
    if (key.startsWith('recent-edits:')) {
      return this.DEFAULT_TTLS.recentEdits;
    }
    if (key.startsWith('subscription:')) {
      return this.DEFAULT_TTLS.subscriptionData;
    }
    if (key.startsWith('tokens:')) {
      return this.DEFAULT_TTLS.tokenBalance;
    }
    if (key.startsWith('connections:')) {
      return this.DEFAULT_TTLS.pageConnections;
    }
    if (key.startsWith('related:')) {
      return this.DEFAULT_TTLS.relatedPages;
    }
    if (key.startsWith('notifications:')) {
      return this.DEFAULT_TTLS.notifications;
    }
    
    return this.DEFAULT_TTLS.default;
  }

  /**
   * Clean up expired entries and limit cache size
   */
  private cleanup(): void {
    const now = Date.now();
    const maxSize = 1000; // Maximum cache entries

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }

    // If still too large, remove oldest entries
    if (this.cache.size > maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    console.log('🧹 Global cache cleared');
  }

  /**
   * Clear cache entries by pattern
   */
  clearPattern(pattern: string): void {
    let cleared = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    console.log(`🧹 Cleared ${cleared} cache entries matching pattern: ${pattern}`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      totalEntries: this.cache.size,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate,
      estimatedSavings: this.stats.totalSavings
    };
  }

  /**
   * Get detailed cache info for debugging
   */
  getDebugInfo(): any {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp,
      ttl: entry.ttl,
      hits: entry.hits,
      expired: Date.now() - entry.timestamp > entry.ttl
    }));

    return {
      stats: this.getStats(),
      entries: entries.slice(0, 20), // Show first 20 entries
      topHits: entries
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 10)
        .map(e => ({ key: e.key, hits: e.hits }))
    };
  }
}

// Global cache instance
export const globalCache = new GlobalCache();

/**
 * Cached query wrapper - use this for all expensive Firebase queries
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  customTtl?: number
): Promise<T> {
  // Check cache first
  const cached = globalCache.get<T>(key);
  if (cached !== null) {
    console.log(`🚀 CACHE HIT: ${key}`);
    return cached;
  }

  // Execute query and cache result
  console.log(`💸 CACHE MISS: ${key} - executing Firebase query`);
  const result = await queryFn();
  globalCache.set(key, result, customTtl);
  
  return result;
}

/**
 * Clear cache for specific patterns (useful for invalidation)
 */
export function invalidateCache(pattern: string): void {
  globalCache.clearPattern(pattern);
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): CacheStats {
  return globalCache.getStats();
}

/**
 * Get debug information about cache
 */
export function getCacheDebugInfo(): any {
  return globalCache.getDebugInfo();
}

// Auto-cleanup every 5 minutes
if (typeof window === 'undefined') { // Server-side only
  setInterval(() => {
    globalCache['cleanup']();
    const stats = globalCache.getStats();
    console.log(`🧹 Cache cleanup: ${stats.totalEntries} entries, ${stats.hitRate.toFixed(1)}% hit rate, $${stats.estimatedSavings.toFixed(3)} estimated savings`);
  }, 300000);
}
