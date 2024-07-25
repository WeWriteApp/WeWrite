"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext } from "react";
import {getCollection} from "../firebase/database";

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    const fetchPages = async () => {
      const pages = await getCollection("pages");
      setPages(pages.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };

    fetchPages();

    setLoading(false);
  }, []);

  return (
    <DataContext.Provider value={{ loading, pages }}>
      {children}
    </DataContext.Provider>
  );
};
