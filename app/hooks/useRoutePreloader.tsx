"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';

interface PreloadOptions {
  priority?: 'high' | 'medium' | 'low';
  delay?: number;
  condition?: () => boolean;
}

interface RoutePreloadConfig {
  route: string;
  options: PreloadOptions;
  lastPreloaded?: number;
}

/**
 * useRoutePreloader - Intelligent route preloading for mobile navigation
 * 
 * Features:
 * - Preloads likely navigation targets
 * - Respects network conditions
 * - Prevents duplicate preloading
 * - Priority-based preloading
 * - User-specific route prediction
 */
export function useRoutePreloader() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useCurrentAccount();
  const preloadedRoutesRef = useRef<Map<string, number>>(new Map());
  const preloadTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      preloadTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      preloadTimeoutsRef.current.clear();
    };
  }, []);

  // Check if route was recently preloaded (within 5 minutes)
  const wasRecentlyPreloaded = useCallback((route: string): boolean => {
    const lastPreloaded = preloadedRoutesRef.current.get(route);
    if (!lastPreloaded) return false;
    
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - lastPreloaded < fiveMinutes;
  }, []);

  // Check network conditions for preloading
  const shouldPreloadBasedOnNetwork = useCallback((): boolean => {
    if (typeof navigator === 'undefined') return true;
    
    const connection = (navigator as any).connection;
    if (!connection) return true;
    
    // Don't preload on very slow connections or data saver mode
    const isSlowConnection = ['slow-2g', '2g'].includes(connection.effectiveType);
    const hasDataSaver = connection.saveData;
    
    return !isSlowConnection && !hasDataSaver;
  }, []);

  // Preload a specific route
  const preloadRoute = useCallback((route: string, options: PreloadOptions = {}) => {
    const { priority = 'medium', delay = 0, condition } = options;
    
    // Check conditions
    if (condition && !condition()) return;
    if (wasRecentlyPreloaded(route)) return;
    if (!shouldPreloadBasedOnNetwork() && priority !== 'high') return;
    
    // Clear existing timeout for this route
    const existingTimeout = preloadTimeoutsRef.current.get(route);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set up preloading with delay
    const timeout = setTimeout(() => {
      try {
        router.prefetch(route);
        preloadedRoutesRef.current.set(route, Date.now());
        console.log(`Preloaded route: ${route} (priority: ${priority})`);
      } catch (error) {
        console.warn(`Failed to preload route: ${route}`, error);
      } finally {
        preloadTimeoutsRef.current.delete(route);
      }
    }, delay);
    
    preloadTimeoutsRef.current.set(route, timeout);
  }, [router, wasRecentlyPreloaded, shouldPreloadBasedOnNetwork]);

  // Preload multiple routes with different priorities
  const preloadRoutes = useCallback((configs: RoutePreloadConfig[]) => {
    configs.forEach(({ route, options }) => {
      preloadRoute(route, options);
    });
  }, [preloadRoute]);

  // Get likely navigation targets based on current route and user
  const getLikelyNavigationTargets = useCallback((): RoutePreloadConfig[] => {
    const configs: RoutePreloadConfig[] = [];
    
    // Always preload home if not already there
    if (pathname !== '/') {
      configs.push({
        route: '/',
        options: { priority: 'high', delay: 100 }
      });
    }
    
    // User-specific routes
    if (session?.uid) {
      // Always preload user's profile
      configs.push({
        route: `/user/${session.uid}`,
        options: { priority: 'high', delay: 200 }
      });
      
      // Preload notifications
      configs.push({
        route: '/notifications',
        options: { priority: 'medium', delay: 500 }
      });
    }
    
    // Route-specific preloading
    switch (pathname) {
      case '/':
        // From home, likely to go to new page or notifications
        configs.push(
          {
            route: '/new',
            options: { priority: 'medium', delay: 1000 }
          }
        );
        break;
        
      case '/notifications':
        // From notifications, likely to go back to home or profile
        if (session?.uid) {
          configs.push({
            route: `/user/${session.uid}`,
            options: { priority: 'medium', delay: 500 }
          });
        }
        break;
        
      case '/new':
        // From new page, likely to go back to home
        configs.push({
          route: '/',
          options: { priority: 'medium', delay: 500 }
        });
        break;
        
      default:
        // For user profiles, preload their pages
        if (pathname.startsWith('/user/')) {
          configs.push({
            route: '/',
            options: { priority: 'medium', delay: 1000 }
          });
        }
    }
    
    return configs;
  }, [pathname, session?.uid]);

  // Auto-preload likely targets when route changes
  useEffect(() => {
    const targets = getLikelyNavigationTargets();
    
    // Delay auto-preloading to not interfere with current page loading
    const timer = setTimeout(() => {
      preloadRoutes(targets);
    }, 2000); // 2 second delay
    
    return () => clearTimeout(timer);
  }, [pathname, getLikelyNavigationTargets, preloadRoutes]);

  // Preload on user interaction (hover, focus)
  const preloadOnInteraction = useCallback((route: string, priority: 'high' | 'medium' | 'low' = 'medium') => {
    preloadRoute(route, { 
      priority, 
      delay: priority === 'high' ? 0 : 100 
    });
  }, [preloadRoute]);

  // Preload critical routes immediately
  const preloadCritical = useCallback((routes: string[]) => {
    routes.forEach(route => {
      preloadRoute(route, { priority: 'high', delay: 0 });
    });
  }, [preloadRoute]);

  // Get preloading statistics
  const getPreloadStats = useCallback(() => {
    return {
      totalPreloaded: preloadedRoutesRef.current.size,
      activeTimeouts: preloadTimeoutsRef.current.size,
      preloadedRoutes: Array.from(preloadedRoutesRef.current.keys())};
  }, []);

  return {
    preloadRoute,
    preloadRoutes,
    preloadOnInteraction,
    preloadCritical,
    getLikelyNavigationTargets,
    getPreloadStats,
    wasRecentlyPreloaded};
}

/**
 * Hook for mobile navigation specific preloading
 */
export function useMobileNavigationPreloader() {
  const { session } = useCurrentAccount();
  const { preloadCritical, preloadOnInteraction } = useRoutePreloader();

  // Preload critical mobile navigation routes
  useEffect(() => {
    if (!session?.uid) return;
    
    const criticalRoutes = [
      '/',
      `/user/${session.uid}`,
      '/notifications',
      '/new',
    ];
    
    // Preload critical routes after a short delay
    const timer = setTimeout(() => {
      preloadCritical(criticalRoutes);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [session?.uid, preloadCritical]);

  // Return preload function for navigation buttons
  return {
    preloadOnHover: preloadOnInteraction,
    preloadOnFocus: preloadOnInteraction};
}

export default useRoutePreloader;