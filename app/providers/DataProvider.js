"use client";
import { createContext, useContext, useState, useEffect } from "react";
import usePages from "../hooks/usePages";
import { auth } from "../firebase/config";
import { useAuth } from "./AuthProvider";
import Cookies from 'js-cookie';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // Use the AuthProvider to get the authenticated user
  const { user, isAuthenticated } = useAuth();

  // Use the usePages hook, passing in the userId if the user is authenticated
  const {
    pages,
    loading,
    loadMorePages,
    isMoreLoading,
    hasMorePages
  } = usePages(user ? user.uid : null, true, user?.uid, false); // Use `user.uid` to fetch pages for the logged-in user, with default limit for home page

  // Optionally: Handle filtered pages if needed
  const filtered = [];

  return (
    <DataContext.Provider
      value={{
        loading: isAuthenticated ? loading : false, // Only show loading state for authenticated users
        pages,
        filtered,
        loadMorePages,
        isMoreLoading,
        hasMorePages,
        isAuthenticated // Add the authentication state to the context
      }}
    >
      {children}
    </DataContext.Provider>
  );
};