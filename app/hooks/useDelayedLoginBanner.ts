"use client";

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseDelayedLoginBannerReturn {
  showDelayedBanner: boolean;
  triggerDelayedBanner: () => void;
  resetDelayedBanner: () => void;
  isDelayActive: boolean;
}

/**
 * Hook to manage delayed login banner state
 * 
 * This hook handles the timing and state management for showing the login banner
 * after a 1-second delay following user interaction with the pledge bar.
 */
export function useDelayedLoginBanner(): UseDelayedLoginBannerReturn {
  const [showDelayedBanner, setShowDelayedBanner] = useState(false);
  const [isDelayActive, setIsDelayActive] = useState(false);
  const delayTimeoutRef = useRef<NodeJS.Timeout>();
  const resetTimeoutRef = useRef<NodeJS.Timeout>();

  const triggerDelayedBanner = useCallback(() => {
    // Clear any existing timeouts
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
    }
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    // Start the delay period
    setIsDelayActive(true);
    setShowDelayedBanner(false);

    // Show banner after 1 second delay
    delayTimeoutRef.current = setTimeout(() => {
      setShowDelayedBanner(true);
      setIsDelayActive(false);
    }, 1000);
  }, []);

  const resetDelayedBanner = useCallback(() => {
    // Clear all timeouts
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
    }
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    // Reset state
    setShowDelayedBanner(false);
    setIsDelayActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  return {
    showDelayedBanner,
    triggerDelayedBanner,
    resetDelayedBanner,
    isDelayActive
  };
}
