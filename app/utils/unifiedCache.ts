/**
 * Unified Cache System
 *
 * Single source of truth for all caching in WeWrite.
 * Replaces the complex multi-layer cache system with a simple, reliable solution.
 *
 * Key principles:
 * 1. Single cache instance
 * 2. Automatic invalidation
 * 3. Simple API
 * 4. Reliable fallbacks
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  tags: string[];
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  tags?: string[]; // Tags for bulk invalidation
}

// Simplified TTL - just two tiers for reliability
const CACHE_TTL = {
  FAST: process.env.NODE_ENV === 'development' ? 30 * 1000 : 60 * 1000, // 30s dev, 1min prod
  SLOW: process.env.NODE_ENV === 'development' ? 60 * 1000 : 5 * 60 * 1000, // 1min dev, 5min prod
} as const;

class UnifiedCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 1000; // Prevent memory leaks

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired (using FAST TTL by default)
    if (Date.now() - entry.timestamp > CACHE_TTL.FAST) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache
   */
  set(key: string, data: any, options: CacheOptions = {}): void {
    // Prevent memory leaks
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      tags: options.tags || []
    });
  }

  /**
   * Invalidate by key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate by tag (bulk invalidation)
   */
  invalidateByTag(tag: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// Singleton instance
export const unifiedCache = new UnifiedCache();

/**
 * Simplified cache wrapper for API calls
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try cache first
  const cached = unifiedCache.get<T>(key);
  if (cached !== null) {
    console.log(`🚀 CACHE HIT: ${key}`);
    return cached;
  }

  // Fetch fresh data
  console.log(`🔄 CACHE MISS: ${key}`);
  try {
    const data = await fetcher();
    unifiedCache.set(key, data, options);
    return data;
  } catch (error) {
    console.error(`❌ CACHE FETCH ERROR: ${key}`, error);
    throw error;
  }
}

/**
 * Simple invalidation for page saves
 * This replaces all the complex cache clearing logic
 */
export function invalidatePageData(pageId: string, userId?: string): void {
  console.log(`🗑️ UNIFIED CACHE: Invalidating all data for page ${pageId}`);

  // Invalidate all page-related data with one call
  unifiedCache.invalidateByTag(`page:${pageId}`);
  unifiedCache.invalidateByTag('recent-edits');
  unifiedCache.invalidateByTag('versions');
  if (userId) {
    unifiedCache.invalidateByTag(`user:${userId}`);
  }

  console.log(`✅ UNIFIED CACHE: Page ${pageId} invalidation complete`);
}

// Auto-cleanup expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const cache = (unifiedCache as any).cache;

    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL.FAST) {
        cache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// Backward compatibility exports for existing code
export const UNIFIED_CACHE_TTL = {
  STATIC_DATA: CACHE_TTL.SLOW,
  USER_DATA: CACHE_TTL.SLOW,
  PAGE_DATA: CACHE_TTL.FAST,
  ANALYTICS_DATA: CACHE_TTL.FAST,
  SEARCH_DATA: CACHE_TTL.FAST,
  SESSION_DATA: CACHE_TTL.SLOW,
  REALTIME_DATA: CACHE_TTL.FAST,
  LIVE_STATS: CACHE_TTL.FAST,
  ACTIVITY_DATA: CACHE_TTL.FAST,
  DEFAULT: CACHE_TTL.FAST
};

export function getReactQueryConfig(queryType: string) {
  return {
    staleTime: CACHE_TTL.FAST,
    gcTime: CACHE_TTL.FAST * 2,
    retry: false, // Disable retries to prevent Firebase quota abuse
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000)
  };
}
