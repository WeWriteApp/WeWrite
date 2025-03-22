import { useState, useEffect } from "react";
import { db } from "../firebase/database";
import { collection, query, where, orderBy, onSnapshot, limit, startAfter } from "firebase/firestore";

const limitCount = 25;

const usePages = (userId, includePrivate = true, currentUserId = null) => {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const [privatePages, setPrivatePages] = useState([]);
  const [lastPageKey, setLastPageKey] = useState(null);
  const [lastPrivatePageKey, setLastPrivatePageKey] = useState(null);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [isMorePrivateLoading, setIsMorePrivateLoading] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [hasMorePrivatePages, setHasMorePrivatePages] = useState(true);
  const [activeTab, setActiveTab] = useState('public');
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
        limit(limitCount)
      );
    } else {
      // Get only public pages if the current user is not the owner
      pagesQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        limit(limitCount)
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

      if (pagesArray.length < limitCount) {
        setHasMorePages(false);
      } else {
        setHasMorePages(true);
      }

      if (privateArray.length < limitCount) {
        setHasMorePrivatePages(false);
      } else {
        setHasMorePrivatePages(true);
      }

      if (snapshot.docs.length > 0) {
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastPageKey(lastDoc);
        setLastPrivatePageKey(lastDoc);
      }

      setLoading(false);
    }, (err) => {
      console.error("Error fetching pages:", err);
      setError("Failed to load pages. Please try again later.");
      setLoading(false);
    });

    return unsubscribe;
  };

  const fetchMorePages = (paginationStartDoc) => {
    if (!paginationStartDoc) return;
    
    let moreQuery;
    // Check if the current user is the owner of the pages
    const isOwner = currentUserId && userId === currentUserId;
    
    if (activeTab === 'public') {
      moreQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        startAfter(paginationStartDoc),
        limit(limitCount)
      );
      
      setIsMoreLoading(true);
      
      onSnapshot(moreQuery, (snapshot) => {
        const newPagesArray = [];
        
        snapshot.forEach((doc) => {
          const pageData = { id: doc.id, ...doc.data() };
          if (pageData.isPublic) {
            newPagesArray.push(pageData);
          }
        });
        
        setPages((prevPages) => [...prevPages, ...newPagesArray]);
        
        if (snapshot.docs.length < limitCount) {
          setHasMorePages(false);
        }
        
        if (snapshot.docs.length > 0) {
          const lastDoc = snapshot.docs[snapshot.docs.length - 1];
          setLastPageKey(lastDoc);
        }
        
        setIsMoreLoading(false);
      }, (err) => {
        console.error("Error fetching more pages:", err);
        setError("Failed to load more pages. Please try again later.");
        setIsMoreLoading(false);
      });
    } else if (activeTab === 'private' && isOwner) {
      // Only fetch private pages if the current user is the owner
      moreQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        where('isPublic', '==', false),
        orderBy('lastModified', 'desc'),
        startAfter(paginationStartDoc),
        limit(limitCount)
      );
      
      setIsMorePrivateLoading(true);
      
      onSnapshot(moreQuery, (snapshot) => {
        const newPrivateArray = [];
        
        snapshot.forEach((doc) => {
          const pageData = { id: doc.id, ...doc.data() };
          if (!pageData.isPublic) {
            newPrivateArray.push(pageData);
          }
        });
        
        setPrivatePages((prevPages) => [...prevPages, ...newPrivateArray]);
        
        if (snapshot.docs.length < limitCount) {
          setHasMorePrivatePages(false);
        }
        
        if (snapshot.docs.length > 0) {
          const lastDoc = snapshot.docs[snapshot.docs.length - 1];
          setLastPrivatePageKey(lastDoc);
        }
        
        setIsMorePrivateLoading(false);
      }, (err) => {
        console.error("Error fetching more private pages:", err);
        setError("Failed to load more private pages. Please try again later.");
        setIsMorePrivateLoading(false);
      });
    }
  };

  useEffect(() => {
    let unsubscribe;
    if (userId) {
      unsubscribe = fetchInitialPages();
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId, includePrivate]);

  const loadMorePages = () => {
    if (activeTab === 'public') {
      if (isMoreLoading || !hasMorePages || !lastPageKey) return;
      fetchMorePages(lastPageKey);
    } else {
      if (isMorePrivateLoading || !hasMorePrivatePages || !lastPrivatePageKey) return;
      fetchMorePages(lastPrivatePageKey);
    }
  };

  return {
    pages,
    privatePages,
    loading,
    loadMorePages,
    isMoreLoading,
    isMorePrivateLoading,
    hasMorePages,
    hasMorePrivatePages,
    activeTab,
    setActiveTab,
    error
  };
};

export default usePages;
