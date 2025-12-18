/**
 * Read Optimizer - Comprehensive solution to reduce Firebase reads
 * 
 * This utility provides aggressive caching, batching, and deduplication
 * to prevent the 33K reads/minute issue with just 1 user online.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

interface BatchRequest {
  key: string;
  resolver: (data: any) => void;
  rejector: (error: any) => void;
  timestamp: number;
}

interface ReadStats {
  totalReads: number;
  cacheHits: number;
  cacheMisses: number;
  batchedRequests: number;
  deduplicatedRequests: number;
  lastReset: number;
}

class ReadOptimizer {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private batchQueue = new Map<string, BatchRequest[]>();
  private stats: ReadStats = {
    totalReads: 0,
    cacheHits: 0,
    cacheMisses: 0,
    batchedRequests: 0,
    deduplicatedRequests: 0,
    lastReset: Date.now()
  };

  // Configuration - REDUCED CACHING TO PREVENT DATA LOSS
  private readonly DEFAULT_CACHE_DURATION = process.env.NODE_ENV === 'development' ? 0 : 30 * 1000; // No cache in dev, 30s in prod
  private readonly AGGRESSIVE_CACHE_DURATION = process.env.NODE_ENV === 'development' ? 0 : 2 * 60 * 1000; // No cache in dev, 2min in prod
  private readonly BATCH_DELAY = 50; // 50ms batch window
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute

  constructor() {
    this.startCacheCleanup();
    this.startStatsMonitoring();
  }

  /**
   * Optimized data fetching with aggressive caching and deduplication
   */
  async optimizedFetch<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: {
      cacheDuration?: number;
      aggressive?: boolean;
      batchable?: boolean;
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<T> {
    const {
      cacheDuration = this.DEFAULT_CACHE_DURATION,
      aggressive = false,
      batchable = false,
      priority = 'medium'
    } = options;

    this.stats.totalReads++;

    // Check cache first
    const cached = this.getFromCache<T>(key);
    if (cached !== null) {
      this.stats.cacheHits++;
      console.log(`[ReadOptimizer] Cache hit for ${key}`);
      return cached;
    }

    this.stats.cacheMisses++;

    // Check for pending request (deduplication)
    const pending = this.pendingRequests.get(key);
    if (pending) {
      this.stats.deduplicatedRequests++;
      console.log(`[ReadOptimizer] Deduplicated request for ${key}`);
      return pending;
    }

    // Create new request
    const requestPromise = this.executeRequest(key, fetchFunction, {
      cacheDuration: aggressive ? this.AGGRESSIVE_CACHE_DURATION : cacheDuration,
      batchable,
      priority
    });

    this.pendingRequests.set(key, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Execute the actual request with caching
   */
  private async executeRequest<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: {
      cacheDuration: number;
      batchable: boolean;
      priority: string;
    }
  ): Promise<T> {
    try {
      console.log(`[ReadOptimizer] Executing request for ${key}`);
      const result = await fetchFunction();
      
      // Cache the result
      this.setCache(key, result, options.cacheDuration);
      
      return result;
    } catch (error) {
      console.error(`[ReadOptimizer] Request failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get data from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = now;

    return entry.data;
  }

  /**
   * Set data in cache
   */
  private setCache<T>(key: string, data: T, duration: number): void {
    const now = Date.now();
    
    // Enforce cache size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldestEntries();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + duration,
      accessCount: 1,
      lastAccessed: now
    });
  }

  /**
   * Evict oldest cache entries
   */
  private evictOldestEntries(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Clear cache for specific patterns
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      console.log('[ReadOptimizer] Cleared entire cache');
      return;
    }

    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(pattern)
    );
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`[ReadOptimizer] Cleared ${keysToDelete.length} cache entries matching "${pattern}"`);
  }

  /**
   * Get optimization stats
   */
  getStats(): ReadStats & { cacheSize: number; cacheHitRate: number } {
    const cacheHitRate = this.stats.totalReads > 0 
      ? (this.stats.cacheHits / this.stats.totalReads) * 100 
      : 0;

    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100
    };
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = {
      totalReads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      batchedRequests: 0,
      deduplicatedRequests: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Start cache cleanup process
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          expiredKeys.push(key);
        }
      }

      expiredKeys.forEach(key => this.cache.delete(key));
      
      if (expiredKeys.length > 0) {
        console.log(`[ReadOptimizer] Cleaned up ${expiredKeys.length} expired cache entries`);
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Monitor stats and alert on high read counts
   */
  private startStatsMonitoring(): void {
    setInterval(() => {
      const stats = this.getStats();
      
      // Alert if read rate is too high
      const timeSinceReset = Date.now() - stats.lastReset;
      const minutesSinceReset = timeSinceReset / (1000 * 60);
      const readsPerMinute = stats.totalReads / minutesSinceReset;

      if (readsPerMinute > 100) {
        console.warn(`🚨 [ReadOptimizer] High read rate detected: ${Math.round(readsPerMinute)} reads/minute`);
        console.warn(`Cache hit rate: ${stats.cacheHitRate}%`);
      }

      // Auto-reset stats every hour
      if (timeSinceReset > 60 * 60 * 1000) {
        this.resetStats();
      }
    }, 30000); // Check every 30 seconds
  }
}

// Singleton instance
const readOptimizer = new ReadOptimizer();

/**
 * Optimized wrapper for page data fetching
 */
export async function getOptimizedPageData(pageId: string, userId?: string) {
  const { cachedQuery } = await import('./serverCache');
  const key = `page:${pageId}:${userId || 'anonymous'}`;

  return cachedQuery(
    key,
    async () => {
      // Use API instead of direct Firebase calls
      const url = userId
        ? `/api/pages/${pageId}?userId=${encodeURIComponent(userId)}`
        : `/api/pages/${pageId}`;

      console.log('🔄 [ReadOptimizer] Fetching page data from:', url);

      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔄 [ReadOptimizer] API error:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          url
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔄 [ReadOptimizer] Page data fetched:', {
        pageId,
        hasData: !!data,
        title: data?.title,
        username: data?.username,
        userId: data?.userId
      });

      return data;
    },
    {
      tags: [`page:${pageId}`, 'pages']
    }
  );
}

/**
 * Optimized wrapper for user data fetching
 */
export async function getOptimizedUserData(userId: string) {
  const cacheKey = `user:${userId}`;

  return readOptimizer.optimizedFetch(
    cacheKey,
    async () => {
      const response = await fetch(`/api/users/${userId}/profile-data`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    {
      cacheDuration: 10 * 60 * 1000, // 10 minutes (user data changes less frequently)
      aggressive: true,
      priority: 'medium'
    }
  );
}

// Export utilities
export { readOptimizer };
export const clearOptimizedCache = (pattern?: string) => readOptimizer.clearCache(pattern);
export const getOptimizationStats = () => readOptimizer.getStats();
