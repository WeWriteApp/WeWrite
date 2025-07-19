/**
 * Request caching and deduplication system for WeWrite
 * Prevents duplicate API calls and implements intelligent caching
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  promise?: Promise<T>;
}

interface RequestOptions {
  ttl?: number; // Time to live in milliseconds
  forceRefresh?: boolean;
  deduplicate?: boolean;
}

class RequestCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  /**
   * Get cached data or execute request with deduplication
   */
  async get<T>(
    key: string,
    requestFn: () => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const { ttl = this.DEFAULT_TTL, forceRefresh = false, deduplicate = true } = options;
    const now = Date.now();

    // Check if we have valid cached data
    if (!forceRefresh) {
      const cached = this.cache.get(key);
      if (cached && (now - cached.timestamp) < cached.ttl) {
        return cached.data;
      }
    }

    // Check for pending request (deduplication)
    if (deduplicate && this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Execute request
    const requestPromise = this.executeRequest(key, requestFn, ttl);
    
    if (deduplicate) {
      this.pendingRequests.set(key, requestPromise);
    }

    try {
      const result = await requestPromise;
      return result;
    } finally {
      if (deduplicate) {
        this.pendingRequests.delete(key);
      }
    }
  }

  private async executeRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    try {
      const data = await requestFn();
      
      // Cache the result
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl
      });

      // Clean up old entries if cache is getting too large
      this.cleanupCache();

      return data;
    } catch (error) {
      // Don't cache errors, but clean up pending request
      throw error;
    }
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
    for (const key of this.pendingRequests.keys()) {
      if (regex.test(key)) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      entries: Array.from(this.cache.keys())
    };
  }

  private cleanupCache(): void {
    if (this.cache.size <= this.MAX_CACHE_SIZE) return;

    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest entries or expired entries
    const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2));
    for (const [key, entry] of toRemove) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
const requestCache = new RequestCache();

/**
 * Cached version of getPageById with deduplication
 */
export const getCachedPageById = async (
  pageId: string,
  userId?: string,
  options: RequestOptions = {}
) => {
  const { getPageById } = await import('../firebase/database/pages');
  const cacheKey = `page:${pageId}:${userId || 'anonymous'}`;
  
  // DISABLED: No caching to prevent stale data issues
  // return requestCache.get(
  //   cacheKey,
  //   () => getPageById(pageId, userId),
  //   { ttl: 2 * 60 * 1000, ...options } // 2 minute TTL for page data
  // );

  // Always fetch fresh data
  return getPageById(pageId, userId);
};

/**
 * Batch page fetching to reduce individual requests
 */
export const getBatchPages = async (
  pageIds: string[],
  userId?: string
): Promise<Record<string, any>> => {
  const uniquePageIds = [...new Set(pageIds)];
  const results: Record<string, any> = {};
  
  // Check cache first
  const uncachedIds: string[] = [];
  for (const pageId of uniquePageIds) {
    const cacheKey = `page:${pageId}:${userId || 'anonymous'}`;
    const cached = requestCache.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      results[pageId] = cached.data;
    } else {
      uncachedIds.push(pageId);
    }
  }

  // Fetch uncached pages in parallel
  if (uncachedIds.length > 0) {
    const fetchPromises = uncachedIds.map(async (pageId) => {
      try {
        const result = await getCachedPageById(pageId, userId);
        return { pageId, result };
      } catch (error) {
        console.warn(`Failed to fetch page ${pageId}:`, error);
        return { pageId, result: null };
      }
    });

    const fetchResults = await Promise.all(fetchPromises);
    for (const { pageId, result } of fetchResults) {
      results[pageId] = result;
    }
  }

  return results;
};

/**
 * Invalidate page cache when page is updated
 */
export const invalidatePageCache = (pageId: string): void => {
  requestCache.invalidatePattern(`page:${pageId}:`);
};

/**
 * Preload pages that are likely to be accessed
 */
export const preloadPages = async (pageIds: string[], userId?: string): Promise<void> => {
  // Use low priority for preloading
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      getBatchPages(pageIds, userId);
    });
  } else {
    setTimeout(() => {
      getBatchPages(pageIds, userId);
    }, 100);
  }
};

export { requestCache };
export default requestCache;