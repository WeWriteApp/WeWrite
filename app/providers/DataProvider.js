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
    hasMorePages,
    error
  } = usePages(user ? user.uid : null, true, user?.uid, false); // Use `user.uid` to fetch pages for the logged-in user, with default limit for home page

  // Add enhanced debugging
  useEffect(() => {
    console.log("DataProvider state:", {
      hasUser: !!user,
      userId: user?.uid,
      isAuthenticated,
      authState: auth.currentUser ? 'Firebase auth active' : 'No Firebase auth',
      cookieAuth: Cookies.get('authState') || 'No auth cookie',
      pagesLoaded: pages?.length || 0,
      isLoading: loading
    });

    // Force a re-render if user is authenticated but pages aren't loading
    if (isAuthenticated && user?.uid && pages && !pages.length && !loading) {
      console.log("DataProvider: User authenticated but no pages loaded, forcing refresh");
      // Use a small timeout to avoid immediate re-render
      const timer = setTimeout(() => {
        // This will trigger the usePages hook to re-fetch
        const refreshEvent = new CustomEvent('force-refresh-pages');
        window.dispatchEvent(refreshEvent);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user, isAuthenticated, pages, loading]);

  // Log any errors from usePages
  useEffect(() => {
    if (error) {
      console.error("DataProvider received error from usePages:", error);
    }
  }, [error]);

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