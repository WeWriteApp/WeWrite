import { useState, useEffect } from "react";
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

    // Check if the current user is the owner of the pages
    const isOwner = currentUserId && userId === currentUserId;

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

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(pagesQuery, (snapshot) => {
      const pagesArray = [];
      const privateArray = [];

      snapshot.forEach((doc) => {
        const pageData = { id: doc.id, ...doc.data() };

        // Only include private pages if the current user is the owner
        if (pageData.isPublic) {
          pagesArray.push(pageData);
        } else if (isOwner) {
          privateArray.push(pageData);
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
      const publicDocs = snapshot.docs.filter(doc => doc.data().isPublic);
      const privateDocs = snapshot.docs.filter(doc => !doc.data().isPublic);

      if (publicDocs.length > 0) {
        setLastPageKey(publicDocs[publicDocs.length - 1]);
      }

      if (privateDocs.length > 0 && isOwner) {
        setLastPrivatePageKey(privateDocs[privateDocs.length - 1]);
      }

      setLoading(false);
    }, (err) => {
      console.error("Error fetching pages:", err);
      setError("Failed to load pages. Please try again later.");
      setLoading(false);
    });

    return unsubscribe;
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

  // Fetch initial pages when the component mounts
  useEffect(() => {
    let unsubscribe = () => {};

    if (userId) {
      try {
        console.log("usePages: Fetching pages for user", userId);
        unsubscribe = fetchInitialPages();
      } catch (err) {
        console.error("usePages: Error setting up page listener:", err);
        setError("Failed to set up page listener. Please try refreshing the page.");
        setLoading(false);
      }
    } else {
      console.log("usePages: No userId provided, skipping page fetch");
      setLoading(false);
    }

    // Add listener for force-refresh event
    const handleForceRefresh = () => {
      console.log("usePages: Received force-refresh event, re-fetching pages");
      try {
        // Clean up existing subscription
        unsubscribe();
        // Re-fetch pages
        unsubscribe = fetchInitialPages();
      } catch (err) {
        console.error("usePages: Error during forced refresh:", err);
      }
    };

    window.addEventListener('force-refresh-pages', handleForceRefresh);

    // Cleanup function
    return () => {
      try {
        unsubscribe();
        window.removeEventListener('force-refresh-pages', handleForceRefresh);
      } catch (err) {
        console.error("usePages: Error unsubscribing from page listener:", err);
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
