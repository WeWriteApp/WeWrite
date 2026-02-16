"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from "react";
import useUserPages from "../hooks/useUserPages";
import { auth } from "../firebase/config";
import { useAuth } from './AuthProvider';
import Cookies from 'js-cookie';
import type { Page } from '../types/database';
import { toast } from 'sonner';

/**
 * Page data type - uses centralized Page type with partial fields
 */
type PageData = Partial<Page> & { id: string; [key: string]: any };

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
  // Use the global store to get the authenticated user
  const { user, isAuthenticated } = useAuth();

  // Add enhanced timeout and recovery mechanisms to prevent infinite loading
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shortTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [forceLoaded, setForceLoaded] = useState<boolean>(false);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [recoveryAttempted, setRecoveryAttempted] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const initialRenderRef = useRef<boolean>(true);

  // Use the user pages hook, passing in the userId if the user is authenticated
  const {
    pages,
    loading: pagesLoading,
    error,
    refreshData: refreshPages
  } = useUserPages(user?.uid || '', user?.uid || null, false);

  // useUserPages has pagination, but we provide dummy values for compatibility with existing DataContext interface
  const loadMorePages = () => {};
  const isMoreLoading = false;
  const hasMorePages = false;

  // Derive loading state with timeout protection
  const [loading, setLoading] = useState<boolean>(pagesLoading);

  // Mark hydration as complete after initial render
  useEffect(() => {
    // Set hydrated state to true after component mounts
    setHydrated(true);

    // Listen for page transition events
    const handlePageTransitionMounted = () => {
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

          // Add throttling to prevent rapid recovery attempts
          const lastRecoveryTime = sessionStorage.getItem('lastRecoveryTime');
          const now = Date.now();
          const timeSinceLastRecovery = lastRecoveryTime ? now - parseInt(lastRecoveryTime) : Infinity;

          // Only trigger recovery if it's been at least 10 seconds since last recovery
          if (timeSinceLastRecovery >= 10000) {
            sessionStorage.setItem('lastRecoveryTime', now.toString());

            // Trigger a refresh event to retry data fetching
            const refreshEvent = new CustomEvent('force-refresh-pages');
            window.dispatchEvent(refreshEvent);
          } else {
          }
        }
      }, 5000); // 5 seconds timeout for first recovery attempt

      // PERFORMANCE: Reduced timeout from 20s to 10s for faster perceived navigation
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn("DataProvider: Loading timeout reached, forcing completion");
        setForceLoaded(true);
        setLoading(false);

        // Only show timeout error if we don't have any data
        if (pages.length === 0) {
        }

        // Dispatch an event that other components can listen for
        const timeoutEvent = new CustomEvent('data-provider-timeout', {
          detail: {
            loadingDuration: Date.now() - (loadingStartTime || Date.now()),
            reason: 'timeout',
            hasData: pages.length > 0
          }
        });
        window.dispatchEvent(timeoutEvent);
      }, 10000); // PERFORMANCE: Reduced from 20s to 10s
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

    // REMOVED: Automatic refresh logic that was causing infinite reload loops
    // Having zero pages is a valid state for users and should not trigger automatic refreshes
    // This was causing the infinite refresh bug where users with no pages would get stuck
    // in a continuous reload loop every second.
  }, [user, isAuthenticated, pages, loading]);

  // Handle errors from usePages with improved resilience
  const [errorVisible, setErrorVisible] = useState<boolean>(false);
  const [errorCount, setErrorCount] = useState<number>(0);
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (error) {
      console.error("DataProvider received error from usePages:", error);

      // Increment error count
      setErrorCount(prev => prev + 1);

      // Only show error to user if we don't have any pages data
      // This prevents showing errors when we have cached data
      if (pages.length === 0) {
        setErrorVisible(true);

        // Show error using Sonner toast with action buttons
        toastIdRef.current = toast.error(error, {
          duration: 8000,
          action: {
            label: 'Retry',
            onClick: () => resetLoading(),
          },
          onDismiss: () => setErrorVisible(false),
          onAutoClose: () => setErrorVisible(false),
        });
      } else {
        // We have data, so don't show the error prominently
        setErrorVisible(false);
      }
    } else {
      setErrorVisible(false);
      // Dismiss any existing toast
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      // Reset error count on successful data load
      setErrorCount(0);
    }
  }, [error, pages.length]);

  // Listen for the loading-force-completed event
  useEffect(() => {
    const handleForceComplete = (event: CustomEvent): void => {

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

  // PERFORMANCE: Memoize dismissError callback to prevent unnecessary re-renders
  const dismissError = useCallback(() => setErrorVisible(false), []);

  // PERFORMANCE: Memoize context value to prevent unnecessary re-renders of consumers
  const value: DataContextType = useMemo(() => ({
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
    dismissError // Function to dismiss the error
  }), [
    isAuthenticated,
    loading,
    pages,
    filtered,
    loadMorePages,
    isMoreLoading,
    hasMorePages,
    forceLoaded,
    error,
    errorVisible,
    resetLoading,
    recoveryAttempted,
    dismissError
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
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