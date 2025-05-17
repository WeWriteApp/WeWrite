"use client";
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import usePages from "../hooks/usePages";
import { auth } from "../firebase/config";
import { useAuth } from "./AuthProvider";
import Cookies from 'js-cookie';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // Use the AuthProvider to get the authenticated user
  const { user, isAuthenticated } = useAuth();

  // Add enhanced timeout and recovery mechanisms to prevent infinite loading
  const loadingTimeoutRef = useRef(null);
  const shortTimeoutRef = useRef(null);
  const [forceLoaded, setForceLoaded] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);

  // Use the usePages hook, passing in the userId if the user is authenticated
  const {
    pages,
    loading: pagesLoading,
    loadMorePages,
    isMoreLoading,
    hasMorePages,
    error
  } = usePages(user ? user.uid : null, true, user?.uid, false); // Use `user.uid` to fetch pages for the logged-in user, with default limit for home page

  // Derive loading state with timeout protection
  const [loading, setLoading] = useState(pagesLoading);

  // Update loading state when pagesLoading changes
  useEffect(() => {
    // Track when loading starts
    if (pagesLoading && !loadingStartTime) {
      setLoadingStartTime(Date.now());
    }

    // Update loading state
    setLoading(pagesLoading && !forceLoaded);

    // Set up a timeout to prevent infinite loading
    if (pagesLoading && !forceLoaded) {
      // Clear any existing timeouts
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (shortTimeoutRef.current) {
        clearTimeout(shortTimeoutRef.current);
      }

      // Set a short timeout (5 seconds) for initial recovery attempt
      shortTimeoutRef.current = setTimeout(() => {
        if (pagesLoading && !recoveryAttempted) {
          console.warn("DataProvider: Short timeout reached, attempting recovery");
          setRecoveryAttempted(true);

          // Trigger a refresh event to retry data fetching
          const refreshEvent = new CustomEvent('force-refresh-pages');
          window.dispatchEvent(refreshEvent);
        }
      }, 5000); // 5 seconds timeout for first recovery attempt

      // Set a longer timeout to force loading to complete after 10 seconds
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn("DataProvider: Loading timeout reached, forcing completion");
        setForceLoaded(true);
        setLoading(false);

        // If we've been loading for more than 15 seconds, try to recover by reloading
        const loadingDuration = Date.now() - (loadingStartTime || Date.now());
        if (loadingDuration > 15000 && typeof window !== 'undefined') {
          // Check if we've already tried reloading
          const reloadAttempts = parseInt(localStorage.getItem('dataProviderReloadAttempts') || '0');
          if (reloadAttempts < 2) { // Limit to 2 reload attempts
            console.warn("DataProvider: Loading stalled for too long, attempting page reload");
            localStorage.setItem('dataProviderReloadAttempts', (reloadAttempts + 1).toString());

            // Add a small delay before reloading
            setTimeout(() => {
              window.location.reload();
            }, 500);
          } else {
            console.warn("DataProvider: Max reload attempts reached, forcing into a usable state");
            // Reset the counter after 5 minutes
            setTimeout(() => {
              localStorage.setItem('dataProviderReloadAttempts', '0');
            }, 5 * 60 * 1000);
          }
        }
      }, 10000); // 10 seconds timeout (reduced from 15)
    } else {
      // Clear the timeouts if loading completes naturally
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      if (shortTimeoutRef.current) {
        clearTimeout(shortTimeoutRef.current);
        shortTimeoutRef.current = null;
      }

      // Reset loading start time when loading completes
      if (!pagesLoading) {
        setLoadingStartTime(null);

        // Reset reload attempts counter on successful load
        if (typeof window !== 'undefined') {
          localStorage.setItem('dataProviderReloadAttempts', '0');
        }
      }
    }

    return () => {
      // Clean up timeouts on unmount
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      if (shortTimeoutRef.current) {
        clearTimeout(shortTimeoutRef.current);
        shortTimeoutRef.current = null;
      }
    };
  }, [pagesLoading, forceLoaded, loadingStartTime, recoveryAttempted]);

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

  // Reset states when user changes
  useEffect(() => {
    setForceLoaded(false);
    setRecoveryAttempted(false);
    setLoadingStartTime(null);

    // Clear any existing timeouts
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    if (shortTimeoutRef.current) {
      clearTimeout(shortTimeoutRef.current);
      shortTimeoutRef.current = null;
    }
  }, [user?.uid]);

  // Function to reset loading state and attempt recovery
  const resetLoading = useCallback(() => {
    console.log("DataProvider: Manually resetting loading state");

    // Reset states
    setForceLoaded(false);
    setRecoveryAttempted(false);
    setLoadingStartTime(Date.now()); // Start a new loading timer
    setLoading(true); // Force loading state to true

    // Clear any existing timeouts
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    if (shortTimeoutRef.current) {
      clearTimeout(shortTimeoutRef.current);
      shortTimeoutRef.current = null;
    }

    // Trigger a refresh event to retry data fetching
    const refreshEvent = new CustomEvent('force-refresh-pages');
    window.dispatchEvent(refreshEvent);

    // Set up new timeouts
    shortTimeoutRef.current = setTimeout(() => {
      console.warn("DataProvider: Short recovery timeout reached after manual reset");
      // If still loading, force it to complete
      if (pagesLoading) {
        setForceLoaded(true);
        setLoading(false);
      }
    }, 5000);
  }, [pagesLoading]);

  return (
    <DataContext.Provider
      value={{
        loading: isAuthenticated ? loading : false, // Only show loading state for authenticated users
        pages,
        filtered,
        loadMorePages,
        isMoreLoading,
        hasMorePages,
        isAuthenticated, // Add the authentication state to the context
        forceLoaded, // Expose the force loaded state
        error, // Expose any errors from usePages
        resetLoading, // Expose the enhanced reset loading function
        recoveryAttempted // Expose whether recovery has been attempted
      }}
    >
      {children}
    </DataContext.Provider>
  );
};