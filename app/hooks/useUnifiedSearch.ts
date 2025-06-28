"use client";

import { useState, useCallback, useMemo, useRef } from 'react';

// Search context types
export const SEARCH_CONTEXTS = {
  MAIN: 'main',
  LINK_EDITOR: 'link_editor',
  ADD_TO_PAGE: 'add_to_page',
  AUTOCOMPLETE: 'autocomplete'
} as const;

export type SearchContext = typeof SEARCH_CONTEXTS[keyof typeof SEARCH_CONTEXTS];

// Types
export interface SearchResults {
  pages: PageResult[];
  users: UserResult[];
}

export interface PageResult {
  id: string;
  title?: string;
  username?: string;
  userId?: string;
  type?: 'page' | 'public';
  isOwned?: boolean;
  isEditable?: boolean;
  isPublic?: boolean;
  lastModified?: any;
  createdAt?: any;
  matchScore?: number;
  isContentMatch?: boolean;
  context?: string;
  [key: string]: any;
}

export interface UserResult {
  id: string;
  username?: string;
  email?: string;
  photoURL?: string;
  type: 'user';
  matchScore?: number;
  [key: string]: any;
}

export interface SearchOptions {
  context?: SearchContext;
  maxResults?: number;
  includeContent?: boolean;
  includeUsers?: boolean;
  titleOnly?: boolean;
  filterByUserId?: string | null;
  currentPageId?: string | null;
}

export interface UseUnifiedSearchReturn {
  currentQuery: string;
  results: SearchResults;
  isLoading: boolean;
  error: string | null;
  performSearch: (searchTerm: string, options?: SearchOptions) => Promise<void>;
  clearSearch: () => void;
  searchStats: {
    searchTimeMs?: number;
    pagesFound?: number;
    usersFound?: number;
    source?: string;
  };
}

/**
 * Unified Search Hook - Single Source of Truth
 * 
 * This hook replaces all previous search hooks and provides a consistent
 * interface for all search functionality across the application.
 * 
 * Features:
 * - Context-aware search (main, link editor, add to page, autocomplete)
 * - No artificial result limits
 * - Comprehensive error handling
 * - Performance monitoring
 * - Smart caching and deduplication
 * - Abort controller for request cancellation
 */
