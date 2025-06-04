import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../firebase/database";
import { collection, query, where, orderBy, onSnapshot, limit, startAfter, getDocs, DocumentSnapshot, QueryDocumentSnapshot } from "firebase/firestore";

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
  privatePages: PageData[];
  lastPageKey: { id: string } | null;
  lastPrivatePageKey: { id: string } | null;
  hasMorePages: boolean;
  hasMorePrivatePages: boolean;
  timestamp: number;
}

interface UsePagesReturn {
  loading: boolean;
  pages: PageData[];
  privatePages: PageData[];
  lastPageKey: QueryDocumentSnapshot | null;
  lastPrivatePageKey: QueryDocumentSnapshot | null;
  isMoreLoading: boolean;
  isMorePrivateLoading: boolean;
  hasMorePages: boolean;
  hasMorePrivatePages: boolean;
  error: string | null;
  fetchMorePages: () => Promise<PageData[]>;
  fetchMorePrivatePages: () => Promise<PageData[]>;
  refreshData: () => void;
}

// Default limits for page loading
const DEFAULT_INITIAL_LIMIT = 20; // Default limit for home page
const USER_PAGE_INITIAL_LIMIT = 50; // Reduced from 300 to improve performance
const loadMoreLimitCount = 30; // Reduced from 100 to improve performance

