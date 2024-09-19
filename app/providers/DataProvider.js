"use client";
import { useEffect, useState, createContext, useContext } from "react";
import { AuthContext } from "./AuthProvider";
import { db } from "../firebase/database";
import { collection, query, where, orderBy, limit, startAfter, onSnapshot } from "firebase/firestore"; 

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const { user } = useContext(AuthContext);
  const [filtered, setFiltered] = useState([]);
  const [lastPageKey, setLastPageKey] = useState(null); // For pagination
  const [isMoreLoading, setIsMoreLoading] = useState(false); // For pagination
  const [hasMorePages, setHasMorePages] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPages(user.uid);
    } else {
      setPages([]);
      setLoading(false);
    }
  }, [user]);

  const limitCount = 50;
  const fetchPages = async (userId,paginationStartDoc = null) => {
    let pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId),
      orderBy('lastModified', 'desc'),
      limit(limitCount)
    );
  
    if (paginationStartDoc) {
      pagesQuery = query(pagesQuery, startAfter(paginationStartDoc));
    }
  
    const unsubscribe = onSnapshot(pagesQuery, (snapshot) => {
      const newPagesArray = [];
  
      snapshot.docChanges().forEach((change) => {
        const newPage = {
          id: change.doc.id,
          ...change.doc.data(),
        };
  
        newPagesArray.push(newPage);
  
        setPages((prevPages) => {
          const updatedPages = [...prevPages];
  
          // Check for duplicate or existing page
          const existingIndex = updatedPages.findIndex((page) => page.id === newPage.id);
  
          if (change.type === 'added') {
            if (existingIndex === -1) {
              // If not found, add the page
              updatedPages.push(newPage);
            }
          } else if (change.type === 'modified') {
            if (existingIndex !== -1) {
              // If found, update the existing page
              updatedPages[existingIndex] = newPage;
            }
          } else if (change.type === 'removed') {
            if (existingIndex !== -1) {
              // If found, remove the page
              updatedPages.splice(existingIndex, 1);
            }
          }
  
          // Sort pages by lastModified in descending order
          updatedPages.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
  
          return updatedPages;
        });
      });
  
      // If no new pages are added, this means we've reached the end
      if (newPagesArray.length < limitCount) {
        setHasMorePages(false); // No more pages to load
      } else {
        setHasMorePages(true); // More pages available
      }
  
      if (newPagesArray.length > 0) {
        // Set the last document for pagination
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastPageKey(lastDoc);
      }
  
      setLoading(false);
      setIsMoreLoading(false);
    });
  
    return unsubscribe;
  };
  
  const loadMorePages = (userId) => {
    if (lastPageKey && hasMorePages) {
      setIsMoreLoading(true); // Set loading state for "Load More"
      fetchPages(lastPageKey); // Fetch the next set of pages starting after the last one
    }
  };


  return (
    <DataContext.Provider value={{ loading, pages, filtered, loadMorePages, isMoreLoading, hasMorePages }}>
      {children}
    </DataContext.Provider>
  );
};