export const useUnifiedSearch = (
  userId: string | null,
  defaultOptions: SearchOptions = {}
): UseUnifiedSearchReturn => {
  // Core search state
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [results, setResults] = useState<SearchResults>({ pages: [], users: [] });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchStats, setSearchStats] = useState<{
    searchTimeMs?: number;
    pagesFound?: number;
    usersFound?: number;
    source?: string;
  }>({});

  // Refs to prevent unnecessary re-renders and manage state
  const lastSearchRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchCacheRef = useRef<Map<string, { results: SearchResults; timestamp: number }>>(new Map());
  
  // Cache TTL (5 minutes)
  const CACHE_TTL = 5 * 60 * 1000;

  // Stable references
  const stableUserId = useRef<string | null>(userId);
  const stableDefaultOptions = useRef<SearchOptions>(defaultOptions);

  // Update refs when values change
  if (stableUserId.current !== userId) {
    stableUserId.current = userId;
    // Clear cache when user changes
    searchCacheRef.current.clear();
  }
  if (JSON.stringify(stableDefaultOptions.current) !== JSON.stringify(defaultOptions)) {
    stableDefaultOptions.current = defaultOptions;
  }

  // Generate cache key
  const generateCacheKey = useCallback((searchTerm: string, options: SearchOptions): string => {
    const key = JSON.stringify({
      searchTerm: searchTerm.trim(),
      userId: stableUserId.current,
      ...options
    });
    return key;
  }, []);

  // Check cache for results
  const getCachedResults = useCallback((cacheKey: string): SearchResults | null => {
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('🎯 Using cached search results');
      return cached.results;
    }
    if (cached) {
      searchCacheRef.current.delete(cacheKey);
    }
    return null;
  }, []);

  // Cache results
  const setCachedResults = useCallback((cacheKey: string, results: SearchResults): void => {
    searchCacheRef.current.set(cacheKey, {
      results,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries (keep only last 50)
    if (searchCacheRef.current.size > 50) {
      const entries = Array.from(searchCacheRef.current.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, entries.length - 50);
      toDelete.forEach(([key]) => searchCacheRef.current.delete(key));
    }
  }, []);

  // Main search function
  const performSearch = useCallback(async (
    searchTerm: string,
    options: SearchOptions = {}
  ): Promise<void> => {
    const trimmedSearchTerm = searchTerm.trim();
    const mergedOptions = { ...stableDefaultOptions.current, ...options };
    const cacheKey = generateCacheKey(trimmedSearchTerm, mergedOptions);

    // Handle empty search terms
    if (!searchTerm || !trimmedSearchTerm) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setResults({ pages: [], users: [] });
      setIsLoading(false);
      setCurrentQuery('');
      setError(null);
      setSearchStats({});
      lastSearchRef.current = '';
      return Promise.resolve();
    }

    // Check cache first
    const cachedResults = getCachedResults(cacheKey);
    if (cachedResults) {
      setResults(cachedResults);
      setCurrentQuery(trimmedSearchTerm);
      setIsLoading(false);
      setError(null);
      lastSearchRef.current = trimmedSearchTerm;
      return Promise.resolve();
    }

    // Prevent duplicate searches
    if (trimmedSearchTerm === lastSearchRef.current && results.pages.length > 0) {
      console.log('Skipping duplicate search with existing results');
      return Promise.resolve();
    }

    // Cancel any ongoing search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    lastSearchRef.current = trimmedSearchTerm;
    setIsLoading(true);
    setCurrentQuery(trimmedSearchTerm);
    setError(null);

    try {
      console.log(`🔍 Performing unified search: "${trimmedSearchTerm}"`, mergedOptions);

      // Build query parameters
      const queryParams = new URLSearchParams({
        searchTerm: trimmedSearchTerm,
        ...(stableUserId.current && { userId: stableUserId.current }),
        ...(mergedOptions.context && { context: mergedOptions.context }),
        ...(mergedOptions.maxResults && { maxResults: mergedOptions.maxResults.toString() }),
        ...(mergedOptions.includeContent !== undefined && { includeContent: mergedOptions.includeContent.toString() }),
        ...(mergedOptions.includeUsers !== undefined && { includeUsers: mergedOptions.includeUsers.toString() }),
        ...(mergedOptions.titleOnly !== undefined && { titleOnly: mergedOptions.titleOnly.toString() }),
        ...(mergedOptions.filterByUserId && { filterByUserId: mergedOptions.filterByUserId }),
        ...(mergedOptions.currentPageId && { currentPageId: mergedOptions.currentPageId })
      });

      const response = await fetch(`/api/search-unified?${queryParams}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Search API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Deduplicate results
      const uniquePages = Array.from(
        new Map((data.pages || []).map(page => [page.id, page])).values()
      );
      const uniqueUsers = Array.from(
        new Map((data.users || []).map(user => [user.id, user])).values()
      );

      const searchResults: SearchResults = {
        pages: uniquePages,
        users: uniqueUsers
      };

      // Cache the results
      setCachedResults(cacheKey, searchResults);

      setResults(searchResults);
      setSearchStats({
        searchTimeMs: data.performance?.searchTimeMs,
        pagesFound: data.performance?.pagesFound,
        usersFound: data.performance?.usersFound,
        source: data.source
      });

      console.log(`✅ Unified search completed:`, {
        pages: uniquePages.length,
        users: uniqueUsers.length,
        timeMs: data.performance?.searchTimeMs
      });

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Search aborted:', trimmedSearchTerm);
        return Promise.resolve();
      }
      
      console.error('Error in unified search:', error);
      setError(error.message || 'Search failed');
      setResults({ pages: [], users: [] });
      setSearchStats({});
      
      // Re-throw for caller error handling
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [generateCacheKey, getCachedResults, setCachedResults, results.pages.length]);

  // Clear search function
  const clearSearch = useCallback((): void => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setResults({ pages: [], users: [] });
    setCurrentQuery('');
    setError(null);
    setSearchStats({});
    lastSearchRef.current = '';
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Memoized return value to prevent unnecessary re-renders
  return useMemo(() => ({
    currentQuery,
    results,
    isLoading,
    error,
    performSearch,
    clearSearch,
    searchStats
  }), [currentQuery, results, isLoading, error, performSearch, clearSearch, searchStats]);
};
