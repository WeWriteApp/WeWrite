'use client'
import { useState, useEffect, useContext } from "react";
import { db } from "../firebase/database";
import { collection, query, where, orderBy, onSnapshot, limit, startAfter } from "firebase/firestore";
import { AppContext } from "@/providers/AppProvider";

const limitCount = 25;

const usePages = (userId: string | null) => {
  const [pages, setPages] = useState<any>([]);
  const [lastPageKey, setLastPageKey] = useState<any>(null);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);

  const { loading, setLoading } = useContext(AppContext)

  const fetchPages = (paginationStartDoc = null) => {
    let pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId),  // userId passed as argument
      orderBy('lastModified', 'desc'),
      limit(limitCount)
    );

    if (paginationStartDoc) {
      pagesQuery = query(pagesQuery, startAfter(paginationStartDoc));
    }

    setLoading(true);

    const unsubscribe = onSnapshot(pagesQuery, (snapshot) => {
      const newPagesArray = [];

      snapshot.docChanges().forEach((change) => {
        const newPage = { id: change.doc.id, ...change.doc.data() };

        newPagesArray.push(newPage);

        setPages((prevPages: any) => {
          const updatedPages = [...prevPages];

          const existingIndex = updatedPages.findIndex((page) => page.id === newPage.id);

          if (change.type === 'added' && existingIndex === -1) {
            updatedPages.push(newPage);
          } else if (change.type === 'modified' && existingIndex !== -1) {
            updatedPages[existingIndex] = newPage;
          } else if (change.type === 'removed' && existingIndex !== -1) {
            updatedPages.splice(existingIndex, 1);
          }

          return updatedPages.sort((a: any, b: any) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
        });
      });

      if (newPagesArray.length < limitCount) {
        setHasMorePages(false);
      } else {
        setHasMorePages(true);
      }

      if (newPagesArray.length > 0) {
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastPageKey(lastDoc);
      }

      setLoading(false);
      setIsMoreLoading(false);
    });

    return unsubscribe;
  };

  useEffect(() => {
    if (userId) {
      fetchPages();
    }
  }, [userId]);

  const loadMorePages = () => {
    if (lastPageKey && hasMorePages) {
      setIsMoreLoading(true);
      fetchPages(lastPageKey);
    }
  };

  return { pages, loading, loadMorePages, isMoreLoading, hasMorePages, setLoading };
};

export default usePages;
