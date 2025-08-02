"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { useNavigationCache } from './useNavigationCache';

interface SmartFetchOptions {
  // Enable/disable caching for this request
  enableCache?: boolean;
  // Force refresh even if cached data exists
  forceRefresh?: boolean;
  // Enable background refresh for stale data
  backgroundRefresh?: boolean;
  // Custom cache TTL for this request
  cacheTTL?: number;
  // Debounce rapid requests
  debounceMs?: number;
  // Only fetch when conditions are met
  enabled?: boolean;
}

interface SmartFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isFromCache: boolean;
  lastFetched: number | null;
  refetch: () => Promise<void>;
}

/**
 * Smart data fetching hook that prevents excessive database reads during rapid navigation
 * 
 * Features:
 * - Automatic caching with TTL
 * - Rapid navigation detection
 * - Request deduplication
 * - Background refresh
 * - Conditional fetching
 * - Error handling with retry
 */
export function useSmartDataFetching<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: SmartFetchOptions = {}
): SmartFetchResult<T> {
  const {
    enableCache = true,
    forceRefresh = false,
    backgroundRefresh = true,
    cacheTTL,
    debounceMs = 100,
    enabled = true,
  } = options;
  
  const { user } = useAuth();
  const pathname = usePathname();
  const {
    fetchWithCache,
    getCachedData,
    isRapidNavigating,
    navigationCount,
  } = useNavigationCache(cacheTTL ? { cacheTTL } : {});
  
  // State
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  
  // Refs for cleanup and deduplication
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchKeyRef = useRef<string>('');
  
  // Generate unique fetch key
  const getFetchKey = useCallback(() => {
    return `${key}:${pathname}:${user?.uid || 'anonymous'}`;
  }, [key, pathname, user?.uid]);
  
  // Smart fetch function with all optimizations
  const performFetch = useCallback(async (options: { forceRefresh?: boolean } = {}) => {
    if (!enabled) return;
    
    const fetchKey = getFetchKey();
    
    // Prevent duplicate fetches for the same key
    if (lastFetchKeyRef.current === fetchKey && loading) {
      console.log(`🔄 SKIP: Already fetching ${fetchKey}`);
      return;
    }
    
    // During rapid navigation, be more conservative about fetching
    if (isRapidNavigating && navigationCount > 3 && !options.forceRefresh) {
      // Check if we have any cached data we can use
      const cached = enableCache ? getCachedData(pathname, user?.uid) : null;
      if (cached) {
        console.log(`🚀 RAPID NAV: Using cached data instead of fetching ${fetchKey}`);
        setData(cached);
        setIsFromCache(true);
        setError(null);
        return;
      }
    }
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    lastFetchKeyRef.current = fetchKey;
    setLoading(true);
    setError(null);
    
    try {
      let result: T;
      
      if (enableCache) {
        // Use smart caching
        result = await fetchWithCache(
          pathname,
          async () => {
            // Check if request was aborted
            if (signal.aborted) {
              throw new Error('Request aborted');
            }
            
            console.log(`🌐 SMART FETCH: Loading ${fetchKey}`);
            return await fetcher();
          },
          {
            userId: user?.uid,
            forceRefresh: options.forceRefresh || forceRefresh,
            backgroundRefresh,
          }
        );
        
        setIsFromCache(true);
      } else {
        // Direct fetch without caching
        if (signal.aborted) {
          throw new Error('Request aborted');
        }
        
        console.log(`🌐 DIRECT FETCH: Loading ${fetchKey}`);
        result = await fetcher();
        setIsFromCache(false);
      }
      
      // Check if request was aborted before setting state
      if (!signal.aborted) {
        setData(result);
        setError(null);
        setLastFetched(Date.now());
        console.log(`✅ FETCH SUCCESS: ${fetchKey}`);
      }
    } catch (err) {
      if (!signal.aborted) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error(`❌ FETCH ERROR: ${fetchKey}`, err);
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [
    enabled,
    getFetchKey,
    loading,
    isRapidNavigating,
    navigationCount,
    enableCache,
    getCachedData,
    pathname,
    user?.uid,
    fetchWithCache,
    fetcher,
    forceRefresh,
    backgroundRefresh,
  ]);
  
  // Debounced fetch function
  const debouncedFetch = useCallback((options: { forceRefresh?: boolean } = {}) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      performFetch(options);
    }, debounceMs);
  }, [performFetch, debounceMs]);
  
  // Public refetch function
  const refetch = useCallback(async () => {
    await performFetch({ forceRefresh: true });
  }, [performFetch]);
  
  // Effect to trigger fetch when dependencies change
  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      setError(null);
      setIsFromCache(false);
      setLastFetched(null);
      return;
    }
    
    // Check cache first for immediate response
    if (enableCache) {
      const cached = getCachedData(pathname, user?.uid);
      if (cached) {
        setData(cached);
        setIsFromCache(true);
        setError(null);
        setLastFetched(Date.now());
        
        // Still fetch in background if background refresh is enabled
        if (backgroundRefresh) {
          setTimeout(() => {
            performFetch({ forceRefresh: false });
          }, 50);
        }
        return;
      }
    }
    
    // No cache hit, perform fetch
    if (isRapidNavigating && navigationCount > 2) {
      // During rapid navigation, debounce the fetch
      debouncedFetch();
    } else {
      // Normal navigation, fetch immediately
      performFetch();
    }
    
    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [
    enabled,
    pathname,
    user?.uid,
    enableCache,
    getCachedData,
    backgroundRefresh,
    isRapidNavigating,
    navigationCount,
    debouncedFetch,
    performFetch,
  ]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  return {
    data,
    loading,
    error,
    isFromCache,
    lastFetched,
    refetch,
  };
}

/**
 * Hook for fetching route-specific data with smart caching
 */
export function useRouteData<T>(
  fetcher: () => Promise<T>,
  options: SmartFetchOptions = {}
) {
  const pathname = usePathname();
  return useSmartDataFetching(`route:${pathname}`, fetcher, options);
}

/**
 * Hook for fetching user-specific data with smart caching
 */
export function useUserData<T>(
  dataKey: string,
  fetcher: () => Promise<T>,
  options: SmartFetchOptions = {}
) {
  const { user } = useAuth();
  return useSmartDataFetching(
    `user:${user?.uid}:${dataKey}`,
    fetcher,
    {
      enabled: !!user?.uid,
      ...options,
    }
  );
}

export default useSmartDataFetching;
