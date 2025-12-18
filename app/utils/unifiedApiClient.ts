/**
 * Unified API Client - Consolidates multiple overlapping API utilities
 *
 * Replaces:
 * - apiDeduplication.ts
 * - requestDeduplication.ts (client-side parts)
 * - serverRequestDeduplication.ts (shared logic)
 * - batchQueryOptimizer.ts (query deduplication)
 *
 * Provides:
 * - Single API client with deduplication
 * - Unified caching strategy
 * - Circuit breaker pattern for fault tolerance
 * - Consistent error handling
 * - Simple, maintainable interface
 */

import { circuitBreaker } from './firebaseCircuitBreaker';

interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
  cacheTTL?: number;
  skipCache?: boolean;
  skipDedup?: boolean;
  timeout?: number;
}

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
  abortController: AbortController;
}

class UnifiedApiClient {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_DEDUP_WINDOW = 3000; // 3 seconds
  private readonly DEFAULT_TIMEOUT = 8000; // 8 seconds (reduced from 10)

  /**
   * Generate cache key from request parameters
   */
  private generateKey(url: string, options?: ApiOptions): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    const params = options?.params ? JSON.stringify(options.params) : '';
    return `${method}:${url}:${body}:${params}`;
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
    if (!params) return endpoint;

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    if (!queryString) return endpoint;

    return endpoint + (endpoint.includes('?') ? '&' : '?') + queryString;
  }

  /**
   * Check cache for existing data
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache
   */
  private setCached<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Check if request is already pending
   */
  private getPending(key: string): Promise<any> | null {
    const pending = this.pendingRequests.get(key);
    if (!pending) return null;

    const now = Date.now();
    if (now - pending.timestamp > this.DEFAULT_DEDUP_WINDOW) {
      pending.abortController.abort();
      this.pendingRequests.delete(key);
      return null;
    }

    return pending.promise;
  }

  /**
   * Execute HTTP request with timeout and circuit breaker
   */
  private async executeRequest<T>(url: string, options: ApiOptions): Promise<T> {
    const { timeout = this.DEFAULT_TIMEOUT, ...fetchOptions } = options;

    // Use circuit breaker for critical API endpoints
    const circuitKey = this.getCircuitKey(url);

    return await circuitBreaker.execute(
      circuitKey,
      async () => {
        const abortController = new AbortController();
        let isTimeoutAbort = false;
        const timeoutId = setTimeout(() => {
          isTimeoutAbort = true;
          abortController.abort();
        }, timeout);

        try {
          const response = await fetch(url, {
            ...fetchOptions,
            signal: abortController.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);

          // Handle AbortError with better messaging
          if (error instanceof Error && error.name === 'AbortError') {
            if (isTimeoutAbort) {
              throw new Error(`Request timeout after ${timeout}ms: ${url}`);
            } else {
              throw new Error(`Request was cancelled: ${url}`);
            }
          }

          throw error;
        }
      },
      // Fallback for critical endpoints
      this.shouldUseFallback(url) ? () => this.getFallbackResponse<T>(url) : undefined
    );
  }

  /**
   * Generate circuit breaker key from URL
   */
  private getCircuitKey(url: string): string {
    // Extract endpoint pattern for circuit breaker grouping
    const urlObj = new URL(url, 'http://localhost');
    const path = urlObj.pathname;

    // Group similar endpoints together
    if (path.includes('/api/users/') && path.includes('/profile')) {
      return 'user-profile';
    }
    if (path.includes('/api/users/') && path.includes('/pages')) {
      return 'user-pages';
    }
    if (path.includes('/api/pages/')) {
      return 'pages';
    }

    return path.split('/').slice(0, 3).join('/'); // Group by first 3 path segments
  }

  /**
   * Check if endpoint should have fallback
   */
  private shouldUseFallback(url: string): boolean {
    return url.includes('/api/users/') && (url.includes('/profile') || url.includes('/pages'));
  }

  /**
   * Get fallback response for critical endpoints
   */
  private async getFallbackResponse<T>(url: string): Promise<T> {
    console.warn('🔄 Using fallback response for:', url);

    if (url.includes('/profile')) {
      return {
        success: false,
        error: 'Profile temporarily unavailable',
        data: null
      } as T;
    }

    if (url.includes('/pages')) {
      return {
        success: false,
        error: 'Pages temporarily unavailable',
        data: { pages: [], hasMore: false, total: 0 }
      } as T;
    }

    throw new Error('Service temporarily unavailable');
  }

  /**
   * Main API call method
   */
  async call<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const {
      params,
      cacheTTL = this.DEFAULT_CACHE_TTL,
      skipCache = false,
      skipDedup = false,
      ...fetchOptions
    } = options;

    const url = this.buildUrl(endpoint, params);
    const key = this.generateKey(url, options);

    // Check cache first
    if (!skipCache) {
      const cached = this.getCached<T>(key);
      if (cached !== null) {
        console.log(`🚀 API Cache hit: ${endpoint}`);
        return cached;
      }
    }

    // Check for pending request
    if (!skipDedup) {
      const pending = this.getPending(key);
      if (pending) {
        console.log(`🔄 API Deduplicating: ${endpoint}`);
        return pending as Promise<T>;
      }
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
        this.setCached(key, result, cacheTTL);
      }

      return result;
    } catch (error) {
      // Log API errors for debugging
      console.error(`🚨 API Error [${endpoint}]:`, error);

      // Re-throw the error so calling code can handle it
      throw error;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Convenience methods for common HTTP verbs
   */
  get<T = any>(endpoint: string, options?: Omit<ApiOptions, 'method'>): Promise<T> {
    return this.call<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T = any>(endpoint: string, data?: any, options?: Omit<ApiOptions, 'method' | 'body'>): Promise<T> {
    return this.call<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });
  }

  put<T = any>(endpoint: string, data?: any, options?: Omit<ApiOptions, 'method' | 'body'>): Promise<T> {
    return this.call<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });
  }

  delete<T = any>(endpoint: string, options?: Omit<ApiOptions, 'method'>): Promise<T> {
    return this.call<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Cache management
   */
  invalidateCache(pattern?: string | RegExp): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Cancel pending requests
   */
  cancelPendingRequests(pattern?: string | RegExp): void {
    if (!pattern) {
      for (const pending of this.pendingRequests.values()) {
        pending.abortController.abort();
      }
      this.pendingRequests.clear();
      return;
    }

    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const [key, pending] of this.pendingRequests.entries()) {
      if (regex.test(key)) {
        pending.abortController.abort();
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      memoryUsage: {
        cache: this.cache.size * 200, // rough estimate
        pending: this.pendingRequests.size * 100
      }
    };
  }
}

