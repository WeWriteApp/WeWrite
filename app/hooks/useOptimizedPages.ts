"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchPages, clearPagesCache } from "../lib/pageCache";

// Types
interface PageData {
  id: string;
  title?: string;
  lastModified?: any;
  isPublic?: boolean;
  userId?: string;
  [key: string]: any;
}

interface UseOptimizedPagesReturn {
  pages: PageData[];
  loading: boolean;
  error: string | null;
  hasMorePages: boolean;
  isMoreLoading: boolean;
  loadMorePages: () => Promise<void>;
  refreshPages: () => void;
}

// Default limits for page loading
const DEFAULT_INITIAL_LIMIT = 20;
const USER_PAGE_INITIAL_LIMIT = 100;
const LOAD_MORE_LIMIT = 50;

/**
 * useOptimizedPages - A hook for efficiently fetching and caching pages data
 *
 * Features:
 * - Efficient caching with memory and localStorage
 * - Progressive loading with optimistic UI updates
 * - Exponential backoff for retries
 * - Proper error handling and recovery
 */
const useOptimizedPages = (
  userId: string,
  currentUserId: string | null = null,
  isUserPage: boolean = false
): UseOptimizedPagesReturn => {
  // Use higher limit for user pages, default limit for home page
  const initialLimitCount = isUserPage ? USER_PAGE_INITIAL_LIMIT : DEFAULT_INITIAL_LIMIT;
  
  // State for pages data
  const [pages, setPages] = useState<PageData[]>([]);
  const [lastPageKey, setLastPageKey] = useState<any>(null);

  // Loading states
  const [loading, setLoading] = useState<boolean>(true);
  const [isMoreLoading, setIsMoreLoading] = useState<boolean>(false);

  // Pagination states
  const [hasMorePages, setHasMorePages] = useState<boolean>(true);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Refs for tracking fetch attempts and backoff
  const fetchAttemptsRef = useRef<number>(0);
  const maxFetchAttempts = 5; // Increased from 3 to 5
  const backoffTimeRef = useRef<number>(1000); // Start with 1 second backoff
  const lastFetchTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Function to load initial pages with optimistic UI and caching
  const loadInitialPages = useCallback(async (): Promise<void> => {
    if (!userId) {
      console.log("useOptimizedPages: No userId provided, skipping page fetch");
      setLoading(false);
      return;
    }
    
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);
    
    // Increment fetch attempts
    fetchAttemptsRef.current += 1;
    lastFetchTimeRef.current = Date.now();
    
    // Set up a timeout to detect stalled queries
    const timeoutId = setTimeout(() => {
      console.warn("useOptimizedPages: Query execution taking too long, may be stalled");
      
      // If we have cached data, use it even if it's stale
      const cachedPublicData = localStorage.getItem(`wewrite_pages_${userId}_public_${currentUserId === userId ? 'owner' : 'visitor'}_${initialLimitCount}`);

      if (cachedPublicData) {
        console.log("useOptimizedPages: Using stale cached data as fallback");
        
        try {
          if (cachedPublicData) {
            const parsed = JSON.parse(cachedPublicData);
            setPages(parsed.data || []);
          }

          // Still show error but at least we have some data
          setError("We're having trouble refreshing your data. Showing cached content.");
        } catch (e) {
          console.error("Error parsing cached data:", e);
        }
      } else {
        // No cached data available, show empty state
        setPages([]);
        setError("We couldn't load your content. Please try again later.");
      }
      
      setLoading(false);
    }, 3000);
    
    try {
      // Fetch public pages only
      const result = await fetchPages(
        userId,
        true, // isPublic = true
        currentUserId,
        initialLimitCount
      );

      // Update pages state
      setPages(result.data || []);
      setLastPageKey(result.lastKey);
      setHasMorePages(result.hasMore);
      
      // Reset fetch attempts on success
      fetchAttemptsRef.current = 0;
      backoffTimeRef.current = 1000; // Reset backoff time
      
      // Clear the timeout since we got data
      clearTimeout(timeoutId);
      
      // Update loading state
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error fetching pages:", err);
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Check if this was an abort error (user navigated away)
      if (err.name === 'AbortError') {
        console.log("Request was aborted");
        return;
      }
      
      // Set error state
      setError("Failed to load pages. Please try again later.");
      
      // If we haven't exceeded max attempts, retry with exponential backoff
      if (fetchAttemptsRef.current < maxFetchAttempts) {
        const backoffTime = backoffTimeRef.current;
        console.log(`useOptimizedPages: Will retry fetch in ${backoffTime}ms, attempt ${fetchAttemptsRef.current} of ${maxFetchAttempts}`);
        
        // Increase backoff time for next attempt (exponential backoff)
        backoffTimeRef.current = Math.min(backoffTimeRef.current * 2, 10000); // Cap at 10 seconds
        
        setTimeout(() => {
          loadInitialPages();
        }, backoffTime);
      } else {
        console.error("useOptimizedPages: Max fetch attempts reached, giving up");
        setLoading(false);
        
        // Try to use any cached data as a last resort
        const cachedPublicData = localStorage.getItem(`wewrite_pages_${userId}_public_${currentUserId === userId ? 'owner' : 'visitor'}_${initialLimitCount}`);
        
        if (cachedPublicData) {
          try {
            const parsed = JSON.parse(cachedPublicData);
            setPages(parsed.data || []);
            setError("We're having trouble connecting to the server. Showing cached content.");
          } catch (e) {
            console.error("Error parsing cached data:", e);
          }
        }
      }
    }
  }, [userId, currentUserId, initialLimitCount]);
  
  // Function to load more pages
  const loadMorePages = useCallback(async (): Promise<void> => {
    if (!lastPageKey || isMoreLoading || !hasMorePages) {
      return;
    }

    setIsMoreLoading(true);

    try {
      const result = await fetchPages(
        userId,
        true, // isPublic = true
        currentUserId,
        LOAD_MORE_LIMIT,
        lastPageKey
      );

      // Update state with new pages
      setPages(prev => [...prev, ...result.data]);
      setLastPageKey(result.lastKey);
      setHasMorePages(result.hasMore);
      setIsMoreLoading(false);
    } catch (err) {
      console.error("Error loading more pages:", err);
      setError("Failed to load more pages. Please try again.");
      setIsMoreLoading(false);
    }
  }, [userId, currentUserId, lastPageKey, isMoreLoading, hasMorePages]);

  // Function to force refresh the data
  const refreshPages = useCallback((): void => {
    // Clear cache for this user
    clearPagesCache(userId);

    // Reset states
    setPages([]);
    setLastPageKey(null);
    setHasMorePages(true);

    // Reset fetch attempts
    fetchAttemptsRef.current = 0;
    backoffTimeRef.current = 1000;

    // Load pages again
    loadInitialPages();
  }, [userId, loadInitialPages]);
  
  // Load initial pages when component mounts or userId changes
  useEffect(() => {
    loadInitialPages();
    
    // Set up event listener for force refresh
    const handleForceRefresh = () => {
      console.log("useOptimizedPages: Received force-refresh event");
      refreshPages();
    };
    
    window.addEventListener('force-refresh-pages', handleForceRefresh);
    
    // Cleanup function
    return () => {
      window.removeEventListener('force-refresh-pages', handleForceRefresh);
      
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [userId, loadInitialPages, refreshPages]);
  
  // Sort pages by lastModified (newest first)
  const sortedPages = [...pages].sort((a, b) => {
    const dateA = a.lastModified?.toDate?.() || new Date(a.lastModified || 0);
    const dateB = b.lastModified?.toDate?.() || new Date(b.lastModified || 0);
    return dateB - dateA;
  });

  return {
    pages: sortedPages,
    loading,
    error,
    hasMorePages,
    isMoreLoading,
    loadMorePages,
    refreshPages
  };
};

export default useOptimizedPages;