const usePages = (
  userId: string,
  includePrivate: boolean = true,
  currentUserId: string | null = null,
  isUserPage: boolean = false
): UsePagesReturn => {
  // Use higher limit for user pages, default limit for home page
  const initialLimitCount = isUserPage ? USER_PAGE_INITIAL_LIMIT : DEFAULT_INITIAL_LIMIT;
  const [loading, setLoading] = useState<boolean>(true);
  const [pages, setPages] = useState<PageData[]>([]);
  const [privatePages, setPrivatePages] = useState<PageData[]>([]);
  const [lastPageKey, setLastPageKey] = useState<QueryDocumentSnapshot | null>(null);
  const [lastPrivatePageKey, setLastPrivatePageKey] = useState<QueryDocumentSnapshot | null>(null);
  const [isMoreLoading, setIsMoreLoading] = useState<boolean>(false);
  const [isMorePrivateLoading, setIsMorePrivateLoading] = useState<boolean>(false);
  const [hasMorePages, setHasMorePages] = useState<boolean>(true);
  const [hasMorePrivatePages, setHasMorePrivatePages] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInitialPages = async (): Promise<() => void> => {
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

          // Use cache if it's less than 5 minutes old
          if (cacheAge < 5 * 60 * 1000) {
            console.log("usePages: Using cached data");
            setPages(parsed.pages || []);
            setPrivatePages(parsed.privatePages || []);
            setLastPageKey(parsed.lastPageKey ? { ...parsed.lastPageKey } : null);
            setLastPrivatePageKey(parsed.lastPrivatePageKey ? { ...parsed.lastPrivatePageKey } : null);
            setHasMorePages(parsed.hasMorePages);
            setHasMorePrivatePages(parsed.hasMorePrivatePages);

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

    // Set up a timeout to detect stalled queries
    const queryTimeoutId = setTimeout(() => {
      console.warn("usePages: Query execution taking too long, may be stalled");
      // Force loading to false after timeout to prevent infinite loading state
      setLoading(false);

      // CRITICAL FIX: Don't clear existing pages if we already have data
      // This prevents pages from disappearing after they've loaded
      if (pages.length === 0) {
        console.log("usePages: No pages loaded yet, providing empty data as fallback");
        // Only set empty arrays if we don't have any data yet
        setPages([]);
        setPrivatePages([]);
      } else {
        console.log("usePages: Keeping existing pages data instead of clearing");
        // Keep existing data, just update loading state
      }

      // Set error message
      setError("Query execution is taking longer than expected. Please try refreshing the page.");

      // Dispatch an event that other components can listen for
      if (typeof window !== 'undefined') {
        const forceCompleteEvent = new CustomEvent('loading-force-completed', {
          detail: { source: 'usePages', reason: 'query-timeout' }
        });
        window.dispatchEvent(forceCompleteEvent);
      }
    }, 5000); // Increased to 5 seconds to give more time for query to complete

    try {
      // Define the fields we need to reduce data transfer
      const requiredFields = ['title', 'lastModified', 'isPublic', 'userId', 'groupId', 'createdAt'];

      // Use separate queries for public and private pages to improve performance
      let publicPagesQuery;
      let privatePagesQuery = null;

      // Query for public pages
      publicPagesQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        limit(initialLimitCount)
      );

      // Only query for private pages if the current user is the owner
      if (includePrivate && isOwner) {
        privatePagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          where('isPublic', '==', false),
          orderBy('lastModified', 'desc'),
          limit(initialLimitCount)
        );
      }

      // Execute the queries
      const publicPagesPromise = getDocs(publicPagesQuery);
      const privatePagesPromise = privatePagesQuery ? getDocs(privatePagesQuery) : Promise.resolve(null);

      // Wait for both queries to complete
      const [publicSnapshot, privateSnapshot] = await Promise.all([
        publicPagesPromise,
        privatePagesPromise
      ]);

      // Clear the timeout since we got a response
      clearTimeout(queryTimeoutId);

      // Process public pages
      const pagesArray = [];
      publicSnapshot.forEach((doc) => {
        try {
          const pageData = { id: doc.id, ...doc.data() };
          pagesArray.push(pageData);
        } catch (docError) {
          console.error(`Error processing public document ${doc.id}:`, docError);
        }
      });

      // Process private pages if available
      const privateArray = [];
      if (privateSnapshot) {
        privateSnapshot.forEach((doc) => {
          try {
            const pageData = { id: doc.id, ...doc.data() };
            privateArray.push(pageData);
          } catch (docError) {
            console.error(`Error processing private document ${doc.id}:`, docError);
          }
        });
      }

      // Update state with the results
      setPages(pagesArray);
      setPrivatePages(privateArray);

      // Set pagination flags
      setHasMorePages(pagesArray.length >= initialLimitCount);
      setHasMorePrivatePages(privateArray.length >= initialLimitCount);

      // Set the last document keys for pagination
      if (publicSnapshot.docs.length > 0) {
        setLastPageKey(publicSnapshot.docs[publicSnapshot.docs.length - 1]);
      }

      if (privateSnapshot && privateSnapshot.docs.length > 0) {
        setLastPrivatePageKey(privateSnapshot.docs[privateSnapshot.docs.length - 1]);
      }

      // Cache the results for future use
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const cacheData = {
            pages: pagesArray,
            privatePages: privateArray,
            lastPageKey: publicSnapshot.docs.length > 0 ? { id: publicSnapshot.docs[publicSnapshot.docs.length - 1].id } : null,
            lastPrivatePageKey: privateSnapshot && privateSnapshot.docs.length > 0 ?
              { id: privateSnapshot.docs[privateSnapshot.docs.length - 1].id } : null,
            hasMorePages: pagesArray.length >= initialLimitCount,
            hasMorePrivatePages: privateArray.length >= initialLimitCount,
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
      // This is a simplified version of fetchInitialPages that doesn't update loading state
      const isOwner = currentUserId && userId === currentUserId;

      // Define queries similar to fetchInitialPages
      let publicPagesQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        limit(initialLimitCount)
      );

      let privatePagesQuery = null;
      if (includePrivate && isOwner) {
        privatePagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          where('isPublic', '==', false),
          orderBy('lastModified', 'desc'),
          limit(initialLimitCount)
        );
      }

      // Execute the queries
      const publicPagesPromise = getDocs(publicPagesQuery);
      const privatePagesPromise = privatePagesQuery ? getDocs(privatePagesQuery) : Promise.resolve(null);

      const [publicSnapshot, privateSnapshot] = await Promise.all([
        publicPagesPromise,
        privatePagesPromise
      ]);

      // Process results and update state
      const pagesArray = [];
      publicSnapshot.forEach((doc) => {
        try {
          const pageData = { id: doc.id, ...doc.data() };
          pagesArray.push(pageData);
        } catch (docError) {
          console.error(`Error processing public document ${doc.id}:`, docError);
        }
      });

      const privateArray = [];
      if (privateSnapshot) {
        privateSnapshot.forEach((doc) => {
          try {
            const pageData = { id: doc.id, ...doc.data() };
            privateArray.push(pageData);
          } catch (docError) {
            console.error(`Error processing private document ${doc.id}:`, docError);
          }
        });
      }

      // Update state with fresh data
      setPages(pagesArray);
      setPrivatePages(privateArray);

      // Update pagination state
      setHasMorePages(pagesArray.length >= initialLimitCount);
      setHasMorePrivatePages(privateArray.length >= initialLimitCount);

      // Update last keys for pagination
      if (publicSnapshot.docs.length > 0) {
        setLastPageKey(publicSnapshot.docs[publicSnapshot.docs.length - 1]);
      }

      if (privateSnapshot && privateSnapshot.docs.length > 0) {
        setLastPrivatePageKey(privateSnapshot.docs[privateSnapshot.docs.length - 1]);
      }

      // Update cache with fresh data
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const cacheKey = `user_pages_${userId}_${isOwner ? 'owner' : 'visitor'}_${initialLimitCount}`;
          const cacheData = {
            pages: pagesArray,
            privatePages: privateArray,
            lastPageKey: publicSnapshot.docs.length > 0 ? { id: publicSnapshot.docs[publicSnapshot.docs.length - 1].id } : null,
            lastPrivatePageKey: privateSnapshot && privateSnapshot.docs.length > 0 ?
              { id: privateSnapshot.docs[privateSnapshot.docs.length - 1].id } : null,
            hasMorePages: pagesArray.length >= initialLimitCount,
            hasMorePrivatePages: privateArray.length >= initialLimitCount,
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
      if (!lastPageKey) {
        setHasMorePages(false);
        throw new Error("No more pages to load");
      }

      // Check if the current user is the owner of the pages
      const isOwner = currentUserId && userId === currentUserId;

      // Define the fields we need to reduce data transfer
      const requiredFields = ['title', 'lastModified', 'isPublic', 'userId', 'groupId', 'createdAt'];

      // Query for more public pages
      const moreQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        startAfter(lastPageKey),
        limit(loadMoreLimitCount)
      );

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
          newPagesArray.push(pageData);
        } catch (docError) {
          console.error(`Error processing document ${doc.id}:`, docError);
        }
      });

      setPages((prevPages) => [...prevPages, ...newPagesArray]);

      // Update pagination state
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

  // Function to fetch more private pages
  const fetchMorePrivatePages = async (): Promise<PageData[]> => {
    try {
      // Check if the current user is the owner of the pages
      const isOwner = currentUserId && userId === currentUserId;

      if (!isOwner) {
        throw new Error("You don't have permission to view private pages");
      }

      if (!lastPrivatePageKey) {
        setHasMorePrivatePages(false);
        throw new Error("No more private pages to load");
      }

      // Define the fields we need to reduce data transfer
      const requiredFields = ['title', 'lastModified', 'isPublic', 'userId', 'groupId', 'createdAt'];

      // Query for more private pages
      const moreQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        where('isPublic', '==', false),
        orderBy('lastModified', 'desc'),
        startAfter(lastPrivatePageKey),
        limit(loadMoreLimitCount)
      );

      setIsMorePrivateLoading(true);

      // Set up a timeout to detect stalled queries
      const timeoutId = setTimeout(() => {
        console.warn("usePages: Load more private query taking too long, may be stalled");
        setIsMorePrivateLoading(false);
        setError("Failed to load more private pages. Please try again later.");
      }, 5000);

      const snapshot = await getDocs(moreQuery);
      clearTimeout(timeoutId);

      const newPrivateArray = [];

      snapshot.forEach((doc) => {
        try {
          const pageData = { id: doc.id, ...doc.data() };
          newPrivateArray.push(pageData);
        } catch (docError) {
          console.error(`Error processing private document ${doc.id}:`, docError);
        }
      });

      setPrivatePages((prevPages) => [...prevPages, ...newPrivateArray]);

      // Update pagination state
      setHasMorePrivatePages(snapshot.docs.length >= loadMoreLimitCount);

      // Update last key for pagination
      if (snapshot.docs.length > 0) {
        setLastPrivatePageKey(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        setHasMorePrivatePages(false);
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
              privatePages: [...(parsed.privatePages || []), ...newPrivateArray],
              lastPrivatePageKey: snapshot.docs.length > 0 ? { id: snapshot.docs[snapshot.docs.length - 1].id } : parsed.lastPrivatePageKey,
              hasMorePrivatePages: snapshot.docs.length >= loadMoreLimitCount,
              timestamp: Date.now()
            };
            localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
          }
        }
      } catch (cacheError) {
        console.error("Error updating cache after loading more private pages:", cacheError);
      }

      setIsMorePrivateLoading(false);
      return newPrivateArray;
    } catch (err) {
      console.error("Error fetching more private pages:", err);
      setError("Failed to load more private pages. Please try again later.");
      setIsMorePrivateLoading(false);
      throw err;
    }
  };

  // Track fetch attempts to prevent infinite loops
  const fetchAttemptsRef = useRef(0);
  const maxFetchAttempts = 3;
  const lastFetchTimeRef = useRef(0);

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
          setPrivatePages([]);
          setHasMorePages(false);
          setHasMorePrivatePages(false);
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
        // Execute the fetch function (now returns a no-op unsubscribe)
        unsubscribe = await fetchInitialPages();

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
  }, [userId, currentUserId, initialLimitCount, includePrivate]);

  return {
    pages,
    privatePages,
    loading,
    error,
    hasMorePages,
    hasMorePrivatePages,
    isMoreLoading,
    isMorePrivateLoading,
    fetchMorePages,
    fetchMorePrivatePages
  };
};

export default usePages;
