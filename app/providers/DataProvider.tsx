"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import useOptimizedPages from "../hooks/useOptimizedPages";
import { auth } from "../firebase/config";
import { useAuth } from "./AuthProvider";
import Cookies from 'js-cookie';

/**
 * Page data interface
 */
interface PageData {
  id: string;
  title?: string;
  content?: string;
  authorId?: string;
  createdAt?: any;
  updatedAt?: any;
  isPrivate?: boolean;
  groupId?: string;
  [key: string]: any;
}

/**
 * Data context interface
 */
interface DataContextType {
  loading: boolean;
  pages: PageData[];
  filtered: PageData[];
  loadMorePages: () => void;
  isMoreLoading: boolean;
  hasMorePages: boolean;
  isAuthenticated: boolean;
  forceLoaded: boolean;
  error: string | null;
  errorVisible: boolean;
  resetLoading: () => void;
  recoveryAttempted: boolean;
  dismissError: () => void;
}

/**
 * Data provider props interface
 */
interface DataProviderProps {
  children: ReactNode;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

/**
 * DataProvider component that manages application data state
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export const DataProvider = ({ children }: DataProviderProps) => {
  // Use the AuthProvider to get the authenticated user
  const { user, isAuthenticated } = useAuth();

  // Add enhanced timeout and recovery mechanisms to prevent infinite loading
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shortTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [forceLoaded, setForceLoaded] = useState<boolean>(false);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [recoveryAttempted, setRecoveryAttempted] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const initialRenderRef = useRef<boolean>(true);

  // Use the optimized pages hook, passing in the userId if the user is authenticated
  const {
    pages,
    loading: pagesLoading,
    loadMorePages,
    isMoreLoading,
    hasMorePages,
    error,
    refreshPages
  } = useOptimizedPages(user ? user.uid : null, true, user?.uid, false); // Use `user.uid` to fetch pages for the logged-in user, with default limit for home page

  // Derive loading state with timeout protection
  const [loading, setLoading] = useState<boolean>(pagesLoading);

  // Mark hydration as complete after initial render
  useEffect(() => {
    // Set hydrated state to true after component mounts
    setHydrated(true);

    // Listen for page transition events
    const handlePageTransitionMounted = () => {
      console.log("DataProvider: Detected page transition mounted event");
      // Reset recovery state on new page transitions
      setRecoveryAttempted(false);
    };

    window.addEventListener('page-transition-mounted', handlePageTransitionMounted);

    return () => {
      window.removeEventListener('page-transition-mounted', handlePageTransitionMounted);
    };
  }, []);

  // Update loading state when pagesLoading changes
  useEffect(() => {
    // Skip if not hydrated yet to prevent client/server mismatch
    if (!hydrated && initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

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

      // Set a longer timeout to force loading to complete after 15 seconds
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn("DataProvider: Loading timeout reached, forcing completion");
        setForceLoaded(true);
        setLoading(false);

        // Dispatch an event that other components can listen for
        const timeoutEvent = new CustomEvent('data-provider-timeout', {
          detail: {
            loadingDuration: Date.now() - (loadingStartTime || Date.now()),
            reason: 'timeout'
          }
        });
        window.dispatchEvent(timeoutEvent);
      }, 15000); // 15 seconds timeout - increased for better stability
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

        // Reset recovery state on successful load
        setRecoveryAttempted(false);
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
    const debugInfo = {
      hasUser: !!user,
      userId: user?.uid,
      username: user?.username,
      isAuthenticated,
      authState: auth.currentUser ? 'Firebase auth active' : 'No Firebase auth',
      cookieAuth: Cookies.get('authState') || 'No auth cookie',
      pagesLoaded: pages?.length || 0,
      isLoading: loading,
      forceLoaded,
      recoveryAttempted
    };

    console.log("DataProvider state:", debugInfo);

    // Enhanced logging for user "surya" to help debug the infinite refresh issue
    if (user?.username === 'surya' || user?.email?.includes('surya')) {
      console.log("SURYA DEBUG: DataProvider state", {
        ...debugInfo,
        timestamp: new Date().toISOString(),
        loadingStartTime,
        pagesError: error
      });
    }

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

  // Handle errors from usePages
  const [errorVisible, setErrorVisible] = useState<boolean>(false);

  useEffect(() => {
    if (error) {
      console.error("DataProvider received error from usePages:", error);

      // Show error message to user
      setErrorVisible(true);

      // Auto-hide error after 10 seconds
      const hideErrorTimer = setTimeout(() => {
        setErrorVisible(false);
      }, 10000);

      return () => clearTimeout(hideErrorTimer);
    } else {
      setErrorVisible(false);
    }
  }, [error]);

  // Listen for the loading-force-completed event
  useEffect(() => {
    const handleForceComplete = (event: CustomEvent): void => {
      console.log("DataProvider: Received force-complete event", event.detail);

      // Force loading to false
      setForceLoaded(true);
      setLoading(false);

      // If we have pages data, don't show error UI
      if (pages && pages.length > 0) {
        setErrorVisible(false);
      }
    };

    window.addEventListener('loading-force-completed', handleForceComplete);

    return () => {
      window.removeEventListener('loading-force-completed', handleForceComplete);
    };
  }, [pages]);

  // Optionally: Handle filtered pages if needed
  const filtered: PageData[] = [];

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

  // Function to reset loading state and attempt recovery with enhanced error handling
  const resetLoading = useCallback(() => {
    console.log("DataProvider: Manually resetting loading state");

    // First, try to force complete any existing loading state
    setForceLoaded(true);
    setLoading(false);

    // Clear any existing timeouts
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    if (shortTimeoutRef.current) {
      clearTimeout(shortTimeoutRef.current);
      shortTimeoutRef.current = null;
    }

    // Hide any error messages
    setErrorVisible(false);

    // Dispatch an event that other components can listen for
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('loading-force-completed', {
        detail: { source: 'DataProvider', reason: 'manual-reset' }
      }));
    }

    // After a short delay, attempt to refresh data
    setTimeout(() => {
      // Reset states to prepare for a fresh data load
      setForceLoaded(false);
      setRecoveryAttempted(false);
      setLoadingStartTime(Date.now()); // Start a new loading timer

      // Use the refreshPages function directly instead of dispatching an event
      if (refreshPages) {
        console.log("DataProvider: Attempting data refresh after reset");
        refreshPages();
      } else {
        // Fallback to the event if refreshPages is not available
        const refreshEvent = new CustomEvent('force-refresh-pages');
        window.dispatchEvent(refreshEvent);
      }

      // Set up new timeouts with more aggressive recovery
      shortTimeoutRef.current = setTimeout(() => {
        console.warn("DataProvider: Short recovery timeout reached after manual reset");
        // If still loading, force it to complete
        setForceLoaded(true);
        setLoading(false);
      }, 3000); // Reduced from 5000ms to 3000ms for faster recovery
    }, 100);
  }, [pagesLoading, refreshPages]);

  const value: DataContextType = {
    loading: isAuthenticated ? loading : false, // Only show loading state for authenticated users
    pages,
    filtered,
    loadMorePages,
    isMoreLoading,
    hasMorePages,
    isAuthenticated, // Add the authentication state to the context
    forceLoaded, // Expose the force loaded state
    error, // Expose any errors from usePages
    errorVisible, // Expose whether the error is visible
    resetLoading, // Expose the enhanced reset loading function
    recoveryAttempted, // Expose whether recovery has been attempted
    dismissError: () => setErrorVisible(false) // Function to dismiss the error
  };

  return (
    <DataContext.Provider value={value}>
      {children}

      {/* Error Toast - Only shown when errorVisible is true */}
      {errorVisible && error && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-50 dark:bg-red-900/50 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg shadow-lg border border-red-200 dark:border-red-800 max-w-md w-full">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium">{error}</p>
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={resetLoading}
                  className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={() => setErrorVisible(false)}
                  className="text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DataContext.Provider>
  );
};

/**
 * Hook to use the data context
 *
 * @returns The data context value
 * @throws Error if used outside of DataProvider
 */
export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};