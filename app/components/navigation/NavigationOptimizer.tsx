"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';

interface NavigationOptimizerContextType {
  isRapidNavigating: boolean;
  navigationCount: number;
  shouldSkipRender: (componentName: string) => boolean;
  registerComponent: (componentName: string, priority: 'high' | 'medium' | 'low') => void;
  unregisterComponent: (componentName: string) => void;
}

const NavigationOptimizerContext = createContext<NavigationOptimizerContextType | undefined>(undefined);

interface NavigationOptimizerProps {
  children: ReactNode;
  // Maximum navigation frequency before optimization kicks in
  rapidNavigationThreshold?: number;
  // Time window to consider navigation as "rapid" (ms)
  rapidNavigationWindow?: number;
}

/**
 * NavigationOptimizer - Prevents excessive re-renders and data fetching during rapid navigation
 * 
 * Features:
 * - Detects rapid navigation patterns
 * - Prioritizes critical components during rapid navigation
 * - Defers non-critical updates
 * - Prevents cascade re-renders
 * - Optimizes database read patterns
 */
export function NavigationOptimizer({ 
  children, 
  rapidNavigationThreshold = 3,
  rapidNavigationWindow = 2000 
}: NavigationOptimizerProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  
  // Navigation tracking
  const [navigationCount, setNavigationCount] = useState(0);
  const [isRapidNavigating, setIsRapidNavigating] = useState(false);
  const [lastNavigationTime, setLastNavigationTime] = useState(0);
  
  // Component registry for priority-based rendering
  const componentRegistryRef = useRef<Map<string, 'high' | 'medium' | 'low'>>(new Map());
  const skipRenderSetRef = useRef<Set<string>>(new Set());
  
  // Track navigation changes
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastNav = now - lastNavigationTime;
    
    if (timeSinceLastNav < rapidNavigationWindow) {
      // Rapid navigation detected
      setNavigationCount(prev => prev + 1);
      
      if (navigationCount >= rapidNavigationThreshold) {
        setIsRapidNavigating(true);
        console.log(`🚀 RAPID NAV: Detected rapid navigation (${navigationCount + 1} navigations)`);
        
        // Update skip render set based on component priorities
        updateSkipRenderSet();
      }
    } else {
      // Reset navigation tracking
      setNavigationCount(1);
      setIsRapidNavigating(false);
      skipRenderSetRef.current.clear();
    }
    
    setLastNavigationTime(now);
    
    // Auto-reset rapid navigation state after window expires
    const resetTimer = setTimeout(() => {
      setNavigationCount(0);
      setIsRapidNavigating(false);
      skipRenderSetRef.current.clear();
    }, rapidNavigationWindow);
    
    return () => clearTimeout(resetTimer);
  }, [pathname, lastNavigationTime, navigationCount, rapidNavigationThreshold, rapidNavigationWindow]);
  
  // Update which components should skip rendering during rapid navigation
  const updateSkipRenderSet = () => {
    skipRenderSetRef.current.clear();
    
    // During rapid navigation, skip low and medium priority components
    componentRegistryRef.current.forEach((priority, componentName) => {
      if (priority === 'low' || (navigationCount > rapidNavigationThreshold + 2 && priority === 'medium')) {
        skipRenderSetRef.current.add(componentName);
        console.log(`⏸️ SKIP RENDER: ${componentName} (priority: ${priority})`);
      }
    });
  };
  
  // Register a component with priority
  const registerComponent = (componentName: string, priority: 'high' | 'medium' | 'low') => {
    componentRegistryRef.current.set(componentName, priority);
    
    // If we're already in rapid navigation mode, update skip set
    if (isRapidNavigating) {
      updateSkipRenderSet();
    }
  };
  
  // Unregister a component
  const unregisterComponent = (componentName: string) => {
    componentRegistryRef.current.delete(componentName);
    skipRenderSetRef.current.delete(componentName);
  };
  
  // Check if component should skip rendering
  const shouldSkipRender = (componentName: string): boolean => {
    return isRapidNavigating && skipRenderSetRef.current.has(componentName);
  };
  
  const contextValue: NavigationOptimizerContextType = {
    isRapidNavigating,
    navigationCount,
    shouldSkipRender,
    registerComponent,
    unregisterComponent,
  };
  
  return (
    <NavigationOptimizerContext.Provider value={contextValue}>
      {children}
    </NavigationOptimizerContext.Provider>
  );
}

