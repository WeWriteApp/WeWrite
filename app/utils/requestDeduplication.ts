"use client";

/**
 * Request Deduplication System
 * 
 * Prevents redundant API calls and Firebase operations by:
 * - Deduplicating identical requests within time windows
 * - Caching in-flight requests to prevent duplicate calls
 * - Implementing smart cache invalidation
 * - Providing request coalescing for similar operations
 */

interface PendingRequest<T = any> {
  promise: Promise<T>;
  timestamp: number;
  abortController?: AbortController;
}

interface RequestCacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

class RequestDeduplicationManager {
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCache = new Map<string, RequestCacheEntry>();
  private readonly DEFAULT_DEDUP_WINDOW = 5000; // 5 seconds
  private readonly DEFAULT_CACHE_TTL = 30000; // 30 seconds
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute

  constructor() {
    // Periodic cleanup of expired entries
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    }
  }

  /**
   * Generate a cache key for a request
   */
  private generateKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    const headers = options?.headers ? JSON.stringify(options.headers) : '';
    
    // Create a hash-like key from the request parameters
    return `${method}:${url}:${body}:${headers}`;
  }

  /**
   * Check if a request is already in progress
   */
  private isPending(key: string): boolean {
    const pending = this.pendingRequests.get(key);
    if (!pending) return false;

    const now = Date.now();
    if (now - pending.timestamp > this.DEFAULT_DEDUP_WINDOW) {
      this.pendingRequests.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Check if we have cached data for a request
   */
  private getCachedData<T>(key: string): T | null {
    const cached = this.requestCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.requestCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Cache request result
   */
  private setCachedData<T>(key: string, data: T, ttl: number = this.DEFAULT_CACHE_TTL): void {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Deduplicated fetch with caching
   */
  async fetch<T = any>(
    url: string, 
    options?: RequestInit & { 
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
      skipDedup = false,
      ...fetchOptions
    } = options || {};

    const key = this.generateKey(url, fetchOptions);

    // Check cache first (unless skipped)
    if (!skipCache) {
      const cached = this.getCachedData<T>(key);
      if (cached) {
        console.log(`[RequestDedup] Cache hit for ${url}`);
        return cached;
      }
    }

    // Check if request is already pending (unless skipped)
    if (!skipDedup && this.isPending(key)) {
      console.log(`[RequestDedup] Deduplicating request for ${url}`);
      return this.pendingRequests.get(key)!.promise as Promise<T>;
    }

    // Create new request
    const abortController = new AbortController();
    const promise = this.executeRequest<T>(url, {
      ...fetchOptions,
      signal: abortController.signal
    });

    // Store pending request
    if (!skipDedup) {
      this.pendingRequests.set(key, {
        promise,
        timestamp: Date.now(),
        abortController
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
      // Clean up pending request
      if (!skipDedup) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Execute the actual fetch request
   */
  private async executeRequest<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateCache(pattern?: string | RegExp): void {
    if (!pattern) {
      this.requestCache.clear();
      console.log('[RequestDedup] Cleared all cache');
      return;
    }

    const keysToDelete: string[] = [];
    
    for (const key of this.requestCache.keys()) {
      const matches = typeof pattern === 'string' 
        ? key.includes(pattern)
        : pattern.test(key);
        
      if (matches) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.requestCache.delete(key));
    console.log(`[RequestDedup] Invalidated ${keysToDelete.length} cache entries`);
  }

  /**
   * Cancel pending requests by pattern
   */
  cancelPendingRequests(pattern?: string | RegExp): void {
    const keysToCancel: string[] = [];
    
    for (const [key, pending] of this.pendingRequests.entries()) {
      const matches = !pattern || (typeof pattern === 'string' 
        ? key.includes(pattern)
        : pattern.test(key));
        
      if (matches) {
        pending.abortController?.abort();
        keysToCancel.push(key);
      }
    }

    keysToCancel.forEach(key => this.pendingRequests.delete(key));
    console.log(`[RequestDedup] Cancelled ${keysToCancel.length} pending requests`);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedPending = 0;
    let cleanedCache = 0;

    // Clean up expired pending requests
    for (const [key, pending] of this.pendingRequests.entries()) {
      if (now - pending.timestamp > this.DEFAULT_DEDUP_WINDOW * 2) {
        pending.abortController?.abort();
        this.pendingRequests.delete(key);
        cleanedPending++;
      }
    }

    // Clean up expired cache entries
    for (const [key, cached] of this.requestCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.requestCache.delete(key);
        cleanedCache++;
      }
    }

    if (cleanedPending > 0 || cleanedCache > 0) {
      console.log(`[RequestDedup] Cleanup: ${cleanedPending} pending, ${cleanedCache} cached`);
    }
  }

  /**
   * Get statistics about current state
   */
  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      cachedEntries: this.requestCache.size,
      memoryUsage: {
        pending: this.pendingRequests.size * 100, // rough estimate
        cache: this.requestCache.size * 200 // rough estimate
      }
    };
  }
}

// Global instance
const requestDeduplicationManager = new RequestDeduplicationManager();

/**
 * Deduplicated fetch function
 */
export const deduplicatedFetch = <T = any>(
  url: string,
  options?: RequestInit & {
    cacheTTL?: number;
    dedupWindow?: number;
    skipCache?: boolean;
    skipDedup?: boolean;
  }
): Promise<T> => {
  return requestDeduplicationManager.fetch<T>(url, options);
};

/**
 * Invalidate request cache
 */
export const invalidateRequestCache = (pattern?: string | RegExp): void => {
  requestDeduplicationManager.invalidateCache(pattern);
};

/**
 * Cancel pending requests
 */
export const cancelPendingRequests = (pattern?: string | RegExp): void => {
  requestDeduplicationManager.cancelPendingRequests(pattern);
};

/**
 * Get deduplication statistics
 */
export const getDeduplicationStats = () => {
  return requestDeduplicationManager.getStats();
};

/**
 * Higher-order function to wrap API functions with deduplication
 */
export const withDeduplication = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: {
    keyGenerator?: (...args: Parameters<T>) => string;
    cacheTTL?: number;
    dedupWindow?: number;
  }
): T => {
  const cache = new Map<string, { promise: Promise<any>; timestamp: number }>();
  const { keyGenerator, cacheTTL = 30000, dedupWindow = 5000 } = options || {};

  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    const now = Date.now();

    // Check if we have a pending request
    const existing = cache.get(key);
    if (existing && now - existing.timestamp < dedupWindow) {
      console.log(`[FunctionDedup] Deduplicating function call: ${fn.name}`);
      return existing.promise;
    }

    // Execute function and cache promise
    const promise = fn(...args);
    cache.set(key, { promise, timestamp: now });

    // Clean up after completion
    promise.finally(() => {
      setTimeout(() => cache.delete(key), cacheTTL);
    });

    return promise;
  }) as T;
};
