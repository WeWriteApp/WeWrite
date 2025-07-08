/**
 * Server-side Request Deduplication System
 * 
 * Prevents redundant Firebase operations and API calls on the server by:
 * - Deduplicating identical requests within time windows
 * - Caching in-flight operations to prevent duplicate Firebase calls
 * - Implementing request coalescing for batch operations
 * - Providing memory-efficient cleanup
 */

interface PendingOperation<T = any> {
  promise: Promise<T>;
  timestamp: number;
  requestCount: number;
}

interface OperationCacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
}

class ServerRequestDeduplicationManager {
  private pendingOperations = new Map<string, PendingOperation>();
  private operationCache = new Map<string, OperationCacheEntry>();
  private readonly DEFAULT_DEDUP_WINDOW = 3000; // 3 seconds for server
  private readonly DEFAULT_CACHE_TTL = 60000; // 1 minute for server
  private readonly MAX_CACHE_SIZE = 1000; // Prevent memory bloat
  private readonly CLEANUP_INTERVAL = 120000; // 2 minutes

  constructor() {
    // Periodic cleanup - only in server environment
    if (typeof process !== 'undefined' && process.env) {
      setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    }
  }

  /**
   * Generate a cache key for an operation
   */
  private generateKey(operation: string, params: any): string {
    const paramString = typeof params === 'string' ? params : JSON.stringify(params);
    return `${operation}:${paramString}`;
  }

  /**
   * Check if an operation is already in progress
   */
  private isPending(key: string): PendingOperation | null {
    const pending = this.pendingOperations.get(key);
    if (!pending) return null;

    const now = Date.now();
    if (now - pending.timestamp > this.DEFAULT_DEDUP_WINDOW) {
      this.pendingOperations.delete(key);
      return null;
    }

    return pending;
  }

  /**
   * Check if we have cached data for an operation
   */
  private getCachedData<T>(key: string): T | null {
    const cached = this.operationCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.operationCache.delete(key);
      return null;
    }

