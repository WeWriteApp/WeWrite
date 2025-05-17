"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useLoadingTimeout - A hook to handle loading states with timeout
 *
 * This hook helps prevent infinite loading states by:
 * 1. Setting a timeout after which loading is considered "stalled"
 * 2. Providing a fallback state when loading takes too long
 * 3. Offering error recovery options
 * 4. Automatically recovering from stalled states
 * 5. Detecting and handling initial page loads more aggressively
 *
 * @param {boolean} isLoading - The current loading state
 * @param {number} timeoutMs - Timeout in milliseconds before considering loading as stalled
 * @param {Function} onTimeout - Optional callback to execute when timeout occurs
 * @param {boolean} autoRecover - Whether to automatically recover from stalled states
 * @returns {Object} - Loading state information and control functions
 */
export function useLoadingTimeout(isLoading, timeoutMs = 10000, onTimeout = null, autoRecover = true) {
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef(null);
  const maxTimeRef = useRef(timeoutMs * 3); // Maximum time before auto-recovery
  const isInitialPageLoadRef = useRef(true);
  const checkIntervalRef = useRef(null);

  // Track recovery attempts
  const recoveryAttemptsRef = useRef(0);
  const maxRecoveryAttempts = 3; // Increased from 2 to 3
  const lastRecoveryTimeRef = useRef(0);

  // Check if this is the initial page load
  useEffect(() => {
    if (isInitialPageLoadRef.current && typeof window !== 'undefined') {
      // Check if we've recorded a page load in this session
      const hasLoadedBefore = sessionStorage.getItem('pageLoadedBefore');

      if (!hasLoadedBefore) {
        // This is the first load in this session
        console.log('useLoadingTimeout: Detected initial page load in this session');
        sessionStorage.setItem('pageLoadedBefore', 'true');
        isInitialPageLoadRef.current = true;

        // For initial page loads, we'll use more aggressive timeouts
        // and check more frequently
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }

        checkIntervalRef.current = setInterval(() => {
          // Check if we're still loading after 5 seconds
          if (isLoading && Date.now() - startTime > 5000) {
            console.warn('useLoadingTimeout: Initial page load taking too long, attempting recovery');
            forceComplete();
          }
        }, 1000);

        return () => {
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
        };
      } else {
        isInitialPageLoadRef.current = false;
      }
    }
  }, [isLoading, startTime]);

  // Reset the timeout state when loading state changes
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isLoading && !startTime) {
      // Start the timer when loading begins
      const now = Date.now();
      setStartTime(now);
      setIsTimedOut(false);
      setElapsedTime(0);

      // Log loading start
      console.log(`useLoadingTimeout: Loading started at ${new Date(now).toISOString()}`);

      // Set up interval to track elapsed time
      intervalRef.current = setInterval(() => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        setElapsedTime(elapsed);

        // Check if we've exceeded the timeout
        if (elapsed >= timeoutMs && !isTimedOut) {
          console.warn(`useLoadingTimeout: Loading timed out after ${elapsed}ms`);
          setIsTimedOut(true);
          if (onTimeout && typeof onTimeout === 'function') {
            onTimeout();
          }
        }

        // Auto-recovery: If loading has been going on for too long, try recovery steps
        // Use more aggressive timeouts for initial page loads
        const recoveryThreshold = isInitialPageLoadRef.current ? timeoutMs * 0.8 : timeoutMs * 1.5;

        if (autoRecover && elapsed >= recoveryThreshold) {
          // Only attempt recovery if we haven't tried too recently
          // Use shorter intervals for initial page loads
          const minTimeBetweenRecoveries = isInitialPageLoadRef.current ? 2000 : 5000;
          const timeSinceLastRecovery = currentTime - lastRecoveryTimeRef.current;

          if (timeSinceLastRecovery >= minTimeBetweenRecoveries) {
            lastRecoveryTimeRef.current = currentTime;
            recoveryAttemptsRef.current += 1;

            console.warn(`useLoadingTimeout: Loading stalled for ${elapsed}ms, attempting recovery (attempt ${recoveryAttemptsRef.current}/${maxRecoveryAttempts})`);

            // First attempt: Just force complete the loading state
            if (recoveryAttemptsRef.current === 1) {
              forceComplete();
            }
            // Second attempt: Try to clear any cached data that might be causing issues
            else if (recoveryAttemptsRef.current === 2) {
              console.warn('useLoadingTimeout: Second recovery attempt, clearing session data');

              // Clear any session-specific data that might be causing the issue
              if (typeof window !== 'undefined') {
                // Clear specific session storage items that might be related to loading state
                sessionStorage.removeItem('lastPageLoad');
                sessionStorage.removeItem('renderedComponents');

                // Dispatch a custom event that components can listen for to reset their state
                const resetEvent = new CustomEvent('force-reset-loading-state');
                window.dispatchEvent(resetEvent);
              }

              // Force complete after clearing data
              forceComplete();
            }
            // Third attempt: Try to reload the page
            else if (recoveryAttemptsRef.current === 3 && typeof window !== 'undefined') {
              // Add a flag to localStorage to prevent reload loops
              const reloadCount = parseInt(localStorage.getItem('loadingTimeoutReloadCount') || '0');
              if (reloadCount < 2) { // Limit to 2 reload attempts
                console.warn('useLoadingTimeout: Attempting page reload as recovery measure');
                localStorage.setItem('loadingTimeoutReloadCount', (reloadCount + 1).toString());

                // Add a small delay before reloading
                setTimeout(() => {
                  window.location.reload();
                }, 500);
              } else {
                console.warn('useLoadingTimeout: Max reload attempts reached, forcing into a usable state');
                forceComplete();

                // Reset the counter after 5 minutes
                setTimeout(() => {
                  localStorage.setItem('loadingTimeoutReloadCount', '0');
                }, 5 * 60 * 1000);
              }
            }
          }
        }
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else if (!isLoading) {
      // Reset when loading completes
      if (startTime) {
        const loadTime = Date.now() - startTime;
        console.log(`useLoadingTimeout: Loading completed after ${loadTime}ms`);
      }

      setStartTime(null);
      setIsTimedOut(false);
      setElapsedTime(0);
      recoveryAttemptsRef.current = 0;
      lastRecoveryTimeRef.current = 0;

      // Reset reload counter on successful load
      if (typeof window !== 'undefined') {
        localStorage.setItem('loadingTimeoutReloadCount', '0');
      }
    }
  }, [isLoading, startTime, timeoutMs, isTimedOut, onTimeout, autoRecover]);

  // Function to manually reset the timeout state
  const resetTimeout = useCallback(() => {
    setStartTime(Date.now());
    setIsTimedOut(false);
    setElapsedTime(0);
  }, []);

  // Function to force the loading to "complete" (for recovery)
  const forceComplete = useCallback(() => {
    // Clear all intervals and timers
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    // Reset all state
    setStartTime(null);
    setIsTimedOut(false);
    setElapsedTime(0);

    // Log the forced completion
    console.log('useLoadingTimeout: Forced loading completion');

    // Dispatch an event that other components can listen for
    if (typeof window !== 'undefined') {
      const forceCompleteEvent = new CustomEvent('loading-force-completed');
      window.dispatchEvent(forceCompleteEvent);
    }
  }, []);

  return {
    isTimedOut,
    elapsedTime,
    resetTimeout,
    forceComplete,
    isStalled: isLoading && isTimedOut,
    // Percentage of timeout elapsed (0-100)
    progress: Math.min(100, (elapsedTime / timeoutMs) * 100)
  };
}

export default useLoadingTimeout;
