"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface NavigationState {
  isNavigating: boolean;
  targetRoute: string | null;
  startTime: number | null;
  buttonPressed: string | null;
}

interface OptimisticNavigationOptions {
  preloadDelay?: number;
  maxNavigationTime?: number;
  enableHapticFeedback?: boolean;
}

/**
 * useOptimisticNavigation - Hook for instant navigation feedback
 * 
 * Provides immediate visual feedback and optimistic navigation for mobile bottom nav.
 * Ensures buttons never feel unresponsive and users get instant feedback.
 * 
 * Features:
 * - Immediate visual feedback (within 16ms)
 * - Optimistic navigation states
 * - Route preloading
 * - Haptic feedback on mobile
 * - Navigation timeout handling
 * - Button state management
 */
export function useOptimisticNavigation(options: OptimisticNavigationOptions = {}) {
  const {
    preloadDelay = 100,
    maxNavigationTime = 5000,
    enableHapticFeedback = true,
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  
  const [navigationState, setNavigationState] = useState<NavigationState>({
    isNavigating: false,
    targetRoute: null,
    startTime: null,
    buttonPressed: null,
  });

  const navigationTimeoutRef = useRef<NodeJS.Timeout>();
  const preloadTimeoutRef = useRef<NodeJS.Timeout>();
  const pressedButtonsRef = useRef<Set<string>>(new Set());

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  // Reset navigation state when pathname changes
  useEffect(() => {
    if (navigationState.isNavigating && navigationState.targetRoute) {
      // Check if we've arrived at the target route
      if (pathname === navigationState.targetRoute) {
        setNavigationState({
          isNavigating: false,
          targetRoute: null,
          startTime: null,
          buttonPressed: null,
        });
        pressedButtonsRef.current.clear();
      }
    }
  }, [pathname, navigationState]);

  // Provide haptic feedback on mobile devices
  const triggerHapticFeedback = useCallback(() => {
    if (!enableHapticFeedback || typeof window === 'undefined') return;
    
    try {
      // Use the Vibration API for haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(10); // Very short vibration
      }
      
      // Use the Web Haptics API if available (experimental)
      if ('haptics' in navigator && 'impact' in (navigator as any).haptics) {
        (navigator as any).haptics.impact({ intensity: 'light' });
      }
    } catch (error) {
      // Silently fail if haptic feedback is not supported
    }
  }, [enableHapticFeedback]);

  // Preload a route for faster navigation
  const preloadRoute = useCallback((route: string) => {
    if (typeof window === 'undefined') return;
    
    try {
      router.prefetch(route);
    } catch (error) {
      console.warn('Failed to preload route:', route, error);
    }
  }, [router]);

  // Handle button press with immediate feedback
  const handleButtonPress = useCallback((buttonId: string, targetRoute: string) => {
    // Immediate visual feedback - this should happen within 16ms
    pressedButtonsRef.current.add(buttonId);
    
    // Trigger haptic feedback immediately
    triggerHapticFeedback();
    
    // Set optimistic navigation state
    const startTime = performance.now();
    setNavigationState({
      isNavigating: true,
      targetRoute,
      startTime,
      buttonPressed: buttonId,
    });

    // Clear any existing timeouts
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }

    // Set navigation timeout to prevent stuck states
    navigationTimeoutRef.current = setTimeout(() => {
      console.warn('Navigation timeout reached for:', targetRoute);
      setNavigationState({
        isNavigating: false,
        targetRoute: null,
        startTime: null,
        buttonPressed: null,
      });
      pressedButtonsRef.current.clear();
    }, maxNavigationTime);

    // Perform the actual navigation
    try {
      router.push(targetRoute);
    } catch (error) {
      console.error('Navigation failed:', error);
      // Reset state on navigation failure
      setNavigationState({
        isNavigating: false,
        targetRoute: null,
        startTime: null,
        buttonPressed: null,
      });
      pressedButtonsRef.current.clear();
    }
  }, [router, triggerHapticFeedback, maxNavigationTime]);

  // Handle button hover/focus for preloading
  const handleButtonHover = useCallback((targetRoute: string) => {
    // Clear existing preload timeout
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Preload after a short delay
    preloadTimeoutRef.current = setTimeout(() => {
      preloadRoute(targetRoute);
    }, preloadDelay);
  }, [preloadRoute, preloadDelay]);

  // Check if a button is currently pressed
  const isButtonPressed = useCallback((buttonId: string) => {
    return pressedButtonsRef.current.has(buttonId) || 
           navigationState.buttonPressed === buttonId;
  }, [navigationState.buttonPressed]);

  // Check if navigating to a specific route
  const isNavigatingTo = useCallback((route: string) => {
    return navigationState.isNavigating && navigationState.targetRoute === route;
  }, [navigationState]);

  // Get navigation progress (0-1)
  const getNavigationProgress = useCallback(() => {
    if (!navigationState.isNavigating || !navigationState.startTime) {
      return 0;
    }
    
    const elapsed = performance.now() - navigationState.startTime;
    const progress = Math.min(elapsed / maxNavigationTime, 1);
    return progress;
  }, [navigationState, maxNavigationTime]);

  // Force reset navigation state (for error recovery)
  const resetNavigationState = useCallback(() => {
    setNavigationState({
      isNavigating: false,
      targetRoute: null,
      startTime: null,
      buttonPressed: null,
    });
    pressedButtonsRef.current.clear();
    
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
  }, []);

  return {
    // State
    isNavigating: navigationState.isNavigating,
    targetRoute: navigationState.targetRoute,
    buttonPressed: navigationState.buttonPressed,
    
    // Actions
    handleButtonPress,
    handleButtonHover,
    resetNavigationState,
    
    // Utilities
    isButtonPressed,
    isNavigatingTo,
    getNavigationProgress,
    preloadRoute,
  };
}

export default useOptimisticNavigation;
