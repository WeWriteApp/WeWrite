"use client";

import { deduplicatedFetch, withDeduplication } from './requestDeduplication';

/**
 * API Deduplication Utilities
 * 
 * Provides higher-level utilities for deduplicating common API patterns
 * and Firebase operations in the WeWrite application.
 */

/**
 * Deduplicated API fetch with common WeWrite patterns
 */
export const apiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit & {
    params?: Record<string, string | number | boolean>;
    cacheTTL?: number;
    skipCache?: boolean;
    skipDedup?: boolean;
  }
): Promise<T> => {
  const { params, ...fetchOptions } = options || {};
  
  // Build URL with query parameters
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  return deduplicatedFetch<T>(url, fetchOptions);
};

/**
 * Deduplicated user data fetching
 */
export const getUserData = withDeduplication(
  async (userId: string): Promise<any> => {
    return apiCall(`/api/users/batch?userId=${userId}`, {
      cacheTTL: 5 * 60 * 1000 // 5 minutes cache for user data
    });
  },
  {
    keyGenerator: (userId: string) => `user:${userId}`,
    cacheTTL: 5 * 60 * 1000,
    dedupWindow: 3000
  }
);

/**
 * Deduplicated batch user data fetching
 */
export const getBatchUserData = withDeduplication(
  async (userIds: string[]): Promise<any> => {
    return apiCall('/api/users/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds }),
      cacheTTL: 3 * 60 * 1000 // 3 minutes cache for batch data
    });
  },
  {
    keyGenerator: (userIds: string[]) => `batch-users:${userIds.sort().join(',')}`,
    cacheTTL: 3 * 60 * 1000,
    dedupWindow: 2000
  }
);

/**
 * Deduplicated page data fetching
 */
export const getPageData = withDeduplication(
  async (pageId: string): Promise<any> => {
    return apiCall(`/api/pages/${pageId}`, {
      cacheTTL: 2 * 60 * 1000 // 2 minutes cache for page data
    });
  },
  {
    keyGenerator: (pageId: string) => `page:${pageId}`,
    cacheTTL: 2 * 60 * 1000,
    dedupWindow: 1000
  }
);

/**
 * Deduplicated search operations
 */
export const searchPages = withDeduplication(
  async (query: string, options?: any): Promise<any> => {
    return apiCall('/api/search-unified', {
      params: { q: query, ...options },
      cacheTTL: 1 * 60 * 1000 // 1 minute cache for search results
    });
  },
  {
    keyGenerator: (query: string, options?: any) => `search:${query}:${JSON.stringify(options || {})}`,
    cacheTTL: 1 * 60 * 1000,
    dedupWindow: 500
  }
);

/**
 * Deduplicated subscription data fetching
 */
export const getSubscriptionData = withDeduplication(
  async (userId: string): Promise<any> => {
    return apiCall(`/api/subscription/${userId}`, {
      cacheTTL: 2 * 60 * 1000 // Reduced to 2 minutes for faster updates
    });
  },
  {
    keyGenerator: (userId: string) => `subscription:${userId}`,
    cacheTTL: 2 * 60 * 1000, // Reduced to 2 minutes for faster updates
    dedupWindow: 3000
  }
);

/**
 * Deduplicated analytics data fetching
 */
export const getAnalyticsData = withDeduplication(
  async (pageId: string, timeRange?: string): Promise<any> => {
    return apiCall('/api/analytics', {
      params: { pageId, timeRange: timeRange || '7d' },
      cacheTTL: 10 * 60 * 1000 // 10 minutes cache for analytics
    });
  },
  {
    keyGenerator: (pageId: string, timeRange?: string) => `analytics:${pageId}:${timeRange || '7d'}`,
    cacheTTL: 10 * 60 * 1000,
    dedupWindow: 5000
  }
);

/**
 * Deduplicated dashboard data fetching
 */
export const getDashboardData = withDeduplication(
  async (userId?: string): Promise<any> => {
    return apiCall('/api/home-dashboard', {
      params: userId ? { userId } : {},
      cacheTTL: 2 * 60 * 1000 // 2 minutes cache for dashboard
    });
  },
  {
    keyGenerator: (userId?: string) => `dashboard:${userId || 'anonymous'}`,
    cacheTTL: 2 * 60 * 1000,
    dedupWindow: 1000
  }
);

/**
 * Utility to invalidate specific API caches
 */
export const invalidateApiCache = (pattern: string | RegExp) => {
  // This would integrate with the request deduplication cache invalidation
  const { invalidateRequestCache } = require('./requestDeduplication');
  invalidateRequestCache(pattern);
};

/**
 * Utility to get API deduplication statistics
 */
export const getApiStats = () => {
  const { getDeduplicationStats } = require('./requestDeduplication');
  return getDeduplicationStats();
};

/**
 * Common cache invalidation patterns for WeWrite
 */
export const CachePatterns = {
  USER_DATA: /user:/,
  PAGE_DATA: /page:/,
  SEARCH_RESULTS: /search:/,
  DASHBOARD: /dashboard:/,
  SUBSCRIPTION: /subscription:/,
  ANALYTICS: /analytics:/,
  ALL: /.*/
};

/**
 * Invalidate cache by common patterns
 */
export const invalidateByPattern = (pattern: keyof typeof CachePatterns) => {
  invalidateApiCache(CachePatterns[pattern]);
};

/**
 * Batch invalidation for related data
 */
export const invalidateUserRelatedData = (userId: string) => {
  invalidateApiCache(new RegExp(`(user|subscription|dashboard):.*${userId}`));
};

export const invalidatePageRelatedData = (pageId: string) => {
  invalidateApiCache(new RegExp(`(page|analytics):.*${pageId}`));
};

/**
 * Smart cache warming for critical data
 */
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

/**
 * Performance monitoring for API calls
 */
export const monitorApiPerformance = () => {
  const stats = getApiStats();
  
  if (stats.pendingRequests > 10) {
    console.warn('[API Dedup] High number of pending requests:', stats.pendingRequests);
  }
  
  if (stats.cachedEntries > 100) {
    console.warn('[API Dedup] Large cache size:', stats.cachedEntries);
  }
  
  return stats;
};

// Auto-monitor in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  setInterval(monitorApiPerformance, 30000); // Monitor every 30 seconds
}
