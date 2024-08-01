"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext } from "react";
import {getCollection} from "../firebase/database";

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    fetchPages();

    setLoading(false);
  }, []);

  const fetchPages = async () => {
    const pages = await getCollection("pages");
    setPages(pages.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  // a way for a delete method to update the state
  const deletePageState = (id) => {
    // refetch pages
    fetchPages();
  };

  return (
    <DataContext.Provider value={{ loading, pages,deletePageState,fetchPages }}>
      {children}
    </DataContext.Provider>
  );
};
