/**
 * Aggressive Caching System for Firebase Read Optimization
 * 
 * Implements extremely aggressive caching to prevent redundant Firebase reads
 * and reduce the 504K read crisis to manageable levels.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
  lastAccess: number;
  ttl: number;
}

interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number;
  newestEntry: number;
}

class AggressiveCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0
  };

  // 🚨 FIREBASE OPTIMIZATION: Extremely aggressive cache settings
  private readonly DEFAULT_TTL = 1800000; // 30 minutes (was 5 minutes)
  private readonly MAX_ENTRIES = 10000;   // Increased from 1000
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private readonly MEMORY_LIMIT = 100 * 1024 * 1024; // 100MB

  constructor() {
    this.startCleanupProcess();
    this.logStats();
  }

  /**
   * Get data from cache or execute fetcher function
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    customTtl?: number
  ): Promise<T> {
    const existing = this.cache.get(key);
    const now = Date.now();

    // Check if cached data is still valid
    if (existing && (now - existing.timestamp) < existing.ttl) {
      existing.hits++;
      existing.lastAccess = now;
      this.stats.hits++;
      
      console.log(`🎯 AGGRESSIVE CACHE HIT: ${key} (${existing.hits} hits, age: ${Math.round((now - existing.timestamp) / 1000)}s)`);
      return existing.data;
    }

    // Cache miss - fetch fresh data
    this.stats.misses++;
    console.log(`❌ AGGRESSIVE CACHE MISS: ${key} - fetching fresh data`);

    try {
      const data = await fetcher();
      this.set(key, data, customTtl);
      return data;
    } catch (error) {
      // If fetch fails and we have stale data, return it
      if (existing) {
        console.warn(`⚠️ AGGRESSIVE CACHE: Using stale data for ${key} due to fetch error`);
        existing.lastAccess = now;
        return existing.data;
      }
      throw error;
    }
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, customTtl?: number): void {
    const now = Date.now();
    const ttl = customTtl || this.DEFAULT_TTL;

    // Check memory usage and evict if necessary
    this.enforceMemoryLimit();

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      hits: 0,
      lastAccess: now,
      ttl
    };

    this.cache.set(key, entry);
    this.stats.sets++;

    console.log(`💾 AGGRESSIVE CACHE SET: ${key} (TTL: ${Math.round(ttl / 1000)}s, total entries: ${this.cache.size})`);
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const isValid = (Date.now() - entry.timestamp) < entry.ttl;
    if (!isValid) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    console.log('🗑️ AGGRESSIVE CACHE: All entries cleared');
  }

  /**
   * Clear entries matching pattern
   */
  clearPattern(pattern: string | RegExp): number {
    let cleared = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        cleared++;
      }
    }

    console.log(`🗑️ AGGRESSIVE CACHE: Cleared ${cleared} entries matching pattern: ${pattern}`);
    return cleared;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const now = Date.now();

    return {
      totalEntries: this.cache.size,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate: this.stats.hits + this.stats.misses > 0 ? 
        (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 : 0,
      memoryUsage: this.estimateMemoryUsage(),
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : now,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : now
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let size = 0;
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2; // UTF-16 characters
      size += JSON.stringify(entry.data).length * 2;
      size += 64; // Overhead for entry metadata
    }
    return size;
  }

  /**
   * Enforce memory limit by evicting least recently used entries
   */
  private enforceMemoryLimit(): void {
    if (this.cache.size < this.MAX_ENTRIES) return;

    const memoryUsage = this.estimateMemoryUsage();
    if (memoryUsage < this.MEMORY_LIMIT) return;

    // Sort by last access time (LRU eviction)
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccess - b.lastAccess);

    // Evict oldest 25% of entries
    const toEvict = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toEvict; i++) {
      this.cache.delete(entries[i][0]);
      this.stats.evictions++;
    }

    console.log(`🗑️ AGGRESSIVE CACHE: Evicted ${toEvict} entries (memory: ${Math.round(memoryUsage / 1024 / 1024)}MB)`);
  }

  /**
   * Start periodic cleanup process
   */
  private startCleanupProcess(): void {
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 AGGRESSIVE CACHE: Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Log statistics periodically
   */
  private logStats(): void {
    setInterval(() => {
      const stats = this.getStats();
      if (stats.totalEntries > 0) {
        console.log(`📊 AGGRESSIVE CACHE STATS:`, {
          entries: stats.totalEntries,
          hitRate: `${stats.hitRate.toFixed(1)}%`,
          memoryMB: `${(stats.memoryUsage / 1024 / 1024).toFixed(1)}MB`,
          totalHits: stats.totalHits,
          totalMisses: stats.totalMisses,
          evictions: this.stats.evictions
        });
      }
    }, 300000); // Log every 5 minutes
  }
}

// Global aggressive cache instance
export const aggressiveCache = new AggressiveCache();

/**
 * Convenience function for caching API responses
 */
export async function cachedApiCall<T>(
  endpoint: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  return aggressiveCache.get(`api:${endpoint}`, fetcher, ttl);
}

/**
 * Convenience function for caching Firebase reads
 */
export async function cachedFirebaseRead<T>(
  collection: string,
  docId: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  return aggressiveCache.get(`firebase:${collection}:${docId}`, fetcher, ttl);
}

/**
 * Convenience function for caching user data
 */
export async function cachedUserData<T>(
  userId: string,
  dataType: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  return aggressiveCache.get(`user:${userId}:${dataType}`, fetcher, ttl);
}

/**
 * Get cache statistics
 */
export const getCacheStats = () => aggressiveCache.getStats();

/**
 * Clear cache by pattern
 */
export const clearCachePattern = (pattern: string | RegExp) => aggressiveCache.clearPattern(pattern);
