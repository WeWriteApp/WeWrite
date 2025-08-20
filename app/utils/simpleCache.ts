/**
 * Simple Cache Utility - Consolidates multiple caching implementations
 * 
 * Replaces:
 * - globalCache.ts (complex implementation)
 * - cacheUtils.ts (batch caching)
 * - unifiedCache.ts (over-engineered)
 * - Parts of intelligentCacheWarming.ts
 * 
 * Provides:
 * - Simple in-memory cache
 * - TTL support
 * - Pattern-based invalidation
 * - Memory management
 * - Easy-to-use interface
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  totalItems: number;
  totalSize: number; // rough estimate
  hitRate: number;
  oldestEntry: number;
  newestEntry: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ENTRIES = 1000; // Prevent memory leaks
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = now;
    this.hits++;

    return entry.data;
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const now = Date.now();

    // Enforce max entries limit
    if (this.cache.size >= this.MAX_ENTRIES) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl,
      accessCount: 0,
      lastAccessed: now
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
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
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get multiple items at once
   */
  getMultiple<T>(keys: string[]): Record<string, T | null> {
    const result: Record<string, T | null> = {};
    
    for (const key of keys) {
      result[key] = this.get<T>(key);
    }

    return result;
  }

  /**
   * Set multiple items at once
   */
  setMultiple<T>(items: Record<string, T>, ttl: number = this.DEFAULT_TTL): void {
    for (const [key, data] of Object.entries(items)) {
      this.set(key, data, ttl);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalRequests = this.hits + this.misses;
    
    return {
      totalItems: this.cache.size,
      totalSize: this.cache.size * 200, // rough estimate
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : 0,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : 0
    };
  }

  /**
   * Get keys matching pattern
   */
  getKeys(pattern?: string | RegExp): string[] {
    const keys = Array.from(this.cache.keys());
    
    if (!pattern) return keys;
    
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return keys.filter(key => regex.test(key));
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed time (oldest first)
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    // Remove oldest 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    
    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`🧹 Cache cleanup: removed ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global cache instance
export const cache = new SimpleCache();

/**
 * Cached function wrapper
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Check cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    console.log(`🚀 Cache hit: ${key}`);
    return cached;
  }

  // Execute function and cache result
  console.log(`💸 Cache miss: ${key} - executing function`);
  const result = await fn();
  cache.set(key, result, ttl);
  
  return result;
}

/**
 * Generate cache key from components
 */
export function cacheKey(...parts: (string | number | boolean | undefined | null)[]): string {
  return parts
    .filter(part => part !== undefined && part !== null)
    .map(part => String(part))
    .join(':');
}

/**
 * Common cache patterns for WeWrite
 */
export const CachePatterns = {
  USER: 'user:',
  PAGE: 'page:',
  SEARCH: 'search:',
  DASHBOARD: 'dashboard:',
  SUBSCRIPTION: 'subscription:',
  ANALYTICS: 'analytics:',
  STATS: 'stats:',
  ALL: '.*'
} as const;

/**
 * Convenience functions for common cache operations
 */
export const cacheUtils = {
  // User data
  getUserKey: (userId: string) => cacheKey('user', userId),
  setUser: (userId: string, data: any, ttl?: number) => 
    cache.set(cacheUtils.getUserKey(userId), data, ttl),
  getUser: (userId: string) => 
    cache.get(cacheUtils.getUserKey(userId)),

  // Page data
  getPageKey: (pageId: string) => cacheKey('page', pageId),
  setPage: (pageId: string, data: any, ttl?: number) => 
    cache.set(cacheUtils.getPageKey(pageId), data, ttl),
  getPage: (pageId: string) => 
    cache.get(cacheUtils.getPageKey(pageId)),

  // Dashboard data
  getDashboardKey: (userId?: string) => cacheKey('dashboard', userId || 'anonymous'),
  setDashboard: (data: any, userId?: string, ttl?: number) => 
    cache.set(cacheUtils.getDashboardKey(userId), data, ttl),
  getDashboard: (userId?: string) => 
    cache.get(cacheUtils.getDashboardKey(userId)),

  // Invalidation helpers
  invalidateUser: (userId: string) => cache.invalidate(new RegExp(`user:${userId}`)),
  invalidatePage: (pageId: string) => cache.invalidate(new RegExp(`page:${pageId}`)),
  invalidateUserData: (userId: string) => cache.invalidate(new RegExp(`(user|dashboard|subscription):.*${userId}`)),
  invalidateAll: () => cache.clear()
};

export default cache;
