"use client";

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Render control context interface
 */
interface RenderControlContextType {
  renderedComponents: Set<string>;
  registerComponent: (componentId: string) => void;
  isFirstRender: (componentId: string) => boolean;
  resetRenderState: () => void;
  isNavigating: boolean;
  lastNavigationTime: number;
}

/**
 * Render control provider props interface
 */
interface RenderControlProviderProps {
  children: ReactNode;
}

/**
 * Navigation state interface
 */
interface NavigationState {
  isNavigating: boolean;
  lastNavigationTime: number;
}

// Create a context to track rendered components
const RenderControlContext = createContext<RenderControlContextType>({
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
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export function RenderControlProvider({ children }: RenderControlProviderProps) {
  // Use a ref to maintain state across renders without causing re-renders
  const renderedComponentsRef = useRef<Set<string>>(new Set());

  // Track navigation state
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [currentPath, setCurrentPath] = useState<string>('');
  const [currentSearchParams, setCurrentSearchParams] = useState<string>('');
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [lastNavigationTime, setLastNavigationTime] = useState<number>(0);

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

  /**
   * Register a component as rendered
   *
   * @param componentId - The unique identifier for the component
   */
  const registerComponent = (componentId: string): void => {
    renderedComponentsRef.current.add(componentId);
  };

  /**
   * Check if this is the first render for a component
   *
   * @param componentId - The unique identifier for the component
   * @returns True if this is the first render, false otherwise
   */
  const isFirstRender = (componentId: string): boolean => {
    return !renderedComponentsRef.current.has(componentId);
  };

  /**
   * Reset the render state (useful for testing or forced refreshes)
   */
  const resetRenderState = (): void => {
    renderedComponentsRef.current = new Set();
  };

  // Create the context value
  const contextValue: RenderControlContextType = {
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

/**
 * Custom hook to use the render control context
 *
 * @returns The render control context value
 * @throws Error if used outside of RenderControlProvider
 */
export function useRenderControl(): RenderControlContextType {
  const context = useContext(RenderControlContext);

  if (!context) {
    throw new Error('useRenderControl must be used within a RenderControlProvider');
  }

  return context;
}

/**
 * Custom hook to check if we're currently navigating between pages
 *
 * @returns Navigation state with isNavigating flag and last navigation timestamp
 */
export function useIsNavigating(): NavigationState {
  const { isNavigating, lastNavigationTime } = useRenderControl();

  // Return both the navigation state and the timestamp of the last navigation
  return { isNavigating, lastNavigationTime };
}
