"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { AuthContext } from "./AuthProvider";
import { getPages } from "../firebase/database";

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPages = async () => {
      try {
        const fetchedPages = await getPages();
        setPages(fetchedPages);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [user]);

  const filtered = pages.filter(page =>
    page.isPublic || (user && (page.userId === user.uid || (user.groups && user.groups.includes(page.groupId))))
  );

  return (
    <DataContext.Provider
      value={{
        loading,
        error,
        pages,
        filtered,
        loadMorePages: () => {},
        isMoreLoading: false,
        hasMorePages: false
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
