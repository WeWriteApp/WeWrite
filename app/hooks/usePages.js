import { useState, useEffect } from "react";
import { db } from "../firebase/database";
import { collection, query, where, orderBy, onSnapshot, limit, startAfter } from "firebase/firestore";

const limitCount = 25;

const usePages = (userId, includePrivate = true) => {
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

  const fetchInitialPages = () => {
    let pagesQuery;
    
    if (includePrivate) {
      // Get all pages for the user
      pagesQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        orderBy('lastModified', 'desc'),
        limit(limitCount)
      );
    } else {
      // Get only public pages
      pagesQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        limit(limitCount)
      );
    }

    setLoading(true);

    const unsubscribe = onSnapshot(pagesQuery, (snapshot) => {
      const pagesArray = [];
      const privateArray = [];

      snapshot.forEach((doc) => {
        const pageData = { id: doc.id, ...doc.data() };
        if (pageData.isPublic) {
          pagesArray.push(pageData);
        } else {
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
    });

    return unsubscribe;
  };

  const fetchMorePages = (paginationStartDoc) => {
    if (!paginationStartDoc) return;
    
    let moreQuery;
    
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
  
        // Append new pages to existing pages
        setPages(prevPages => [...prevPages, ...newPagesArray]);
  
        if (newPagesArray.length < limitCount) {
          setHasMorePages(false);
        } else {
          setHasMorePages(true);
        }
  
        if (snapshot.docs.length > 0) {
          const lastDoc = snapshot.docs[snapshot.docs.length - 1];
          setLastPageKey(lastDoc);
        }
  
        setIsMoreLoading(false);
      });
    } else {
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
        const newPrivatePagesArray = [];
  
        snapshot.forEach((doc) => {
          const pageData = { id: doc.id, ...doc.data() };
          if (!pageData.isPublic) {
            newPrivatePagesArray.push(pageData);
          }
        });
  
        // Append new pages to existing private pages
        setPrivatePages(prevPages => [...prevPages, ...newPrivatePagesArray]);
  
        if (newPrivatePagesArray.length < limitCount) {
          setHasMorePrivatePages(false);
        } else {
          setHasMorePrivatePages(true);
        }
  
        if (snapshot.docs.length > 0) {
          const lastDoc = snapshot.docs[snapshot.docs.length - 1];
          setLastPrivatePageKey(lastDoc);
        }
  
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
    setActiveTab
  };
};

export default usePages;