// Global instance
export const apiClient = new UnifiedApiClient();

// Common cache invalidation patterns
export const CachePatterns = {
  USER_DATA: /user:/,
  PAGE_DATA: /page:/,
  SEARCH_RESULTS: /search:/,
  DASHBOARD: /dashboard:/,
  SUBSCRIPTION: /subscription:/,
  ANALYTICS: /analytics:/,
  ALL: /.*/
} as const;

// Convenience functions for common operations
export const getUserData = (userId: string) => 
  apiClient.get(`/api/users/batch?userId=${userId}`, { cacheTTL: 5 * 60 * 1000 });

export const getPageData = (pageId: string) => 
  apiClient.get(`/api/pages/${pageId}`, { cacheTTL: 2 * 60 * 1000 });

export const getDashboardData = (userId?: string) => 
  apiClient.get('/api/home-dashboard', { 
    params: userId ? { userId } : {},
    cacheTTL: 2 * 60 * 1000 
  });

export const getSubscriptionData = (userId: string) =>
  apiClient.get(`/api/subscription/${userId}`, { cacheTTL: 10 * 60 * 1000 });

// Additional convenience functions from apiDeduplication.ts
export const getBatchUserData = (userIds: string[]) =>
  apiClient.post('/api/users/batch', { userIds }, { cacheTTL: 3 * 60 * 1000 });

export const searchPages = (query: string, options?: any) =>
  apiClient.get('/api/search-unified', {
    params: { q: query, ...options },
    cacheTTL: 1 * 60 * 1000
  });

// Cache invalidation helpers
export const invalidateUserRelatedData = (userId: string) => {
  apiClient.invalidateCache(new RegExp(`(user|subscription|dashboard):.*${userId}`));
};

export const invalidatePageRelatedData = (pageId: string) => {
  apiClient.invalidateCache(new RegExp(`(page|analytics):.*${pageId}`));
};

// Smart cache warming for critical data
export const warmCriticalCaches = async (userId?: string) => {
  if (userId) {
    // Warm user-specific caches
    Promise.all([
      getDashboardData(userId).catch(() => {}),
      getUserData(userId).catch(() => {}),
      getSubscriptionData(userId).catch(() => {})
    ]);
  } else {
    // Warm anonymous caches
    getDashboardData().catch(() => {});
  }
};
