"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  HomeSkeleton, 
  NotificationsSkeleton, 
  NewPageSkeleton, 
  NavigationTransitionSkeleton 
} from '../components/skeletons/NavigationSkeletons';
import { UserProfileSkeleton } from '../components/skeletons/UserProfileSkeleton';

interface NavigationState {
  isNavigating: boolean;
  targetRoute: string | null;
  sourceRoute: string | null;
  startTime: number | null;
  showSkeleton: boolean;
  navigationId: string | null;
}

interface OptimisticNavigationContextType {
  navigationState: NavigationState;
  startNavigation: (targetRoute: string, options?: NavigationOptions) => void;
  completeNavigation: () => void;
  cancelNavigation: () => void;
  getNavigationProgress: () => number;
}

interface NavigationOptions {
  showSkeleton?: boolean;
  preloadRoute?: boolean;
  maxDuration?: number;
}

interface OptimisticNavigationProviderProps {
  children: ReactNode;
}

const OptimisticNavigationContext = createContext<OptimisticNavigationContextType | undefined>(undefined);

/**
 * OptimisticNavigationProvider - Manages optimistic navigation experience
 * 
 * Provides:
 * - Instant skeleton screens during navigation
 * - Smooth transitions between pages
 * - Navigation progress tracking
 * - Automatic timeout handling
 * - Route preloading
 */
export function OptimisticNavigationProvider({ children }: OptimisticNavigationProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [navigationState, setNavigationState] = useState<NavigationState>({
    isNavigating: false,
    targetRoute: null,
    sourceRoute: null,
    startTime: null,
    showSkeleton: false,
    navigationId: null,
  });

  const navigationTimeoutRef = useRef<NodeJS.Timeout>();
  const skeletonTimeoutRef = useRef<NodeJS.Timeout>();

  // Reset navigation when pathname changes
  useEffect(() => {
    if (navigationState.isNavigating && navigationState.targetRoute) {
      // Check if we've reached the target route
      const targetPath = navigationState.targetRoute.split('?')[0]; // Remove query params
      const currentPath = pathname;
      
      if (currentPath === targetPath || 
          (navigationState.targetRoute.startsWith('/user/') && currentPath.startsWith('/user/'))) {
        completeNavigation();
      }
    }
  }, [pathname, navigationState]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      if (skeletonTimeoutRef.current) {
        clearTimeout(skeletonTimeoutRef.current);
      }
    };
  }, []);

  const startNavigation = (targetRoute: string, options: NavigationOptions = {}) => {
    const {
      showSkeleton = true,
      preloadRoute = true,
      maxDuration = 5000,
    } = options;

    const navigationId = Math.random().toString(36).substr(2, 9);
    const startTime = performance.now();

    // Clear any existing timeouts
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    if (skeletonTimeoutRef.current) {
      clearTimeout(skeletonTimeoutRef.current);
    }

    // Set navigation state immediately
    setNavigationState({
      isNavigating: true,
      targetRoute,
      sourceRoute: pathname,
      startTime,
      showSkeleton: false, // Will be set after a short delay
      navigationId,
    });

    // Show skeleton after a very short delay to avoid flashing
    if (showSkeleton) {
      skeletonTimeoutRef.current = setTimeout(() => {
        setNavigationState(prev => 
          prev.navigationId === navigationId 
            ? { ...prev, showSkeleton: true }
            : prev
        );
      }, 50); // 50ms delay to avoid flashing on fast navigations
    }

    // Preload the route if requested
    if (preloadRoute) {
      try {
        router.prefetch(targetRoute);
      } catch (error) {
        console.warn('Failed to preload route:', targetRoute, error);
      }
    }

    // Set navigation timeout
    navigationTimeoutRef.current = setTimeout(() => {
      console.warn('Navigation timeout reached for:', targetRoute);
      completeNavigation();
    }, maxDuration);

    // Perform the actual navigation
    try {
      router.push(targetRoute);
    } catch (error) {
      console.error('Navigation failed:', error);
      completeNavigation();
    }
  };

  const completeNavigation = () => {
    // Clear timeouts
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    if (skeletonTimeoutRef.current) {
      clearTimeout(skeletonTimeoutRef.current);
    }

    // Reset navigation state
    setNavigationState({
      isNavigating: false,
      targetRoute: null,
      sourceRoute: null,
      startTime: null,
      showSkeleton: false,
      navigationId: null,
    });
  };

  const cancelNavigation = () => {
    completeNavigation();
  };

  const getNavigationProgress = (): number => {
    if (!navigationState.isNavigating || !navigationState.startTime) {
      return 0;
    }
    
    const elapsed = performance.now() - navigationState.startTime;
    const maxDuration = 5000; // 5 seconds max
    return Math.min(elapsed / maxDuration, 1);
  };

  // Get the appropriate skeleton component for the target route
  const getSkeletonComponent = (route: string) => {
    if (route === '/') return HomeSkeleton;
    if (route === '/notifications') return NotificationsSkeleton;
    if (route === '/new' || route.includes('/new?')) return NewPageSkeleton;
    if (route.startsWith('/user/')) return UserProfileSkeleton;
    return NavigationTransitionSkeleton;
  };

  const contextValue: OptimisticNavigationContextType = {
    navigationState,
    startNavigation,
    completeNavigation,
    cancelNavigation,
    getNavigationProgress,
  };

  return (
    <OptimisticNavigationContext.Provider value={contextValue}>
      {children}
      
      {/* Render skeleton overlay during navigation */}
      {navigationState.showSkeleton && navigationState.targetRoute && (
        <div className="fixed inset-0 bg-background z-50">
          {/* Navigation progress bar */}
          <div 
            className="absolute top-0 left-0 h-1 bg-primary transition-all duration-100"
            style={{ width: `${getNavigationProgress() * 100}%` }}
          />
          
          {/* Skeleton content */}
          {(() => {
            const SkeletonComponent = getSkeletonComponent(navigationState.targetRoute);
            return <SkeletonComponent />;
          })()}
        </div>
      )}
    </OptimisticNavigationContext.Provider>
  );
}

/**
 * Hook to use optimistic navigation
 */
export function useOptimisticNavigation() {
  const context = useContext(OptimisticNavigationContext);
  if (context === undefined) {
    throw new Error('useOptimisticNavigation must be used within an OptimisticNavigationProvider');
  }
  return context;
}

/**
 * Hook for enhanced navigation with automatic skeleton handling
 */
export function useEnhancedNavigation() {
  const { startNavigation } = useOptimisticNavigation();
  const router = useRouter();

  const navigateWithSkeleton = (route: string, options?: NavigationOptions) => {
    startNavigation(route, {
      showSkeleton: true,
      preloadRoute: true,
      ...options,
    });
  };

  const navigateInstant = (route: string) => {
    startNavigation(route, {
      showSkeleton: false,
      preloadRoute: true,
      maxDuration: 1000,
    });
  };

  return {
    navigateWithSkeleton,
    navigateInstant,
    navigate: navigateWithSkeleton, // Default to skeleton navigation
  };
}

export default OptimisticNavigationProvider;
