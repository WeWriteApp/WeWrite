"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { getCacheItem, setCacheItem, generateCacheKey } from '../utils/cacheUtils';

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

export interface UsePaginatedDataOptions {
  pageSize?: number;
  cacheKey?: string;
  cacheTTL?: number;
  enableCache?: boolean;
  autoLoad?: boolean;
}

export interface UsePaginatedDataReturn<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  total: number | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook for efficient cursor-based pagination with caching
 */
export function usePaginatedData<T>(
  fetchFn: (cursor?: string, pageSize?: number) => Promise<PaginatedResult<T>>,
  options: UsePaginatedDataOptions = {}
): UsePaginatedDataReturn<T> {
  const {
    pageSize = 20,
    cacheKey,
    cacheTTL = 5 * 60 * 1000, // 5 minutes
    enableCache = true,
    autoLoad = true
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | null>(null);
  
  const cursorRef = useRef<string | undefined>();
  const isInitialLoadRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load initial data with caching support
   */
  const loadInitialData = useCallback(async (useCache = true) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      
      // Check cache first
      if (enableCache && useCache && cacheKey) {
        const cachedResult = getCacheItem<PaginatedResult<T>>(
          generateCacheKey('paginatedData', cacheKey)
        );
        
        if (cachedResult) {
          console.log(`usePaginatedData: Using cached data for ${cacheKey}`);
          setData(cachedResult.data);
          setHasMore(cachedResult.hasMore);
          setTotal(cachedResult.total || null);
          cursorRef.current = cachedResult.nextCursor;
          setLoading(false);
          return;
        }
      }
      
      // Fetch fresh data
      console.log(`usePaginatedData: Fetching initial data for ${cacheKey || 'unknown'}`);
      const result = await fetchFn(undefined, pageSize);
      
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      setData(result.data);
      setHasMore(result.hasMore);
      setTotal(result.total || null);
      cursorRef.current = result.nextCursor;
      
      // Cache the result
      if (enableCache && cacheKey) {
        setCacheItem(
          generateCacheKey('paginatedData', cacheKey),
          result,
          cacheTTL
        );
      }
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled
      }
      
      console.error('Error loading initial data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setData([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      isInitialLoadRef.current = false;
    }
  }, [fetchFn, pageSize, enableCache, cacheKey, cacheTTL]);

  /**
   * Load more data (pagination)
   */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursorRef.current) {
      return;
    }
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setLoadingMore(true);
      setError(null);
      
      console.log(`usePaginatedData: Loading more data from cursor ${cursorRef.current}`);
      const result = await fetchFn(cursorRef.current, pageSize);
      
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      setData(prevData => [...prevData, ...result.data]);
      setHasMore(result.hasMore);
      setTotal(result.total || null);
      cursorRef.current = result.nextCursor;
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled
      }
      
      console.error('Error loading more data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more data');
    } finally {
      setLoadingMore(false);
    }
  }, [fetchFn, pageSize, loadingMore, hasMore]);

  /**
   * Refresh data (force reload)
   */
  const refresh = useCallback(async () => {
    cursorRef.current = undefined;
    isInitialLoadRef.current = true;
    await loadInitialData(false); // Don't use cache
  }, [loadInitialData]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setData([]);
    setLoading(false);
    setLoadingMore(false);
    setError(null);
    setHasMore(true);
    setTotal(null);
    cursorRef.current = undefined;
    isInitialLoadRef.current = true;
  }, []);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && isInitialLoadRef.current) {
      loadInitialData();
    }
  }, [autoLoad, loadInitialData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading,
    loadingMore,
    error,
    hasMore,
    total,
    loadMore,
    refresh,
    reset
  };
}

/**
 * Hook for infinite scroll with intersection observer
 */
export function useInfiniteScroll<T>(
  fetchFn: (cursor?: string, pageSize?: number) => Promise<PaginatedResult<T>>,
  options: UsePaginatedDataOptions & { threshold?: number } = {}
) {
  const { threshold = 0.1, ...paginatedOptions } = options;
  const paginatedData = usePaginatedData(fetchFn, paginatedOptions);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingElementRef = useRef<HTMLDivElement | null>(null);

  // Set up intersection observer
  useEffect(() => {
    if (!loadingElementRef.current || paginatedData.loading || paginatedData.loadingMore || !paginatedData.hasMore) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          paginatedData.loadMore();
        }
      },
      { threshold }
    );

    observerRef.current.observe(loadingElementRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [paginatedData.loading, paginatedData.loadingMore, paginatedData.hasMore, paginatedData.loadMore, threshold]);

  return {
    ...paginatedData,
    loadingElementRef
  };
}

/**
 * Hook for virtual scrolling (for very large datasets)
 */
export function useVirtualizedPagination<T>(
  fetchFn: (cursor?: string, pageSize?: number) => Promise<PaginatedResult<T>>,
  options: UsePaginatedDataOptions & { 
    itemHeight?: number;
    containerHeight?: number;
    overscan?: number;
  } = {}
) {
  const {
    itemHeight = 50,
    containerHeight = 400,
    overscan = 5,
    ...paginatedOptions
  } = options;

  const paginatedData = usePaginatedData(fetchFn, {
    ...paginatedOptions,
    pageSize: Math.max(paginatedOptions.pageSize || 20, Math.ceil(containerHeight / itemHeight) * 2)
  });

  const [scrollTop, setScrollTop] = useState(0);

  const visibleItemsCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    paginatedData.data.length - 1,
    startIndex + visibleItemsCount + overscan * 2
  );

  const visibleItems = paginatedData.data.slice(startIndex, endIndex + 1);
  const totalHeight = paginatedData.data.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  // Auto-load more when approaching the end
  useEffect(() => {
    const remainingItems = paginatedData.data.length - endIndex;
    if (remainingItems < visibleItemsCount && paginatedData.hasMore && !paginatedData.loadingMore) {
      paginatedData.loadMore();
    }
  }, [endIndex, paginatedData.data.length, paginatedData.hasMore, paginatedData.loadingMore, paginatedData.loadMore, visibleItemsCount]);

  return {
    ...paginatedData,
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
    scrollTop,
    setScrollTop,
    itemHeight,
    containerHeight
  };
}