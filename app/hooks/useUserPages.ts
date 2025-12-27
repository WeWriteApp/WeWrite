"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { registerUserPagesInvalidation } from "../utils/globalCacheInvalidation";
import { useSmartDataFetching } from './useSmartDataFetching';
import type { Page } from '../types/database';

/**
 * Page data type - uses centralized Page type with partial fields
 */
type PageData = Partial<Page> & { id: string; [key: string]: any };

interface UseUserPagesReturn {
  loading: boolean;
  pages: PageData[];
  error: string | null;
  refreshData: () => void;
  fetchWithSort: (sortBy: string, sortDirection: string) => void;
  // Infinite scroll support
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMore?: () => void;
  // Total page count for the user
  totalPageCount?: number;
}

// Cache to reduce query volumes
const pagesCache = new Map<string, { data: PageData[], timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache

/**
 * Hook to fetch a user's pages with sorting and pagination.
 *
 * Features:
 * - Proper sorting with sort change support
 * - Query volume optimization with caching
 * - Debounces rapid sort changes
 * - Infinite scroll support
 * - Automatic cache invalidation on page create/update/delete
 */
const useUserPages = (
  userId: string,
  currentUserId: string | null = null,
  isUserPage: boolean = false,
  initialSortBy: string = 'lastModified',
  initialSortDirection: string = 'desc'
): UseUserPagesReturn => {
  const [loading, setLoading] = useState<boolean>(true);
  const [pages, setPages] = useState<PageData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentSort, setCurrentSort] = useState({ sortBy: initialSortBy, sortDirection: initialSortDirection });
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [totalPageCount, setTotalPageCount] = useState<number>(0);

  // Infinite scroll state
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Refs for debouncing and preventing duplicate calls
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<string>('');

  // Optimized fetch function with caching and deduplication
  const fetchPages = useCallback(async (customSortBy?: string, customSortDirection?: string, forceRefresh: boolean = false, append: boolean = false, cursor?: string) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const effectiveSortBy = customSortBy || currentSort.sortBy;
    const effectiveSortDirection = customSortDirection || currentSort.sortDirection;

    // Create cache key
    const cacheKey = `${userId}-${effectiveSortBy}-${effectiveSortDirection}`;

    // Check if this is a duplicate call
    if (lastFetchRef.current === cacheKey && loading && !forceRefresh) {
      return;
    }

    // Check cache first to reduce query volume (unless forcing refresh or appending)
    const cached = pagesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL && !forceRefresh && !append) {
      setPages(cached.data);
      setLoading(false);
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }
    lastFetchRef.current = cacheKey;

    try {
      const params = new URLSearchParams({
        userId,
        sortBy: effectiveSortBy,
        sortDirection: effectiveSortDirection,
        limit: '20' // Smaller limit for pagination
      });

      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(`/api/my-pages?${params}`);

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const pagesArray = data.pages || [];

      // Update pagination state
      setHasMore(data.hasMore || false);
      setNextCursor(data.nextCursor || null);

      // Update total page count if available
      if (typeof data.totalPageCount === 'number') {
        setTotalPageCount(data.totalPageCount);
      }

      if (append) {
        setPages(prev => [...prev, ...pagesArray]);
        setLoadingMore(false);
      } else {
        // Cache the results to reduce future queries (only for initial loads)
        pagesCache.set(cacheKey, { data: pagesArray, timestamp: Date.now() });
        setPages(pagesArray);
        setLoading(false);
      }

    } catch (err) {
      setError("Failed to load pages. Please try again later.");
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [userId, currentSort.sortBy, currentSort.sortDirection, loading]);

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && nextCursor) {
      fetchPages(currentSort.sortBy, currentSort.sortDirection, false, true, nextCursor);
    }
  }, [loadingMore, hasMore, nextCursor, currentSort.sortBy, currentSort.sortDirection, fetchPages]);

  // Initial fetch when userId changes or refresh is triggered
  useEffect(() => {
    if (!userId) return;

    // On mount, check if we have cached data and compare with fresh data
    const cacheKey = `${userId}-${currentSort.sortBy}-${currentSort.sortDirection}`;
    const cached = pagesCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      // Use cached data immediately for fast loading
      setPages(cached.data);
      setLoading(false);

      // Fetch fresh data in background to detect changes
      setTimeout(() => {
        fetchPages(undefined, undefined, true);
      }, 100);
    } else {
      // No valid cache, fetch fresh data
      fetchPages();
    }
  }, [userId, refreshTrigger]); // Depend on userId and refreshTrigger for automatic updates

  // Manual refresh function that clears cache
  const refreshData = useCallback(() => {
    pagesCache.clear();
    fetchPages(undefined, undefined, true);
  }, [fetchPages]);

  // Function to fetch with custom sorting (with debouncing and cache invalidation)
  const fetchWithSort = useCallback((newSortBy: string, newSortDirection: string) => {

    // Update current sort state
    setCurrentSort({ sortBy: newSortBy, sortDirection: newSortDirection });

    // Clear any existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Clear cache for this sort change to ensure fresh data
    const cacheKey = `${userId}-${newSortBy}-${newSortDirection}`;
    pagesCache.delete(cacheKey);

    // Debounce rapid sort changes to reduce query volume
    debounceTimeoutRef.current = setTimeout(() => {
      fetchPages(newSortBy, newSortDirection);
    }, 150); // 150ms debounce

  }, [userId, fetchPages]);

  // Set up automatic cache invalidation listener for this user
  useEffect(() => {
    if (!userId) return;

    // Register for global cache invalidation events
    const unregister = registerUserPagesInvalidation((data) => {
      if (!data?.userId || data.userId === userId) {
        pagesCache.clear();
        setRefreshTrigger(prev => prev + 1);
      }
    });

    // Also listen for window events as a fallback
    const handleUserPagesInvalidation = (event: CustomEvent) => {
      const eventUserId = event.detail?.userId;
      if (!eventUserId || eventUserId === userId) {
        pagesCache.clear();
        setRefreshTrigger(prev => prev + 1);
      }
    };

    const handlePageCreated = () => {
      pagesCache.clear();
      setRefreshTrigger(prev => prev + 1);
    };

    const handlePageUpdated = () => {
      pagesCache.clear();
      setRefreshTrigger(prev => prev + 1);
    };

    const handlePageDeleted = () => {
      pagesCache.clear();
      setRefreshTrigger(prev => prev + 1);
    };

    // Add event listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('invalidate-user-pages', handleUserPagesInvalidation as EventListener);
      window.addEventListener('page-created', handlePageCreated);
      window.addEventListener('page-updated', handlePageUpdated);
      window.addEventListener('page-deleted', handlePageDeleted);
    }

    return () => {
      unregister();

      // Remove event listeners
      if (typeof window !== 'undefined') {
        window.removeEventListener('invalidate-user-pages', handleUserPagesInvalidation as EventListener);
        window.removeEventListener('page-created', handlePageCreated);
        window.removeEventListener('page-updated', handlePageUpdated);
        window.removeEventListener('page-deleted', handlePageDeleted);
      }
    };
  }, [userId]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    pages,
    loading,
    error,
    refreshData,
    fetchWithSort,
    hasMore,
    loadingMore,
    loadMore,
    totalPageCount
  };
};

export default useUserPages;

// Backward compatibility alias
export { useUserPages as useSimplePages };