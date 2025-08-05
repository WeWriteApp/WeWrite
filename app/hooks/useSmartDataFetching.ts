"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSimpleNavigationOptimizer } from '../components/navigation/SimpleNavigationOptimizer';

interface SmartDataFetchingOptions {
  /** Cache duration in milliseconds (default: 30 seconds) */
  cacheDuration?: number;
  /** Whether to skip fetching during rapid navigation (default: true) */
  skipDuringRapidNav?: boolean;
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceDelay?: number;
  /** Whether to refetch when navigation settles (default: true) */
  refetchOnNavigationSettle?: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

interface SmartDataFetchingResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  clearCache: () => void;
}

// Global cache to persist across component unmounts
const globalCache = new Map<string, CacheEntry<any>>();

/**
 * Smart data fetching hook that optimizes API calls during navigation
 * 
 * Features:
 * - Caches data to prevent redundant API calls
 * - Debounces requests during rapid navigation
 * - Skips non-critical requests during rapid navigation
 * - Automatically refetches when navigation settles
 * - Global cache shared across components
 */
export function useSmartDataFetching<T>(
  fetchFunction: () => Promise<T>,
  cacheKey: string,
  options: SmartDataFetchingOptions = {}
): SmartDataFetchingResult<T> {
  const {
    cacheDuration = 300000, // 🚨 EMERGENCY: 5 minutes (was 30 seconds) to reduce database reads
    skipDuringRapidNav = true,
    debounceDelay = 300,
    refetchOnNavigationSettle = true
  } = options;

  const { isRapidNavigating } = useSimpleNavigationOptimizer();
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFetchTimeRef = useRef<number>(0);
  const wasRapidNavigatingRef = useRef(false);
  
  // Check if cached data is still valid
  const getCachedData = useCallback((): T | null => {
    const cached = globalCache.get(cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > cacheDuration;
    if (isExpired) {
      globalCache.delete(cacheKey);
      return null;
    }
    
    return cached.data;
  }, [cacheKey, cacheDuration]);
  
  // Perform the actual fetch
  const performFetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await fetchFunction();
      
      // Cache the result
      globalCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        key: cacheKey
      });
      
      setData(result);
      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Fetch failed');
      setError(error);
      console.error(`Smart fetch error for ${cacheKey}:`, error);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, cacheKey]);
  
  // Debounced fetch function
  const debouncedFetch = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    // Use longer delay during rapid navigation
    const actualDelay = isRapidNavigating ? debounceDelay * 2 : debounceDelay;
    
    fetchTimeoutRef.current = setTimeout(() => {
      performFetch();
    }, actualDelay);
  }, [performFetch, isRapidNavigating, debounceDelay]);
  
  // Manual refetch function
  const refetch = useCallback(() => {
    // Clear cache for this key
    globalCache.delete(cacheKey);
    performFetch();
  }, [cacheKey, performFetch]);
  
  // Clear cache function
  const clearCache = useCallback(() => {
    globalCache.delete(cacheKey);
    setData(null);
  }, [cacheKey]);
  
  // Main effect for data fetching
  useEffect(() => {
    // Check cache first
    const cachedData = getCachedData();
    if (cachedData) {
      setData(cachedData);
      return;
    }
    
    // Skip fetch during rapid navigation if configured
    if (skipDuringRapidNav && isRapidNavigating) {
      console.log(`⏸️ SMART FETCH: Skipping fetch for ${cacheKey} during rapid navigation`);
      return;
    }
    
    // Debounce the fetch
    debouncedFetch();
    
    // Cleanup timeout on unmount or dependency change
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [cacheKey, getCachedData, skipDuringRapidNav, isRapidNavigating, debouncedFetch]);
  
  // Effect to refetch when navigation settles
  useEffect(() => {
    const wasRapidNav = wasRapidNavigatingRef.current;
    wasRapidNavigatingRef.current = isRapidNavigating;
    
    // If we just exited rapid navigation mode and should refetch
    if (wasRapidNav && !isRapidNavigating && refetchOnNavigationSettle) {
      const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
      
      // Only refetch if it's been a while since last fetch
      if (timeSinceLastFetch > debounceDelay) {
        console.log(`🔄 SMART FETCH: Refetching ${cacheKey} after navigation settled`);
        debouncedFetch();
      }
    }
  }, [isRapidNavigating, refetchOnNavigationSettle, debounceDelay, debouncedFetch, cacheKey]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    data,
    loading,
    error,
    refetch,
    clearCache
  };
}

/**
 * Hook for smart caching without automatic fetching
 */
export function useSmartCache<T>(cacheKey: string, cacheDuration: number = 30000) {
  const getCachedData = useCallback((): T | null => {
    const cached = globalCache.get(cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > cacheDuration;
    if (isExpired) {
      globalCache.delete(cacheKey);
      return null;
    }
    
    return cached.data;
  }, [cacheKey, cacheDuration]);
  
  const setCachedData = useCallback((data: T) => {
    globalCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      key: cacheKey
    });
  }, [cacheKey]);
  
  const clearCache = useCallback(() => {
    globalCache.delete(cacheKey);
  }, [cacheKey]);
  
  return {
    getCachedData,
    setCachedData,
    clearCache
  };
}

/**
 * Clear all cached data
 */
export function clearAllCache() {
  globalCache.clear();
}
