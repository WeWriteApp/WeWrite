"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface SimpleNavigationOptimizerContextType {
  isRapidNavigating: boolean;
  navigationCount: number;
}

const SimpleNavigationOptimizerContext = createContext<SimpleNavigationOptimizerContextType | null>(null);

interface SimpleNavigationOptimizerProps {
  children: ReactNode;
  rapidNavigationThreshold?: number;
  rapidNavigationWindow?: number;
}

/**
 * SimpleNavigationOptimizer - Lightweight navigation optimization
 * 
 * Only tracks rapid navigation state without aggressive component skipping.
 * Components can use this context to make their own optimization decisions.
 * 
 * Features:
 * - Detects rapid navigation patterns (4+ navigations in 3 seconds)
 * - Provides context for components to self-optimize
 * - No automatic component skipping (prevents breaking the app)
 * - Minimal performance impact
 */
export function SimpleNavigationOptimizer({ 
  children, 
  rapidNavigationThreshold = 4, // Higher threshold - only optimize when truly rapid
  rapidNavigationWindow = 3000   // Longer window - more forgiving
}: SimpleNavigationOptimizerProps) {
  const pathname = usePathname();
  
  // Navigation tracking
  const [navigationCount, setNavigationCount] = useState(0);
  const [isRapidNavigating, setIsRapidNavigating] = useState(false);
  const navigationTimesRef = useRef<number[]>([]);
  const resetTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Track navigation changes
  useEffect(() => {
    const now = Date.now();
    
    // Add current navigation time
    navigationTimesRef.current.push(now);
    
    // Keep only recent navigations within the window
    navigationTimesRef.current = navigationTimesRef.current.filter(
      time => now - time <= rapidNavigationWindow
    );
    
    const recentNavigationCount = navigationTimesRef.current.length;
    setNavigationCount(recentNavigationCount);
    
    // Determine if we're in rapid navigation mode
    const wasRapidNavigating = isRapidNavigating;
    const nowRapidNavigating = recentNavigationCount >= rapidNavigationThreshold;
    
    if (nowRapidNavigating !== wasRapidNavigating) {
      setIsRapidNavigating(nowRapidNavigating);
      
      if (nowRapidNavigating) {
        console.log(`🚀 RAPID NAV: Detected rapid navigation (${recentNavigationCount} navigations)`);
      } else {
        console.log(`✅ RAPID NAV: Exiting rapid navigation mode`);
      }
    }
    
    // Clear reset timeout
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    
    // Set timeout to exit rapid navigation mode
    resetTimeoutRef.current = setTimeout(() => {
      setIsRapidNavigating(false);
      setNavigationCount(0);
      navigationTimesRef.current = [];
    }, rapidNavigationWindow);
    
  }, [pathname, rapidNavigationThreshold, rapidNavigationWindow, isRapidNavigating]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);
  
  const contextValue: SimpleNavigationOptimizerContextType = {
    isRapidNavigating,
    navigationCount,
  };
  
  return (
    <SimpleNavigationOptimizerContext.Provider value={contextValue}>
      {children}
    </SimpleNavigationOptimizerContext.Provider>
  );
}

/**
 * Hook to access simple navigation optimization context
 */
export function useSimpleNavigationOptimizer(): SimpleNavigationOptimizerContextType {
  const context = useContext(SimpleNavigationOptimizerContext);
  if (!context) {
    // Return safe defaults if not wrapped in provider
    return {
      isRapidNavigating: false,
      navigationCount: 0,
    };
  }
  return context;
}

/**
 * Hook for components to debounce expensive operations during rapid navigation
 */
export function useNavigationAwareDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const { isRapidNavigating } = useSimpleNavigationOptimizer();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastCallRef = useRef<Parameters<T>>();
  
  const debouncedCallback = ((...args: Parameters<T>) => {
    lastCallRef.current = args;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Use longer delay during rapid navigation
    const actualDelay = isRapidNavigating ? delay * 2 : delay;
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, actualDelay);
  }) as T;
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return debouncedCallback;
}

/**
 * Hook for components to conditionally skip expensive renders during rapid navigation
 */
export function useNavigationAwareRender(skipDuringRapidNav: boolean = false): {
  shouldRender: boolean;
  isRapidNavigating: boolean;
  navigationCount: number;
} {
  const { isRapidNavigating, navigationCount } = useSimpleNavigationOptimizer();
  
  const shouldRender = skipDuringRapidNav ? !isRapidNavigating : true;
  
  return {
    shouldRender,
    isRapidNavigating,
    navigationCount,
  };
}

export default SimpleNavigationOptimizer;
