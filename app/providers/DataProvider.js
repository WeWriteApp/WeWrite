"use client";
import { createContext, useContext, useState, useEffect } from "react";
import usePages from "../hooks/usePages";
import { auth } from "../firebase/config";

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Listen for auth state changes directly instead of using AuthContext
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      setUser(authUser);
    });
    
    return () => unsubscribe();
  }, []);

  // Use the usePages hook, passing in the userId if the user is authenticated
  const {
    pages,
    loading,
    loadMorePages,
    isMoreLoading,
    hasMorePages
  } = usePages(user ? user.uid : null); // Use `user.uid` to fetch pages for the logged-in user

  // Optionally: Handle filtered pages if needed
  const filtered = [];

  return (
    <DataContext.Provider
      value={{
        loading: user ? loading : false, // Only show loading state for logged-in users
        pages,
        filtered,
        loadMorePages,
        isMoreLoading,
        hasMorePages
      }}
    >
      {children}
    </DataContext.Provider>
  );
};