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

  // Track recovery attempts
  const recoveryAttemptsRef = useRef(0);
  const maxRecoveryAttempts = 2;
  const lastRecoveryTimeRef = useRef(0);

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
        if (autoRecover && elapsed >= timeoutMs * 1.5) {
          // Only attempt recovery if we haven't tried too recently (at least 5 seconds between attempts)
          const timeSinceLastRecovery = currentTime - lastRecoveryTimeRef.current;
          if (timeSinceLastRecovery >= 5000) {
            lastRecoveryTimeRef.current = currentTime;
            recoveryAttemptsRef.current += 1;

            console.warn(`useLoadingTimeout: Loading stalled for ${elapsed}ms, attempting recovery (attempt ${recoveryAttemptsRef.current}/${maxRecoveryAttempts})`);

            // First attempt: Just force complete the loading state
            if (recoveryAttemptsRef.current === 1) {
              forceComplete();
            }
            // Second attempt: Try to reload the page
            else if (recoveryAttemptsRef.current === 2 && typeof window !== 'undefined') {
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
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStartTime(null);
    setIsTimedOut(false);
    setElapsedTime(0);
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
