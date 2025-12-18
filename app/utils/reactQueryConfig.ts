/**
 * React Query Configuration for Maximum Firebase Cost Optimization
 * 
 * Ultra-aggressive caching configuration to minimize Firebase reads
 * and maximize cost efficiency while maintaining data freshness.
 */

import { QueryClient } from '@tanstack/react-query';
import { getReactQueryConfig, UNIFIED_CACHE_TTL } from './serverCache';

// Legacy cache config - now using unified configuration
const CACHE_CONFIG = {
  STATIC_DATA: getReactQueryConfig('static'),
  USER_DATA: getReactQueryConfig('user'),
  PAGE_DATA: getReactQueryConfig('page'),
  ANALYTICS_DATA: getReactQueryConfig('analytics'),
  SEARCH_DATA: getReactQueryConfig('search'),
  REALTIME_DATA: getReactQueryConfig('realtime'),
  DEFAULT: getReactQueryConfig('default')
};

/**
 * Create optimized React Query client for cost reduction
 * Now using unified cache configuration
 */
export const createOptimizedQueryClient = (): QueryClient => {
  const defaultConfig = getReactQueryConfig('default');

  return new QueryClient({
    defaultOptions: {
      queries: {
        // Ultra-aggressive defaults from unified config
        staleTime: defaultConfig.staleTime,
        gcTime: defaultConfig.gcTime,

        // Retry configuration from unified config
        retry: defaultConfig.retry,
        retryDelay: defaultConfig.retryDelay,

        // Reduce network requests
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false,

        // Network mode for offline support
        networkMode: 'online',
      },

      mutations: {
        // EMERGENCY FIX: Disable mutation retries to prevent Firebase quota abuse
        retry: 0,
        retryDelay: 1000,
      },
    },
  });
};

/**
 * Query key factories for consistent caching
 */
export const queryKeys = {
  // User-related queries
  user: (userId: string) => ['user', userId] as const,
  userProfile: (userId: string) => ['user', userId, 'profile'] as const,
  userPages: (userId: string) => ['user', userId, 'pages'] as const,
  userStats: (userId: string) => ['user', userId, 'stats'] as const,
  
  // Page-related queries
  page: (pageId: string) => ['page', pageId] as const,
  pageContent: (pageId: string) => ['page', pageId, 'content'] as const,
  pageMetadata: (pageId: string) => ['page', pageId, 'metadata'] as const,
  pageVersions: (pageId: string) => ['page', pageId, 'versions'] as const,
  
  // Search queries
  search: (term: string, filters?: any) => ['search', term, filters] as const,
  searchUsers: (term: string) => ['search', 'users', term] as const,
  
  // Analytics queries
  analytics: (type: string, params?: any) => ['analytics', type, params] as const,
  globalStats: () => ['analytics', 'global'] as const,
  
  // Activity queries
  recentActivity: (userId?: string) => ['activity', 'recent', userId] as const,
  userActivity: (userId: string) => ['activity', 'user', userId] as const,
  
  // Graph queries
  pageConnections: (pageId: string) => ['graph', 'connections', pageId] as const,
  relatedPages: (pageId: string) => ['graph', 'related', pageId] as const,
};

/**
 * Get cache configuration for specific query types
 */
export const getCacheConfig = (queryType: string) => {
  switch (queryType) {
    case 'static':
    case 'config':
    case 'features':
      return CACHE_CONFIG.STATIC_DATA;
      
    case 'user':
    case 'profile':
    case 'subscription':
      return CACHE_CONFIG.USER_DATA;
      
    case 'page':
    case 'content':
    case 'metadata':
      return CACHE_CONFIG.PAGE_DATA;
      
    case 'analytics':
    case 'stats':
    case 'counters':
      return CACHE_CONFIG.ANALYTICS_DATA;
      
    case 'search':
    case 'results':
      return CACHE_CONFIG.SEARCH_DATA;
      
    case 'activity':
    case 'live':
    case 'realtime':
      return CACHE_CONFIG.REALTIME_DATA;
      
    default:
      return CACHE_CONFIG.DEFAULT;
  }
};

/**
 * Prefetch strategies for common data patterns
 */
export const prefetchStrategies = {
  // Prefetch user data when they visit their profile
  prefetchUserData: async (queryClient: QueryClient, userId: string) => {
    const userConfig = getCacheConfig('user');
    
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.userProfile(userId),
        staleTime: userConfig.staleTime,
        gcTime: userConfig.gcTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.userPages(userId),
        staleTime: userConfig.staleTime,
        gcTime: userConfig.gcTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.userStats(userId),
        staleTime: userConfig.staleTime,
        gcTime: userConfig.gcTime,
      }),
    ]);
  },
  
  // Prefetch page data when hovering over links
  prefetchPageData: async (queryClient: QueryClient, pageId: string) => {
    const pageConfig = getCacheConfig('page');
    
    await queryClient.prefetchQuery({
      queryKey: queryKeys.pageMetadata(pageId),
      staleTime: pageConfig.staleTime,
      gcTime: pageConfig.gcTime,
    });
  },
};

/**
 * Cache invalidation helpers
 */
export const cacheInvalidation = {
  // Invalidate all user-related data
  invalidateUserData: (queryClient: QueryClient, userId: string) => {
    queryClient.invalidateQueries({ queryKey: ['user', userId] });
  },
  
  // Invalidate page data
  invalidatePageData: (queryClient: QueryClient, pageId: string) => {
    queryClient.invalidateQueries({ queryKey: ['page', pageId] });
  },
  
  // Invalidate search results
  invalidateSearchData: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: ['search'] });
  },
  
  // Invalidate analytics data
  invalidateAnalytics: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  },
};

// Export the optimized query client instance
export const optimizedQueryClient = createOptimizedQueryClient();
