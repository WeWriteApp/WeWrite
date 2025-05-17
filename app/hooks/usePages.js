import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../firebase/database";
import { collection, query, where, orderBy, onSnapshot, limit, startAfter, getDocs } from "firebase/firestore";

// Default limits for page loading
const DEFAULT_INITIAL_LIMIT = 20; // Default limit for home page
const USER_PAGE_INITIAL_LIMIT = 300; // Higher limit for user pages (increased from 200)
const loadMoreLimitCount = 100;

const usePages = (userId, includePrivate = true, currentUserId = null, isUserPage = false) => {
  // Use higher limit for user pages, default limit for home page
  const initialLimitCount = isUserPage ? USER_PAGE_INITIAL_LIMIT : DEFAULT_INITIAL_LIMIT;
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const [privatePages, setPrivatePages] = useState([]);
  const [lastPageKey, setLastPageKey] = useState(null);
  const [lastPrivatePageKey, setLastPrivatePageKey] = useState(null);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [isMorePrivateLoading, setIsMorePrivateLoading] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [hasMorePrivatePages, setHasMorePrivatePages] = useState(true);
  const [error, setError] = useState(null);

  const fetchInitialPages = () => {
    let pagesQuery;
    let querySetupStartTime = Date.now();

    // Check if the current user is the owner of the pages
    const isOwner = currentUserId && userId === currentUserId;

    try {
      if (includePrivate && isOwner) {
        // Get all pages for the user (both public and private) if the current user is the owner
        pagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          orderBy('lastModified', 'desc'),
          limit(initialLimitCount)
        );
      } else {
        // Get only public pages if the current user is not the owner
        pagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          where('isPublic', '==', true),
          orderBy('lastModified', 'desc'),
          limit(initialLimitCount)
        );
      }

      console.log(`usePages: Query setup took ${Date.now() - querySetupStartTime}ms`);
    } catch (querySetupError) {
      console.error("Error setting up Firestore query:", querySetupError);
      setError("Failed to set up database query. Please try refreshing the page.");
      setLoading(false);
      throw querySetupError;
    }

    setLoading(true);
    setError(null);

    // Set up a timeout to detect stalled queries
    const queryTimeoutId = setTimeout(() => {
      console.warn("usePages: Query execution taking too long, may be stalled");
      // Force loading to false after timeout to prevent infinite loading state
      setLoading(false);

      // Instead of just setting an error, provide empty data as a fallback
      if (pages.length === 0) {
        console.log("usePages: Providing empty data as fallback");
        setPages([]);
        setPrivatePages([]);
      }

      setError("Query execution is taking longer than expected. Please try refreshing the page.");

      // Dispatch an event that other components can listen for
      if (typeof window !== 'undefined') {
        const forceCompleteEvent = new CustomEvent('loading-force-completed', {
          detail: { source: 'usePages', reason: 'query-timeout' }
        });
        window.dispatchEvent(forceCompleteEvent);
      }
    }, 3000); // Reduced to 3 seconds for faster recovery

    try {
      const unsubscribe = onSnapshot(pagesQuery, (snapshot) => {
        // Clear the query timeout since we got a response
        clearTimeout(queryTimeoutId);

        try {
          const pagesArray = [];
          const privateArray = [];

          console.log(`usePages: Received snapshot with ${snapshot.docs.length} documents`);

          snapshot.forEach((doc) => {
            try {
              const pageData = { id: doc.id, ...doc.data() };

              // Only include private pages if the current user is the owner
              if (pageData.isPublic) {
                pagesArray.push(pageData);
              } else if (isOwner) {
                privateArray.push(pageData);
              }
            } catch (docError) {
              console.error(`Error processing document ${doc.id}:`, docError);
              // Continue processing other documents
            }
          });

          setPages(pagesArray);
          setPrivatePages(privateArray);

          if (pagesArray.length < initialLimitCount) {
            setHasMorePages(false);
          } else {
            setHasMorePages(true);
          }

          if (privateArray.length < initialLimitCount) {
            setHasMorePrivatePages(false);
          } else {
            setHasMorePrivatePages(true);
          }

          // Set the last document keys for pagination
          const publicDocs = snapshot.docs.filter(doc => {
            try {
              return doc.data().isPublic;
            } catch (e) {
              console.error(`Error checking if doc ${doc.id} is public:`, e);
              return false;
            }
          });

          const privateDocs = snapshot.docs.filter(doc => {
            try {
              return !doc.data().isPublic;
            } catch (e) {
              console.error(`Error checking if doc ${doc.id} is private:`, e);
              return false;
            }
          });

          if (publicDocs.length > 0) {
            setLastPageKey(publicDocs[publicDocs.length - 1]);
          }

          if (privateDocs.length > 0 && isOwner) {
            setLastPrivatePageKey(privateDocs[privateDocs.length - 1]);
          }

          setLoading(false);
        } catch (processingError) {
          console.error("Error processing snapshot data:", processingError);
          setError("Failed to process page data. Please try refreshing the page.");
          setLoading(false);
        }
      }, (err) => {
        // Clear the query timeout since we got an error response
        clearTimeout(queryTimeoutId);

        console.error("Error fetching pages:", err);
        setError("Failed to load pages. Please try again later.");
        setLoading(false);
      });

      return unsubscribe;
    } catch (snapshotError) {
      // Clear the query timeout if we fail to set up the snapshot
      clearTimeout(queryTimeoutId);

      console.error("Error setting up snapshot listener:", snapshotError);
      setError("Failed to set up data listener. Please try refreshing the page.");
      setLoading(false);
      throw snapshotError;
    }
  };

  // Function to fetch more pages
  const fetchMorePages = async () => {
    try {
      if (!lastPageKey) {
        setHasMorePages(false);
        throw new Error("No more pages to load");
      }

      // Check if the current user is the owner of the pages
      const isOwner = currentUserId && userId === currentUserId;

      let moreQuery;
      if (includePrivate && isOwner) {
        // Get public pages for the user
        moreQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          where('isPublic', '==', true),
          orderBy('lastModified', 'desc'),
          startAfter(lastPageKey),
          limit(loadMoreLimitCount)
        );
      } else {
        // Get only public pages if the current user is not the owner
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

      const snapshot = await getDocs(moreQuery);
      const newPagesArray = [];

      snapshot.forEach((doc) => {
        const pageData = { id: doc.id, ...doc.data() };
        if (pageData.isPublic) {
          newPagesArray.push(pageData);
        }
      });

      setPages((prevPages) => [...prevPages, ...newPagesArray]);

      if (snapshot.docs.length < loadMoreLimitCount) {
        setHasMorePages(false);
      }

      if (snapshot.docs.length > 0) {
        setLastPageKey(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        setHasMorePages(false);
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
  const fetchMorePrivatePages = async () => {
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

      // Only fetch private pages if the current user is the owner
      const moreQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        where('isPublic', '==', false),
        orderBy('lastModified', 'desc'),
        startAfter(lastPrivatePageKey),
        limit(loadMoreLimitCount)
      );

      setIsMorePrivateLoading(true);

      const snapshot = await getDocs(moreQuery);
      const newPrivateArray = [];

      snapshot.forEach((doc) => {
        const pageData = { id: doc.id, ...doc.data() };
        if (!pageData.isPublic) {
          newPrivateArray.push(pageData);
        }
      });

      setPrivatePages((prevPages) => [...prevPages, ...newPrivateArray]);

      if (snapshot.docs.length < loadMoreLimitCount) {
        setHasMorePrivatePages(false);
      }

      if (snapshot.docs.length > 0) {
        setLastPrivatePageKey(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        setHasMorePrivatePages(false);
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

        // Provide empty data as a fallback
        if (pages.length === 0) {
          console.log("usePages: Hard timeout - providing empty data as fallback");
          setPages([]);
          setPrivatePages([]);
          setHasMorePages(false);
          setHasMorePrivatePages(false);
        }

        // Set a more user-friendly error message
        setError("We couldn't load your content. You can continue browsing with limited functionality.");

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
    }, 8000); // Reduced from 15 to 8 seconds for faster recovery

    const attemptFetch = () => {
      // Increment fetch attempts
      fetchAttemptsRef.current += 1;
      lastFetchTimeRef.current = Date.now();

      console.log(`usePages: Fetching pages for user ${userId}, attempt ${fetchAttemptsRef.current}`);

      try {
        // Clean up any existing subscription
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }

        // Set up new subscription
        unsubscribe = fetchInitialPages();

        // Reset fetch attempts on successful setup
        fetchAttemptsRef.current = 0;
      } catch (err) {
        console.error("usePages: Error setting up page listener:", err);
        setError("Failed to set up page listener. Please try refreshing the page.");
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
  }, [userId]);

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
