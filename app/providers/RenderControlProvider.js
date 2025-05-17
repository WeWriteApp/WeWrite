"use client";

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Create a context to track rendered components
const RenderControlContext = createContext({
  renderedComponents: new Set(),
  registerComponent: () => {},
  isFirstRender: () => true,
  resetRenderState: () => {},
  isNavigating: false,
  lastNavigationTime: 0,
});

/**
 * RenderControlProvider
 *
 * This provider helps control animations and prevent double rendering effects
 * by tracking which components have already been rendered.
 *
 * It's particularly useful for:
 * - Preventing animations from running multiple times during React's development mode double-rendering
 * - Controlling transitions during page navigation
 * - Providing a consistent loading state during navigation
 */
export function RenderControlProvider({ children }) {
  // Use a ref to maintain state across renders without causing re-renders
  const renderedComponentsRef = useRef(new Set());

  // Track navigation state
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [currentPath, setCurrentPath] = useState('');
  const [currentSearchParams, setCurrentSearchParams] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [lastNavigationTime, setLastNavigationTime] = useState(0);

  // Update the current path and search params when they change
  useEffect(() => {
    const path = pathname;
    const params = searchParams.toString();

    // If the path or search params have changed
    if (path !== currentPath || params !== currentSearchParams) {
      // Set navigating state
      setIsNavigating(true);

      // Record navigation time
      const now = Date.now();
      setLastNavigationTime(now);

      // Reset the rendered components
      renderedComponentsRef.current = new Set();

      // Update current path and search params
      setCurrentPath(path);
      setCurrentSearchParams(params);

      // Clear navigation state after a short delay
      const timer = setTimeout(() => {
        setIsNavigating(false);
      }, 500); // Adjust timing as needed

      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams, currentPath, currentSearchParams]);

  // Register a component as rendered
  const registerComponent = (componentId) => {
    renderedComponentsRef.current.add(componentId);
  };

  // Check if this is the first render for a component
  const isFirstRender = (componentId) => {
    return !renderedComponentsRef.current.has(componentId);
  };

  // Reset the render state (useful for testing or forced refreshes)
  const resetRenderState = () => {
    renderedComponentsRef.current = new Set();
  };

  // Create the context value
  const contextValue = {
    renderedComponents: renderedComponentsRef.current,
    registerComponent,
    isFirstRender,
    resetRenderState,
    isNavigating,
    lastNavigationTime,
  };

  return (
    <RenderControlContext.Provider value={contextValue}>
      {children}
    </RenderControlContext.Provider>
  );
}

// Custom hook to use the render control context
export function useRenderControl() {
  const context = useContext(RenderControlContext);

  if (!context) {
    throw new Error('useRenderControl must be used within a RenderControlProvider');
  }

  return context;
}

// Custom hook to check if we're currently navigating between pages
export function useIsNavigating() {
  const { isNavigating, lastNavigationTime } = useRenderControl();

  // Return both the navigation state and the timestamp of the last navigation
  return { isNavigating, lastNavigationTime };
}
