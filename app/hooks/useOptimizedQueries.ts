/**
 * Optimized React Query Hooks for Firebase Cost Reduction
 * 
 * Provides intelligent caching and data fetching hooks that minimize
 * Firebase operations while maintaining data freshness.
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys, getCacheConfig, prefetchStrategies } from '../utils/reactQueryConfig';
import { trackOptimizedEvent } from '../utils/analyticsOptimizer';

/**
 * Optimized user profile hook
 */
export function useUserProfile(userId: string, enabled: boolean = true) {
  const config = getCacheConfig('user');
  
  return useQuery({
    queryKey: queryKeys.userProfile(userId),
    queryFn: async () => {
      trackOptimizedEvent({
        eventType: 'user_profile_fetch',
        userId,
        sessionId: 'current',
        timestamp: new Date(),
        properties: { source: 'react_query' }
      });

      const response = await fetch(`/api/users/${userId}/profile`);
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }
      return response.json();
    },
    enabled: enabled && !!userId,
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    retry: (failureCount, error: any) => {
      // Don't retry on 404s
      if (error?.status === 404) return false;
      return failureCount < 2;
    }
  });
}

/**
 * Optimized page data hook
 */
export function usePageData(pageId: string, enabled: boolean = true) {
  const config = getCacheConfig('page');
  
  return useQuery({
    queryKey: queryKeys.page(pageId),
    queryFn: async () => {
      trackOptimizedEvent({
        eventType: 'page_data_fetch',
        pageId,
        sessionId: 'current',
        timestamp: new Date(),
        properties: { source: 'react_query' }
      });

      const response = await fetch(`/api/pages/${pageId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch page data');
      }
      return response.json();
    },
    enabled: enabled && !!pageId,
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    retry: 1
  });
}

/**
 * Optimized page metadata hook (lighter than full page data)
 */
export function usePageMetadata(pageId: string, enabled: boolean = true) {
  const config = getCacheConfig('page');
  
  return useQuery({
    queryKey: queryKeys.pageMetadata(pageId),
    queryFn: async () => {
      const response = await fetch(`/api/pages/${pageId}/metadata`);
      if (!response.ok) {
        throw new Error('Failed to fetch page metadata');
      }
      return response.json();
    },
    enabled: enabled && !!pageId,
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    retry: 1
  });
}

/**
 * Optimized user pages hook with infinite scrolling
 */
export function useUserPages(userId: string, enabled: boolean = true) {
  const config = getCacheConfig('page');
  
  return useInfiniteQuery({
    queryKey: queryKeys.userPages(userId),
    queryFn: async ({ pageParam = null }) => {
      const url = new URL(`/api/users/${userId}/pages`, window.location.origin);
      if (pageParam) {
        url.searchParams.set('cursor', pageParam);
      }
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch user pages');
      }
      return response.json();
    },
    enabled: enabled && !!userId,
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    retry: 1
  });
}

/**
 * Optimized search hook with debouncing
 */
export function useOptimizedSearch(searchTerm: string, enabled: boolean = true) {
  const config = getCacheConfig('search');
  
  return useQuery({
    queryKey: queryKeys.search(searchTerm),
    queryFn: async () => {
      if (!searchTerm.trim()) return { pages: [], users: [] };
      
      trackOptimizedEvent({
        eventType: 'search_query',
        sessionId: 'current',
        timestamp: new Date(),
        properties: { 
          searchTerm: searchTerm.substring(0, 50), // Truncate for privacy
          source: 'react_query' 
        }
      });

      const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      return response.json();
    },
    enabled: enabled && searchTerm.length > 2,
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    retry: 1
  });
}

/**
 * Optimized analytics hook
 */
export function useAnalytics(type: string, params?: any, enabled: boolean = true) {
  const config = getCacheConfig('analytics');
  
  return useQuery({
    queryKey: queryKeys.analytics(type, params),
    queryFn: async () => {
      const url = new URL(`/api/analytics/${type}`, window.location.origin);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.set(key, String(value));
        });
      }
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      return response.json();
    },
    enabled,
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    retry: 1
  });
}

/**
 * Optimized recent edits hook - simplified implementation with short cache for real-time updates
 */
export function useRecentEdits(userId?: string, enabled: boolean = true) {
  // Use very short cache time for recent edits to ensure they update quickly
  const shortCacheConfig = {
    staleTime: 2 * 60 * 1000, // 2 minutes - much shorter than the 30 minute default
    gcTime: 5 * 60 * 1000,    // 5 minutes garbage collection
  };

  return useQuery({
    queryKey: ['recent-edits', userId],
    queryFn: async () => {
      const url = new URL('/api/recent-edits', window.location.origin);
      url.searchParams.set('limit', '20');
      url.searchParams.set('includeOwn', 'false');
      url.searchParams.set('followingOnly', 'false');
      if (userId) {
        url.searchParams.set('userId', userId);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch recent edits');
      }
      return response.json();
    },
    enabled,
    staleTime: shortCacheConfig.staleTime,
    gcTime: shortCacheConfig.gcTime,
    retry: 1,
    // Enable refetch on window focus for recent edits to ensure freshness
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });
}

/**
 * Optimized page connections hook for graph view
 */
export function usePageConnections(pageId: string, enabled: boolean = true) {
  const config = getCacheConfig('page');
  
  return useQuery({
    queryKey: queryKeys.pageConnections(pageId),
    queryFn: async () => {
      const response = await fetch(`/api/pages/${pageId}/connections`);
      if (!response.ok) {
        throw new Error('Failed to fetch page connections');
      }
      return response.json();
    },
    enabled: enabled && !!pageId,
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    retry: 1
  });
}

/**
 * Prefetch user data for faster navigation
 */
export function usePrefetchUserData() {
  const queryClient = useQueryClient();
  
  return {
    prefetchUser: (userId: string) => {
      return prefetchStrategies.prefetchUserData(queryClient, userId);
    },
    prefetchPage: (pageId: string) => {
      return prefetchStrategies.prefetchPageData(queryClient, pageId);
    }
  };
}

/**
 * Cache invalidation hooks
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient();
  
  return {
    invalidateUserData: (userId: string) => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    },
    invalidatePageData: (pageId: string) => {
      queryClient.invalidateQueries({ queryKey: ['page', pageId] });
    },
    invalidateSearchData: () => {
      queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    invalidateAnalytics: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    invalidateActivity: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    }
  };
}

/**
 * Optimized mutation hooks
 */
export function useOptimizedMutations() {
  const queryClient = useQueryClient();
  
  const updatePageMutation = useMutation({
    mutationFn: async ({ pageId, data }: { pageId: string; data: any }) => {
      const response = await fetch(`/api/pages/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update page');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Update cache immediately for better UX
      queryClient.setQueryData(queryKeys.page(variables.pageId), data);
      queryClient.setQueryData(queryKeys.pageMetadata(variables.pageId), data);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user', data.userId, 'pages'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    }
  });

  const updateUserProfileMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) => {
      const response = await fetch(`/api/users/${userId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Update cache immediately
      queryClient.setQueryData(queryKeys.userProfile(variables.userId), data);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
    }
  });

  return {
    updatePage: updatePageMutation,
    updateUserProfile: updateUserProfileMutation
  };
}

/**
 * Get React Query cache statistics
 */
export function useQueryCacheStats() {
  const queryClient = useQueryClient();
  
  return {
    getCacheStats: () => {
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();
      
      return {
        totalQueries: queries.length,
        staleQueries: queries.filter(q => q.isStale()).length,
        fetchingQueries: queries.filter(q => q.isFetching()).length,
        errorQueries: queries.filter(q => q.state.status === 'error').length,
        cacheSize: queries.reduce((size, query) => {
          const data = query.state.data;
          return size + (data ? JSON.stringify(data).length : 0);
        }, 0)
      };
    },
    clearCache: () => {
      queryClient.clear();
    }
  };
}