    // Update access count and timestamp for LRU
    cached.accessCount++;
    cached.timestamp = now;
    return cached.data;
  }

  /**
   * Cache operation result
   */
  private setCachedData<T>(key: string, data: T, ttl: number = this.DEFAULT_CACHE_TTL): void {
    // Implement LRU eviction if cache is full
    if (this.operationCache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastRecentlyUsed();
    }

    this.operationCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 1
    });
  }

  /**
   * Evict least recently used cache entries
   */
  private evictLeastRecentlyUsed(): void {
    const entries = Array.from(this.operationCache.entries());
    entries.sort((a, b) => {
      // Sort by access count and timestamp
      const scoreA = a[1].accessCount * 1000 + a[1].timestamp;
      const scoreB = b[1].accessCount * 1000 + b[1].timestamp;
      return scoreA - scoreB;
    });

    // Remove bottom 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.operationCache.delete(entries[i][0]);
    }

    console.log(`[ServerDedup] Evicted ${toRemove} cache entries`);
  }

  /**
   * Deduplicated operation execution
   */
  async execute<T>(
    operation: string,
    params: any,
    executor: () => Promise<T>,
    options?: {
      cacheTTL?: number;
      dedupWindow?: number;
      skipCache?: boolean;
      skipDedup?: boolean;
    }
  ): Promise<T> {
    const {
      cacheTTL = this.DEFAULT_CACHE_TTL,
      dedupWindow = this.DEFAULT_DEDUP_WINDOW,
      skipCache = false,
      skipDedup = false
    } = options || {};

    const key = this.generateKey(operation, params);

    // Check cache first (unless skipped)
    if (!skipCache) {
      const cached = this.getCachedData<T>(key);
      if (cached) {
        console.log(`[ServerDedup] Cache hit for ${operation}`);
        return cached;
      }
    }

    // Check if operation is already pending (unless skipped)
    if (!skipDedup) {
      const pending = this.isPending(key);
      if (pending) {
        console.log(`[ServerDedup] Deduplicating operation: ${operation}`);
        pending.requestCount++;
        return pending.promise as Promise<T>;
      }
    }

    // Execute new operation
    const promise = executor();

    // Store pending operation
    if (!skipDedup) {
      this.pendingOperations.set(key, {
        promise,
        timestamp: Date.now(),
        requestCount: 1
      });
    }

    try {
      const result = await promise;
      
      // Cache successful result
      if (!skipCache) {
        this.setCachedData(key, result, cacheTTL);
      }

      return result;
    } catch (error) {
      // Don't cache errors
      throw error;
    } finally {
      // Clean up pending operation
      if (!skipDedup) {
        const pending = this.pendingOperations.get(key);
        if (pending) {
          console.log(`[ServerDedup] Completed ${operation} (${pending.requestCount} requests)`);
        }
        this.pendingOperations.delete(key);
      }
    }
  }

  /**
   * Batch operation deduplication
   */
  async executeBatch<T>(
    operation: string,
    paramsList: any[],
    batchExecutor: (params: any[]) => Promise<T[]>,
    options?: {
      batchSize?: number;
      cacheTTL?: number;
    }
  ): Promise<T[]> {
    const { batchSize = 10, cacheTTL = this.DEFAULT_CACHE_TTL } = options || {};
    const results: T[] = [];
    const uncachedParams: any[] = [];
    const uncachedIndices: number[] = [];

    // Check cache for each parameter set
    for (let i = 0; i < paramsList.length; i++) {
      const key = this.generateKey(operation, paramsList[i]);
      const cached = this.getCachedData<T>(key);
      
      if (cached) {
        results[i] = cached;
      } else {
        uncachedParams.push(paramsList[i]);
        uncachedIndices.push(i);
      }
    }

    // Execute batch operations for uncached items
    if (uncachedParams.length > 0) {
      const batchResults = await batchExecutor(uncachedParams);
      
      // Cache results and populate final results array
      for (let i = 0; i < batchResults.length; i++) {
        const originalIndex = uncachedIndices[i];
        const key = this.generateKey(operation, uncachedParams[i]);
        
        this.setCachedData(key, batchResults[i], cacheTTL);
        results[originalIndex] = batchResults[i];
      }
    }

    console.log(`[ServerDedup] Batch ${operation}: ${paramsList.length - uncachedParams.length} cached, ${uncachedParams.length} executed`);
    return results;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateCache(pattern?: string | RegExp): void {
    if (!pattern) {
      this.operationCache.clear();
      console.log('[ServerDedup] Cleared all cache');
      return;
    }

    const keysToDelete: string[] = [];
    
    for (const key of this.operationCache.keys()) {
      const matches = typeof pattern === 'string' 
        ? key.includes(pattern)
        : pattern.test(key);
        
      if (matches) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.operationCache.delete(key));
    console.log(`[ServerDedup] Invalidated ${keysToDelete.length} cache entries`);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedPending = 0;
    let cleanedCache = 0;

    // Clean up expired pending operations
    for (const [key, pending] of this.pendingOperations.entries()) {
      if (now - pending.timestamp > this.DEFAULT_DEDUP_WINDOW * 3) {
        this.pendingOperations.delete(key);
        cleanedPending++;
      }
    }

    // Clean up expired cache entries
    for (const [key, cached] of this.operationCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.operationCache.delete(key);
        cleanedCache++;
      }
    }

    if (cleanedPending > 0 || cleanedCache > 0) {
      console.log(`[ServerDedup] Cleanup: ${cleanedPending} pending, ${cleanedCache} cached`);
    }
  }

  /**
   * Get statistics about current state
   */
  getStats() {
    const cacheEntries = Array.from(this.operationCache.values());
    const totalAccess = cacheEntries.reduce((sum, entry) => sum + entry.accessCount, 0);
    
    return {
      pendingOperations: this.pendingOperations.size,
      cachedEntries: this.operationCache.size,
      totalCacheAccess: totalAccess,
      averageAccessCount: cacheEntries.length > 0 ? totalAccess / cacheEntries.length : 0,
      memoryUsage: {
        pending: this.pendingOperations.size * 150, // rough estimate
        cache: this.operationCache.size * 300 // rough estimate
      }
    };
  }
}

// Global instance for server-side deduplication
const serverDeduplicationManager = new ServerRequestDeduplicationManager();

/**
 * Execute a deduplicated server operation
 */
export const executeDeduplicatedOperation = <T>(
  operation: string,
  params: any,
  executor: () => Promise<T>,
  options?: {
    cacheTTL?: number;
    dedupWindow?: number;
    skipCache?: boolean;
    skipDedup?: boolean;
  }
): Promise<T> => {
  return serverDeduplicationManager.execute(operation, params, executor, options);
};

/**
 * Execute a deduplicated batch operation
 */
export const executeDeduplicatedBatch = <T>(
  operation: string,
  paramsList: any[],
  batchExecutor: (params: any[]) => Promise<T[]>,
  options?: {
    batchSize?: number;
    cacheTTL?: number;
  }
): Promise<T[]> => {
  return serverDeduplicationManager.executeBatch(operation, paramsList, batchExecutor, options);
};

/**
 * Invalidate server operation cache
 */
export const invalidateServerCache = (pattern?: string | RegExp): void => {
  serverDeduplicationManager.invalidateCache(pattern);
};

/**
 * Get server deduplication statistics
 */
export const getServerDeduplicationStats = () => {
  return serverDeduplicationManager.getStats();
};
