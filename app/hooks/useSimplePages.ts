"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { registerUserPagesInvalidation } from "../utils/globalCacheInvalidation";
import { useSmartDataFetching } from './useSmartDataFetching';

// Types
interface PageData {
  id: string;
  title?: string;
  lastModified?: any;
  isPublic?: boolean;
  userId?: string;
  groupId?: string;
  createdAt?: any;
  [key: string]: any;
}

interface UseSimplePagesReturn {
  loading: boolean;
  pages: PageData[];
  error: string | null;
  refreshData: () => void;
  fetchWithSort: (sortBy: string, sortDirection: string) => void;
  // Infinite scroll support
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMore?: () => void;
}

// Cache to reduce query volumes
const pagesCache = new Map<string, { data: PageData[], timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache

/**
 * CRITICAL FIX: Hook with proper sorting AND query volume optimization
 * - Fixes non-working sort changes
 * - Reduces redundant API calls with caching
 * - Debounces rapid sort changes
 */
const useSimplePages = (
  userId: string,
  currentUserId: string | null = null,
  isUserPage: boolean = false,
  initialSortBy: string = 'lastModified',
  initialSortDirection: string = 'desc'
): UseSimplePagesReturn => {
  const [loading, setLoading] = useState<boolean>(true);
  const [pages, setPages] = useState<PageData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentSort, setCurrentSort] = useState({ sortBy: initialSortBy, sortDirection: initialSortDirection });
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

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
      console.log('🚫 QUERY OPTIMIZATION: Skipping duplicate fetch request');
      return;
    }

    // Check cache first to reduce query volume (unless forcing refresh or appending)
    const cached = pagesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL && !forceRefresh && !append) {
      console.log('📦 QUERY OPTIMIZATION: Using cached data for', cacheKey);
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
      console.log(`🚨 CRITICAL FIX: Fetching pages for user ${userId} sorted by ${effectiveSortBy} ${effectiveSortDirection}`);

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

      if (append) {
        setPages(prev => [...prev, ...pagesArray]);
        setLoadingMore(false);
      } else {
        // Cache the results to reduce future queries (only for initial loads)
        pagesCache.set(cacheKey, { data: pagesArray, timestamp: Date.now() });
        setPages(pagesArray);
        setLoading(false);
      }

      console.log(`✅ QUERY SUCCESS: ${pagesArray.length} pages sorted by ${effectiveSortBy} ${effectiveSortDirection}${append ? ' (appended)' : ''}`);

    } catch (err) {
      console.error("❌ QUERY ERROR:", err);
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
      console.log('📦 MOUNT: Using cached data for immediate display');
      setPages(cached.data);
      setLoading(false);

      // But also fetch fresh data in background to detect changes
      setTimeout(() => {
        console.log('🔄 MOUNT: Fetching fresh data in background to detect changes');
        fetchPages(undefined, undefined, true);
      }, 100);
    } else {
      // No valid cache, fetch fresh data
      fetchPages();
    }
  }, [userId, refreshTrigger]); // Depend on userId and refreshTrigger for automatic updates

  // Manual refresh function that clears cache (kept for compatibility but not exposed in UI)
  const refreshData = useCallback(() => {
    console.log('🔄 Manual refresh - clearing cache');
    pagesCache.clear();
    fetchPages(undefined, undefined, true); // Force refresh
  }, [fetchPages]);

  // Function to fetch with custom sorting (with debouncing and cache invalidation)
  const fetchWithSort = useCallback((newSortBy: string, newSortDirection: string) => {
    console.log(`🔄 SORT CHANGE: ${newSortBy} ${newSortDirection}`);

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

    console.log('🔄 useSimplePages: Setting up automatic cache invalidation for user:', userId);

    // Register for global cache invalidation events
    const unregister = registerUserPagesInvalidation((data) => {
      // Only refresh if this invalidation is for our user or if no specific user is mentioned
      if (!data?.userId || data.userId === userId) {
        console.log('🔄 useSimplePages: Auto-refreshing due to cache invalidation for user:', userId);

        // Clear cache and trigger refresh
        pagesCache.clear();
        setRefreshTrigger(prev => prev + 1);
      }
    });

    // Also listen for window events as a fallback
    const handleUserPagesInvalidation = (event: CustomEvent) => {
      const eventUserId = event.detail?.userId;
      if (!eventUserId || eventUserId === userId) {
        console.log('🔄 useSimplePages: Auto-refreshing due to window event for user:', userId);
        pagesCache.clear();
        setRefreshTrigger(prev => prev + 1);
      }
    };

    const handlePageCreated = () => {
      console.log('🔄 useSimplePages: Auto-refreshing due to page creation');
      pagesCache.clear();
      setRefreshTrigger(prev => prev + 1);
    };

    const handlePageUpdated = () => {
      console.log('🔄 useSimplePages: Auto-refreshing due to page update');
      pagesCache.clear();
      setRefreshTrigger(prev => prev + 1);
    };

    const handlePageDeleted = () => {
      console.log('🔄 useSimplePages: Auto-refreshing due to page deletion');
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
      console.log('🔄 useSimplePages: Cleaning up cache invalidation listeners for user:', userId);
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
    loadMore
  };
};

export default useSimplePages;