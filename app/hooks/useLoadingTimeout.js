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
export function useLoadingTimeout(isLoading, timeoutMs = 10000, onTimeout = null, autoRecover = false) {
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef(null);
  const maxTimeRef = useRef(timeoutMs * 3); // Maximum time before auto-recovery
  const isInitialPageLoadRef = useRef(true);
  const checkIntervalRef = useRef(null);

  // Track recovery attempts - reduced to prevent infinite loops
  const recoveryAttemptsRef = useRef(0);
  const maxRecoveryAttempts = 1; // Reduced from 3 to 1 to prevent infinite loops
  const lastRecoveryTimeRef = useRef(0);
  const hasRecoveredRef = useRef(false); // Track if we've already recovered

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

        // Disable aggressive initial page load recovery to prevent infinite loops
        // checkIntervalRef.current = setInterval(() => {
        //   // Check if we're still loading after 5 seconds
        //   if (isLoading && Date.now() - startTime > 5000) {
        //     console.warn('useLoadingTimeout: Initial page load taking too long, attempting recovery');
        //     forceComplete();
        //   }
        // }, 1000);

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
        // Use more conservative timeouts to prevent infinite loops
        const recoveryThreshold = timeoutMs * 2; // Increased threshold to be less aggressive

        if (autoRecover && elapsed >= recoveryThreshold && !hasRecoveredRef.current) {
          // Only attempt recovery once per loading session
          const minTimeBetweenRecoveries = 10000; // Increased to 10 seconds minimum
          const timeSinceLastRecovery = currentTime - lastRecoveryTimeRef.current;

          if (timeSinceLastRecovery >= minTimeBetweenRecoveries && recoveryAttemptsRef.current < maxRecoveryAttempts) {
            lastRecoveryTimeRef.current = currentTime;
            recoveryAttemptsRef.current += 1;
            hasRecoveredRef.current = true; // Mark that we've attempted recovery

            console.warn(`useLoadingTimeout: Loading stalled for ${elapsed}ms, attempting single recovery (attempt ${recoveryAttemptsRef.current}/${maxRecoveryAttempts})`);

            // Only attempt: Just force complete the loading state
            forceComplete();

            // Stop further recovery attempts
            clearInterval(intervalRef.current);
            intervalRef.current = null;
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
      hasRecoveredRef.current = false; // Reset recovery flag
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
