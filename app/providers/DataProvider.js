"use client";
import { createContext, useContext } from "react";
import { AuthContext } from "./AuthProvider";
import usePages from "../hooks/usePages";

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const { user } = useContext(AuthContext); // Get the authenticated user

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