/**
 * Hook to use navigation optimizer context
 */
export function useNavigationOptimizer() {
  const context = useContext(NavigationOptimizerContext);
  if (!context) {
    throw new Error('useNavigationOptimizer must be used within NavigationOptimizer');
  }
  return context;
}

/**
 * HOC to wrap components with navigation optimization
 */
export function withNavigationOptimization<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  priority: 'high' | 'medium' | 'low' = 'medium'
) {
  const OptimizedComponent = React.memo((props: P) => {
    const { shouldSkipRender, registerComponent, unregisterComponent } = useNavigationOptimizer();
    
    // Register component on mount
    useEffect(() => {
      registerComponent(componentName, priority);
      return () => unregisterComponent(componentName);
    }, [registerComponent, unregisterComponent]);
    
    // Skip rendering if optimization is active
    if (shouldSkipRender(componentName)) {
      console.log(`⏸️ OPTIMIZED: Skipping render for ${componentName}`);
      return null;
    }
    
    return <Component {...props} />;
  });
  
  OptimizedComponent.displayName = `withNavigationOptimization(${componentName})`;
  return OptimizedComponent;
}

/**
 * Hook for components to self-optimize during rapid navigation
 */
export function useNavigationAwareRender(
  componentName: string,
  priority: 'high' | 'medium' | 'low' = 'medium'
): {
  shouldRender: boolean;
  isRapidNavigating: boolean;
  navigationCount: number;
} {
  const { 
    isRapidNavigating, 
    navigationCount, 
    shouldSkipRender, 
    registerComponent, 
    unregisterComponent 
  } = useNavigationOptimizer();
  
  // Register component on mount
  useEffect(() => {
    registerComponent(componentName, priority);
    return () => unregisterComponent(componentName);
  }, [componentName, priority, registerComponent, unregisterComponent]);
  
  const shouldRender = !shouldSkipRender(componentName);
  
  return {
    shouldRender,
    isRapidNavigating,
    navigationCount,
  };
}

/**
 * Component wrapper that automatically optimizes rendering during rapid navigation
 */
interface OptimizedComponentProps {
  children: ReactNode;
  componentName: string;
  priority?: 'high' | 'medium' | 'low';
  fallback?: ReactNode;
}

export function OptimizedComponent({ 
  children, 
  componentName, 
  priority = 'medium',
  fallback = null 
}: OptimizedComponentProps) {
  const { shouldRender } = useNavigationAwareRender(componentName, priority);
  
  if (!shouldRender) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Hook to debounce effects during rapid navigation
 */
export function useNavigationAwareEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList,
  options: {
    skipDuringRapidNav?: boolean;
    debounceMs?: number;
  } = {}
) {
  const { isRapidNavigating } = useNavigationOptimizer();
  const { skipDuringRapidNav = true, debounceMs = 300 } = options;
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Skip effect during rapid navigation if configured
    if (skipDuringRapidNav && isRapidNavigating) {
      console.log('⏸️ EFFECT: Skipping effect during rapid navigation');
      return;
    }
    
    // Debounce effect during rapid navigation
    if (isRapidNavigating && debounceMs > 0) {
      timeoutRef.current = setTimeout(() => {
        effect();
      }, debounceMs);
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else {
      // Execute immediately if not rapid navigating
      return effect();
    }
  }, [...deps, isRapidNavigating]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}

export default NavigationOptimizer;
