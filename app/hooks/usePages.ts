import { useState, useEffect, useRef, useCallback } from "react";
import { collection, query, where, orderBy, onSnapshot, limit, startAfter, getDocs, DocumentSnapshot, QueryDocumentSnapshot } from "firebase/firestore";
import { registerUserPagesInvalidator, unregisterCacheInvalidator } from "../utils/cacheInvalidation";
import { registerUserPagesInvalidation } from "../utils/globalCacheInvalidation";

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

interface CacheData {
  pages: PageData[];
  lastPageKey: { id: string } | null;
  hasMorePages: boolean;
  timestamp: number;
}

interface UsePagesReturn {
  loading: boolean;
  pages: PageData[];
  lastPageKey: QueryDocumentSnapshot | null;
  isMoreLoading: boolean;
  hasMorePages: boolean;
  error: string | null;
  fetchMorePages: () => Promise<PageData[]>;
  refreshData: () => void;
}

// Default limits for page loading
const DEFAULT_INITIAL_LIMIT = 20; // Default limit for home page
const USER_PAGE_INITIAL_LIMIT = 50; // Reduced from 300 to improve performance
const loadMoreLimitCount = 30; // Reduced from 100 to improve performance

const usePages = (
  userId: string,
  currentUserId: string | null = null,
  isUserPage: boolean = false
): UsePagesReturn => {

  // Use higher limit for user pages, default limit for home page
  const initialLimitCount = isUserPage ? USER_PAGE_INITIAL_LIMIT : DEFAULT_INITIAL_LIMIT;
  const [loading, setLoading] = useState<boolean>(true);
  const [pages, setPages] = useState<PageData[]>([]);
  const [lastPageKey, setLastPageKey] = useState<QueryDocumentSnapshot | null>(null);
  const [isMoreLoading, setIsMoreLoading] = useState<boolean>(false);
  const [hasMorePages, setHasMorePages] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const fetchInitialPages = async (): Promise<() => void> => {
    console.log('🔍 DEBUG: fetchInitialPages() function called!');
    console.log('🔍 DEBUG: fetchInitialPages parameters:', {
      userId,
      currentUserId,
      initialLimitCount
    });

    // Check if the current user is the owner of the pages
    const isOwner = currentUserId && userId === currentUserId;

    // Use a cache key based on userId and whether we're including private pages
    const cacheKey = `user_pages_${userId}_${isOwner ? 'owner' : 'visitor'}_${initialLimitCount}`;

    // Try to get cached data first
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          const cacheAge = Date.now() - (parsed.timestamp || 0);

          // DISABLE CACHE - never use cached data
          if (false) {
            console.log("usePages: Using cached data");
            setPages(parsed.pages || []);
            setLastPageKey(parsed.lastPageKey ? { ...parsed.lastPageKey } : null);
            setHasMorePages(parsed.hasMorePages);

            // Still set loading to false even when using cached data
            setLoading(false);

            // Fetch fresh data in the background
            setTimeout(() => refreshDataInBackground(), 100);

            // Return a no-op unsubscribe function since we're not setting up a listener
            return () => {};
          }
        }
      }
    } catch (cacheError) {
      console.error("Error reading from cache:", cacheError);
      // Continue with normal fetch if cache fails
    }

    setLoading(true);
    setError(null);

    // Set up a more reasonable timeout to detect stalled queries
    const queryTimeoutId = setTimeout(() => {
      console.warn("usePages: Query execution taking longer than expected");

      // Don't immediately stop loading if we don't have data yet
      if (pages.length === 0) {
        console.log("usePages: No pages loaded yet, continuing to wait");
        // Don't set loading to false yet, give it more time
      } else {
        console.log("usePages: Keeping existing pages data and stopping loading");
        setLoading(false);
      }

      // Only set error if we don't have any data
      if (pages.length === 0) {
        setError("Loading is taking longer than expected. Please wait or try refreshing the page.");
      }

      // Dispatch an event that other components can listen for
      if (typeof window !== 'undefined') {
        const forceCompleteEvent = new CustomEvent('loading-force-completed', {
          detail: { source: 'usePages', reason: 'query-timeout' }
        });
        window.dispatchEvent(forceCompleteEvent);
      }
    }, 10000); // Increased to 10 seconds to give more time for query to complete

    // Set a final timeout that actually stops everything
    const finalQueryTimeoutId = setTimeout(() => {
      console.error("usePages: Query failed to complete within reasonable time");
      setLoading(false);
      if (pages.length === 0) {
        setError("Unable to load content. Please check your connection and try again.");
        setPages([]);
      }
    }, 20000); // 20 second final timeout

    try {
      // TEMPORARY: Use dynamic import like the working API
      const { db } = await import('../firebase/database');

      // Define the fields we need to reduce data transfer
      const requiredFields = ['title', 'lastModified', 'isPublic', 'userId', 'groupId', 'createdAt'];

      // CRITICAL FIX: Show ALL pages (public + private) when viewing your own profile
      // Only show public pages when viewing someone else's profile
      const isOwner = currentUserId && userId === currentUserId;

      let pagesQuery;
      if (isOwner) {
        // Owner sees all their pages (public + private, exclude deleted)
        pagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          orderBy('lastModified', 'desc'),
          limit(initialLimitCount)
        );
      } else {
        // Others only see public pages (exclude deleted)
        pagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          where('isPublic', '==', true),
          orderBy('lastModified', 'desc'),
          limit(initialLimitCount)
        );
      }

      // Execute the query with detailed logging
      console.log(`usePages: Executing ${isOwner ? 'all pages' : 'public pages'} query for user ${userId}...`);
      const pagesSnapshot = await getDocs(pagesQuery);

      console.log('usePages: Pages query completed. Found', pagesSnapshot.size, 'documents');

      // Clear both timeouts since we got a response
      clearTimeout(queryTimeoutId);
      clearTimeout(finalQueryTimeoutId);

      // Process pages with filtering for deleted pages
      const pagesArray = [];
      pagesSnapshot.forEach((doc) => {
        try {
          const pageData = { id: doc.id, ...doc.data() };
          // CRITICAL FIX: Filter out deleted pages client-side since the compound index might not exist
          if (!pageData.deleted) {
            pagesArray.push(pageData);
            // DEBUG: Log page details to understand ordering
            console.log('🔍 DEBUG: Page found:', {
              id: pageData.id,
              title: pageData.title,
              lastModified: pageData.lastModified,
              createdAt: pageData.createdAt,
              isPublic: pageData.isPublic
            });
          } else {
            console.log('usePages: Filtered out deleted page:', pageData.id);
          }
        } catch (docError) {
          console.error(`Error processing document ${doc.id}:`, docError);
        }
      });

      console.log('usePages: Processed', pagesArray.length, 'pages after filtering');
      console.log('🔍 DEBUG: User pages query returned:', {
        totalCount: pagesArray.length,
        isOwner: isOwner,
        firstFewPages: pagesArray.slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          lastModified: p.lastModified,
          isPublic: p.isPublic,
          userId: p.userId
        }))
      });

      // Update state with the results
      setPages(pagesArray);

      // Set pagination flags based on RAW query results, not filtered results
      // This accounts for client-side filtering of deleted pages
      setHasMorePages(pagesSnapshot.docs.length >= initialLimitCount);

      // Set the last document key for pagination
      if (pagesSnapshot.docs.length > 0) {
        setLastPageKey(pagesSnapshot.docs[pagesSnapshot.docs.length - 1]);
      }

      // Cache the results for future use
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const cacheData = {
            pages: pagesArray,
            lastPageKey: pagesSnapshot.docs.length > 0 ? { id: pagesSnapshot.docs[pagesSnapshot.docs.length - 1].id } : null,
            hasMorePages: pagesArray.length >= initialLimitCount,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        }
      } catch (cacheError) {
        console.error("Error writing to cache:", cacheError);
        // Continue even if caching fails
      }

      setLoading(false);

      // Return a no-op unsubscribe function since we're not setting up a listener
      return () => {};
    } catch (error) {
      // Clear the timeout if we encounter an error
      clearTimeout(queryTimeoutId);

      console.error("Error fetching pages:", error);
      setError("Failed to load pages. Please try again later.");
      setLoading(false);

      // Return a no-op unsubscribe function
      return () => {};
    }
  };

  // Function to refresh data in the background without showing loading state
  const refreshDataInBackground = async (): Promise<void> => {
    try {
      // TEMPORARY: Use dynamic import like the working API
      const { db } = await import('../firebase/database');

      // This is a simplified version of fetchInitialPages that doesn't update loading state
      const isOwner = currentUserId && userId === currentUserId;

      // Define query based on ownership (same logic as fetchInitialPages)
      let pagesQuery;
      if (isOwner) {
        // Owner sees all their pages (public + private, exclude deleted)
        pagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          orderBy('lastModified', 'desc'),
          limit(initialLimitCount)
        );
      } else {
        // Others only see public pages (exclude deleted)
        pagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          where('isPublic', '==', true),
          orderBy('lastModified', 'desc'),
          limit(initialLimitCount)
        );
      }

      // Execute the query
      const pagesSnapshot = await getDocs(pagesQuery);

      // Process results and update state with client-side filtering
      const pagesArray = [];
      pagesSnapshot.forEach((doc) => {
        try {
          const pageData = { id: doc.id, ...doc.data() };
          // Filter out deleted pages client-side
          if (!pageData.deleted) {
            pagesArray.push(pageData);
          }
        } catch (docError) {
          console.error(`Error processing public document ${doc.id}:`, docError);
        }
      });

      // Update state with fresh data
      setPages(pagesArray);

      // Update pagination state based on RAW query results, not filtered results
      // This accounts for client-side filtering of deleted pages
      setHasMorePages(pagesSnapshot.docs.length >= initialLimitCount);

      // Update last key for pagination
      if (pagesSnapshot.docs.length > 0) {
        setLastPageKey(pagesSnapshot.docs[pagesSnapshot.docs.length - 1]);
      }

      // Update cache with fresh data
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const cacheKey = `user_pages_${userId}_${isOwner ? 'owner' : 'visitor'}_${initialLimitCount}`;
          const cacheData = {
            pages: pagesArray,
            lastPageKey: pagesSnapshot.docs.length > 0 ? { id: pagesSnapshot.docs[pagesSnapshot.docs.length - 1].id } : null,
            hasMorePages: pagesSnapshot.docs.length >= initialLimitCount,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        }
      } catch (cacheError) {
        console.error("Error updating cache:", cacheError);
      }
    } catch (error) {
      console.error("Error refreshing data in background:", error);
      // Don't update error state for background refreshes
    }
  };

  // Function to fetch more pages
  const fetchMorePages = async (): Promise<PageData[]> => {
    try {
      // TEMPORARY: Use dynamic import like the working API
      const { db } = await import('../firebase/database');

      if (!lastPageKey) {
        setHasMorePages(false);
        throw new Error("No more pages to load");
      }

      // Check if the current user is the owner of the pages
      const isOwner = currentUserId && userId === currentUserId;

      // Define the fields we need to reduce data transfer
      const requiredFields = ['title', 'lastModified', 'isPublic', 'userId', 'groupId', 'createdAt'];

      // Query for more pages (same logic as initial fetch)
      let moreQuery;
      if (isOwner) {
        // Owner sees all their pages (public + private, exclude deleted)
        moreQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          orderBy('lastModified', 'desc'),
          startAfter(lastPageKey),
          limit(loadMoreLimitCount)
        );
      } else {
        // Others only see public pages (exclude deleted)
        moreQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          where('isPublic', '==', true),
          orderBy('lastModified', 'desc'),
          startAfter(lastPageKey),
          limit(loadMoreLimitCount)
        );
      }

      setIsMoreLoading(true);

      // Set up a timeout to detect stalled queries
      const timeoutId = setTimeout(() => {
        console.warn("usePages: Load more query taking too long, may be stalled");
        setIsMoreLoading(false);
        setError("Failed to load more pages. Please try again later.");
      }, 5000);

      const snapshot = await getDocs(moreQuery);
      clearTimeout(timeoutId);

      const newPagesArray = [];

      snapshot.forEach((doc) => {
        try {
          const pageData = { id: doc.id, ...doc.data() };
          // Filter out deleted pages client-side
          if (!pageData.deleted) {
            newPagesArray.push(pageData);
          }
        } catch (docError) {
          console.error(`Error processing document ${doc.id}:`, docError);
        }
      });

      setPages((prevPages) => [...prevPages, ...newPagesArray]);

      // Update pagination state based on RAW query results, not filtered results
      setHasMorePages(snapshot.docs.length >= loadMoreLimitCount);

      // Update last key for pagination
      if (snapshot.docs.length > 0) {
        setLastPageKey(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        setHasMorePages(false);
      }

      // Update cache with the new combined data
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const cacheKey = `user_pages_${userId}_${isOwner ? 'owner' : 'visitor'}_${initialLimitCount}`;
          const cachedData = localStorage.getItem(cacheKey);

          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            const updatedCache = {
              ...parsed,
              pages: [...(parsed.pages || []), ...newPagesArray],
              lastPageKey: snapshot.docs.length > 0 ? { id: snapshot.docs[snapshot.docs.length - 1].id } : parsed.lastPageKey,
              hasMorePages: snapshot.docs.length >= loadMoreLimitCount,
              timestamp: Date.now()
            };
            localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
          }
        }
      } catch (cacheError) {
        console.error("Error updating cache after loading more pages:", cacheError);
      }

      setIsMoreLoading(false);
      return newPagesArray;
    } catch (err) {
      console.error("Error fetching more pages:", err);
      setError("Failed to load more pages. Please try again later.");
      setIsMoreLoading(false);
      throw err;
    }
  };

  // Track fetch attempts to prevent infinite loops
  const fetchAttemptsRef = useRef(0);
  const maxFetchAttempts = 3;
  const lastFetchTimeRef = useRef(0);

  // RUTHLESS SIMPLIFICATION: Remove all event listening complexity
  // Just rely on short TTL (5 seconds) and browser refresh

  // Register global cache invalidation callback (new system)
  useEffect(() => {
    console.log('🔵 usePages: Registering global cache invalidation for userId:', userId);

    const unregister = registerUserPagesInvalidation(() => {
      console.log('🔵 usePages: Global cache invalidation triggered for userId:', userId);

      // Clear localStorage cache for this user
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const isOwner = currentUserId && userId === currentUserId;
          const cacheKey = `user_pages_${userId}_${isOwner ? 'owner' : 'visitor'}_${initialLimitCount}`;
          console.log('🔵 usePages: Cleared localStorage cache for key:', cacheKey);
          localStorage.removeItem(cacheKey);

          // Also clear any activity caches
          const activityKeys = Object.keys(localStorage).filter(key =>
            key.includes('activity_cache_') || key.includes('recent_activity_')
          );
          activityKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log('🔵 usePages: Cleared activity cache key:', key);
          });
        }
      } catch (error) {
        console.error('Error clearing localStorage cache:', error);
      }

      // Trigger refresh by updating state
      console.log('🔵 usePages: Triggering refresh with refreshTrigger update');
      setRefreshTrigger(prev => {
        const newValue = prev + 1;
        console.log('🔵 usePages: refreshTrigger updated from', prev, 'to', newValue);
        return newValue;
      });
    });

    return () => {
      console.log('🔵 usePages: Unregistering global cache invalidation for userId:', userId);
      unregister();
    };
  }, [userId, currentUserId, initialLimitCount]);

  // Register old cache invalidation callback (keep for compatibility)
  useEffect(() => {
    if (userId) {
      const unregister = registerUserPagesInvalidator(userId, () => {
        setRefreshTrigger(prev => prev + 1);
      });
      return unregister;
    }
  }, [userId, currentUserId, initialLimitCount]);

  // Fetch initial pages when the component mounts
  useEffect(() => {

    let unsubscribe = () => {};
    let fetchTimeoutId = null;
    let hardTimeoutId = null;

    // Set a hard timeout to prevent infinite loading state
    hardTimeoutId = setTimeout(() => {
      if (loading) {
        console.warn("usePages: Hard timeout reached, forcing completion");
        setLoading(false);

        // CRITICAL FIX: Don't clear existing pages if we already have data
        // This prevents pages from disappearing after they've loaded
        if (pages.length === 0) {
          console.log("usePages: Hard timeout - no pages loaded yet, providing empty data as fallback");
          setPages([]);
          setHasMorePages(false);
        } else {
          console.log("usePages: Hard timeout - keeping existing pages data instead of clearing");
          // Keep existing data, just update loading state
        }

        // Set a more user-friendly error message
        setError("We couldn't load all your content. You can continue browsing with the data that was loaded.");

        // Dispatch an event that other components can listen for with detailed information
        if (typeof window !== 'undefined') {
          const forceCompleteEvent = new CustomEvent('loading-force-completed', {
            detail: {
              source: 'usePages',
              reason: 'hard-timeout',
              userId: userId
            }
          });
          window.dispatchEvent(forceCompleteEvent);

          // Also dispatch a custom event for analytics
          const analyticsEvent = new CustomEvent('analytics-event', {
            detail: {
              eventName: 'page_load_timeout',
              userId: userId,
              timestamp: Date.now()
            }
          });
          window.dispatchEvent(analyticsEvent);
        }
      }
    }, 10000); // Increased to 10 seconds to give more time for query to complete

    const attemptFetch = async () => {
      // Increment fetch attempts
      fetchAttemptsRef.current += 1;
      lastFetchTimeRef.current = Date.now();

      console.log(`usePages: Fetching pages for user ${userId}, attempt ${fetchAttemptsRef.current}`);

      try {
        console.log('🔍 DEBUG: Calling fetchInitialPages() now...');
        // Execute the fetch function (now returns a no-op unsubscribe)
        unsubscribe = await fetchInitialPages();
        console.log('🔍 DEBUG: fetchInitialPages() completed successfully');

        // Reset fetch attempts on successful fetch
        fetchAttemptsRef.current = 0;

        // Clear the hard timeout since we've successfully loaded data
        if (hardTimeoutId) {
          clearTimeout(hardTimeoutId);
          hardTimeoutId = null;
        }
      } catch (err) {
        console.error("usePages: Error fetching pages:", err);
        setError("Failed to load pages. Please try refreshing the page.");
        setLoading(false);

        // If we haven't exceeded max attempts, try again after a delay
        if (fetchAttemptsRef.current < maxFetchAttempts) {
          console.log(`usePages: Will retry fetch, attempt ${fetchAttemptsRef.current} of ${maxFetchAttempts}`);
          fetchTimeoutId = setTimeout(attemptFetch, 2000); // Retry after 2 seconds
        } else {
          console.error("usePages: Max fetch attempts reached, giving up");
          setLoading(false);

          // Dispatch an event that other components can listen for
          if (typeof window !== 'undefined') {
            const forceCompleteEvent = new CustomEvent('loading-force-completed');
            window.dispatchEvent(forceCompleteEvent);
          }
        }
      }
    };

    if (userId) {
      attemptFetch();
    } else {
      console.log("usePages: No userId provided, skipping page fetch");
      setLoading(false);

      // Clear the hard timeout since we're not loading anything
      if (hardTimeoutId) {
        clearTimeout(hardTimeoutId);
        hardTimeoutId = null;
      }
    }

    // Add listener for force-refresh event
    const handleForceRefresh = () => {
      console.log("usePages: Received force-refresh event, re-fetching pages");

      // Prevent too frequent refreshes (at least 1 second between refreshes)
      const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
      if (timeSinceLastFetch < 1000) {
        console.log(`usePages: Ignoring refresh, too soon after last fetch (${timeSinceLastFetch}ms)`);
        return;
      }

      // Reset fetch attempts on manual refresh
      fetchAttemptsRef.current = 0;

      // Clear any pending fetch timeout
      if (fetchTimeoutId) {
        clearTimeout(fetchTimeoutId);
        fetchTimeoutId = null;
      }

      // Attempt fetch again
      attemptFetch();
    };

    window.addEventListener('force-refresh-pages', handleForceRefresh);

    // Cleanup function
    return () => {
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
        window.removeEventListener('force-refresh-pages', handleForceRefresh);

        // Clear any pending timeouts
        if (fetchTimeoutId) {
          clearTimeout(fetchTimeoutId);
          fetchTimeoutId = null;
        }

        if (hardTimeoutId) {
          clearTimeout(hardTimeoutId);
          hardTimeoutId = null;
        }
      } catch (err) {
        console.error("usePages: Error during cleanup:", err);
      }
    };
  }, [userId, currentUserId, initialLimitCount, refreshTrigger]);

  // Manual refresh function
  const refreshData = useCallback(() => {
    console.log('🔄 Manual refresh triggered for usePages');
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return {
    pages,
    loading,
    error,
    hasMorePages,
    isMoreLoading,
    fetchMorePages,
    refreshData
  };
};

export default usePages;