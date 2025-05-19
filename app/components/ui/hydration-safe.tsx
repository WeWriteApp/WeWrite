"use client";

import React, { useState, useEffect, ReactNode } from 'react';

interface HydrationSafeProps {
  /**
   * The content to render once hydration is complete
   */
  children: ReactNode;
  
  /**
   * Optional fallback content to show before hydration
   */
  fallback?: ReactNode;
  
  /**
   * Optional delay before showing content (ms)
   * This can help prevent flickering during hydration
   */
  delayMs?: number;
  
  /**
   * Whether to skip the hydration safety check
   */
  skip?: boolean;
}

/**
 * HydrationSafe component
 * 
 * Prevents hydration mismatches by only rendering content after hydration is complete.
 * This is useful for components that:
 * 1. Use browser APIs that aren't available during server rendering
 * 2. Have different appearances between server and client
 * 3. Need to access window, localStorage, or other browser-only features
 * 
 * @example
 * ```tsx
 * <HydrationSafe>
 *   <ComponentThatUsesLocalStorage />
 * </HydrationSafe>
 * ```
 */
export function HydrationSafe({
  children,
  fallback = null,
  delayMs = 0,
  skip = false
}: HydrationSafeProps) {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    // If we want to add a small delay to prevent flickering
    if (delayMs > 0) {
      const timer = setTimeout(() => {
        setIsMounted(true);
      }, delayMs);
      
      return () => clearTimeout(timer);
    } else {
      setIsMounted(true);
    }
  }, [delayMs]);
  
  // If we're skipping the safety check or if we're mounted, render children
  if (skip || isMounted) {
    return <>{children}</>;
  }
  
  // Otherwise render the fallback (or nothing)
  return <>{fallback}</>;
}

/**
 * A higher-order component version of HydrationSafe
 */
export function withHydrationSafe<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<HydrationSafeProps, 'children'> = {}
) {
  return function WithHydrationSafe(props: P) {
    return (
      <HydrationSafe {...options}>
        <Component {...props} />
      </HydrationSafe>
    );
  };
}

export default HydrationSafe;
