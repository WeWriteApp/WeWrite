/**
 * Optimized Caching System
 * 
 * Consolidates all caching utilities into a single, efficient system that:
 * - Reduces redundant cache implementations
 * - Provides intelligent cache warming and invalidation
 * - Optimizes memory usage with LRU eviction
 * - Supports both memory and persistent storage
 * - Includes cache analytics for monitoring
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxMemoryEntries: number;
  defaultTTL: number;
  persistentStorage: boolean;
  keyPrefix: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalEntries: number;
  memoryUsage: number;
}

/**
 * Optimized cache manager with LRU eviction and analytics
 */
export class OptimizedCache<T = any> {
  private memoryCache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalEntries: 0,
    memoryUsage: 0
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxMemoryEntries: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      persistentStorage: true,
      keyPrefix: 'cache',
      ...config
    };

    // Cleanup expired entries periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), 60000); // Every minute
    }
  }

  /**
   * Get cached data with LRU tracking
   */
  get(key: string, userId?: string): T | null {
    const cacheKey = userId ? `${key}:${userId}` : key;
    const now = Date.now();

    // Check memory cache first
    const entry = this.memoryCache.get(cacheKey);
    if (entry) {
      if (this.isExpired(entry, now)) {
        this.memoryCache.delete(cacheKey);
        this.stats.misses++;
        return this.getPersistent(cacheKey);
      }

      // Update access tracking for LRU
      entry.accessCount++;
      entry.lastAccessed = now;
      this.stats.hits++;
      return entry.data;
    }

    this.stats.misses++;
    return this.getPersistent(cacheKey);
  }

  /**
   * Set cached data with intelligent eviction
   */
  set(key: string, data: T, ttl?: number, userId?: string): void {
    const cacheKey = userId ? `${key}:${userId}` : key;
    const now = Date.now();
    const cacheTTL = ttl || this.config.defaultTTL;

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: cacheTTL,
      accessCount: 1,
      lastAccessed: now
    };

    // Evict if at capacity
    if (this.memoryCache.size >= this.config.maxMemoryEntries) {
      this.evictLRU();
    }

    this.memoryCache.set(cacheKey, entry);
    this.stats.totalEntries = this.memoryCache.size;

    // Store in persistent cache if enabled
    if (this.config.persistentStorage) {
      this.setPersistent(cacheKey, data, cacheTTL);
    }
  }

  /**
   * Batch set multiple entries efficiently
   */
  setBatch(entries: Array<{ key: string; data: T; ttl?: number; userId?: string }>): void {
    const now = Date.now();
    
    entries.forEach(({ key, data, ttl, userId }) => {
      const cacheKey = userId ? `${key}:${userId}` : key;
      const cacheTTL = ttl || this.config.defaultTTL;

      const entry: CacheEntry<T> = {
        data,
        timestamp: now,
        ttl: cacheTTL,
        accessCount: 1,
        lastAccessed: now
      };

      // Evict if needed
      if (this.memoryCache.size >= this.config.maxMemoryEntries) {
        this.evictLRU();
      }

      this.memoryCache.set(cacheKey, entry);

      // Store in persistent cache
      if (this.config.persistentStorage) {
        this.setPersistent(cacheKey, data, cacheTTL);
      }
    });

    this.stats.totalEntries = this.memoryCache.size;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern: RegExp | string): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        if (this.config.persistentStorage) {
          this.removePersistent(key);
        }
      }
    }

    this.stats.totalEntries = this.memoryCache.size;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.memoryCache.clear();
    this.stats.totalEntries = 0;
    this.stats.evictions = 0;

    if (this.config.persistentStorage && typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`${this.config.keyPrefix}:`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(warmingFunction: () => Promise<Array<{ key: string; data: T; userId?: string }>>): Promise<void> {
    try {
      const entries = await warmingFunction();
      this.setBatch(entries);
      console.log(`[OptimizedCache] Warmed cache with ${entries.length} entries`);
    } catch (error) {
      console.error('[OptimizedCache] Cache warming failed:', error);
    }
  }

  // Private methods

  private isExpired(entry: CacheEntry<T>, now: number): boolean {
    return now > entry.timestamp + entry.ttl;
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private getPersistent(key: string): T | null {
    if (!this.config.persistentStorage || typeof window === 'undefined') {
      return null;
    }

    try {
      const item = localStorage.getItem(`${this.config.keyPrefix}:${key}`);
      if (!item) return null;

      const cached = JSON.parse(item);
      const now = Date.now();

      if (now > cached.timestamp + cached.ttl) {
        localStorage.removeItem(`${this.config.keyPrefix}:${key}`);
        return null;
      }

      // Restore to memory cache
      this.memoryCache.set(key, {
        data: cached.data,
        timestamp: cached.timestamp,
        ttl: cached.ttl,
        accessCount: 1,
        lastAccessed: now
      });

      this.stats.hits++;
      return cached.data;
    } catch (error) {
      console.warn('[OptimizedCache] Persistent cache read error:', error);
      return null;
    }
  }

  private setPersistent(key: string, data: T, ttl: number): void {
    if (!this.config.persistentStorage || typeof window === 'undefined') {
      return;
    }

    try {
      const item = {
        data,
        timestamp: Date.now(),
        ttl
      };
      localStorage.setItem(`${this.config.keyPrefix}:${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn('[OptimizedCache] Persistent cache write error:', error);
    }
  }

  private removePersistent(key: string): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${this.config.keyPrefix}:${key}`);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry, now)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.memoryCache.delete(key);
      if (this.config.persistentStorage) {
        this.removePersistent(key);
      }
    });

    if (keysToDelete.length > 0) {
      this.stats.totalEntries = this.memoryCache.size;
      console.log(`[OptimizedCache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }
}

// Global cache instances for different data types
export const userDataCache = new OptimizedCache({
  keyPrefix: 'user',
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxMemoryEntries: 500
});

export const pageDataCache = new OptimizedCache({
  keyPrefix: 'page',
  defaultTTL: 2 * 60 * 1000, // 2 minutes
  maxMemoryEntries: 1000
});

export const financialDataCache = new OptimizedCache({
  keyPrefix: 'financial',
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxMemoryEntries: 100
});

export const searchCache = new OptimizedCache({
  keyPrefix: 'search',
  defaultTTL: 10 * 60 * 1000, // 10 minutes
  maxMemoryEntries: 200
});
