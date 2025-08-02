"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';

interface CachedRouteData {
  data: any;
  timestamp: number;
  etag?: string;
  lastModified?: string;
}

interface NavigationCacheConfig {
  // Cache TTL in milliseconds
  cacheTTL: number;
  // Maximum cache size (number of routes)
  maxCacheSize: number;
  // Routes that should be cached aggressively
  criticalRoutes: string[];
  // Routes that should never be cached
  excludedRoutes: string[];
  // Enable background refresh
  backgroundRefresh: boolean;
}

const DEFAULT_CONFIG: NavigationCacheConfig = {
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 50,
  criticalRoutes: ['/', '/notifications', '/new'],
  excludedRoutes: ['/admin', '/settings'],
  backgroundRefresh: true,
};

/**
 * Smart navigation cache that prevents excessive database reads during rapid navigation
 * 
 * Features:
 * - Route-based caching with TTL
 * - Background refresh for stale data
 * - Change detection to minimize reads
 * - LRU eviction policy
 * - Critical route prioritization
 * - Rapid navigation optimization
 */
export function useNavigationCache(config: Partial<NavigationCacheConfig> = {}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Cache storage - using Map for better performance
  const cacheRef = useRef<Map<string, CachedRouteData>>(new Map());
  const accessOrderRef = useRef<string[]>([]);
  const pendingRequestsRef = useRef<Map<string, Promise<any>>>(new Map());
  const changeListenersRef = useRef<Map<string, () => void>>(new Map());
  
  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [lastNavigationTime, setLastNavigationTime] = useState(0);
  const navigationCountRef = useRef(0);
  
  // Track rapid navigation
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastNav = now - lastNavigationTime;
    
    if (timeSinceLastNav < 1000) { // Less than 1 second
      navigationCountRef.current++;
      setIsNavigating(true);
      
      // Reset navigation state after rapid navigation ends
      const timer = setTimeout(() => {
        navigationCountRef.current = 0;
        setIsNavigating(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    } else {
      navigationCountRef.current = 1;
      setIsNavigating(false);
    }
    
    setLastNavigationTime(now);
  }, [pathname, lastNavigationTime]);
  
  // Generate cache key for current route and user
  const getCacheKey = useCallback((route: string, userId?: string) => {
    return `${route}:${userId || 'anonymous'}`;
  }, []);
  
  // Check if route should be cached
  const shouldCache = useCallback((route: string) => {
    return !fullConfig.excludedRoutes.some(excluded => route.startsWith(excluded));
  }, [fullConfig.excludedRoutes]);
  
  // LRU cache management
  const updateAccessOrder = useCallback((key: string) => {
    const index = accessOrderRef.current.indexOf(key);
    if (index > -1) {
      accessOrderRef.current.splice(index, 1);
    }
    accessOrderRef.current.push(key);
    
    // Evict oldest entries if cache is full
    while (accessOrderRef.current.length > fullConfig.maxCacheSize) {
      const oldestKey = accessOrderRef.current.shift();
      if (oldestKey) {
        cacheRef.current.delete(oldestKey);
        changeListenersRef.current.delete(oldestKey);
      }
    }
  }, [fullConfig.maxCacheSize]);
  
  // Get cached data with freshness check
  const getCachedData = useCallback((route: string, userId?: string) => {
    if (!shouldCache(route)) return null;
    
    const key = getCacheKey(route, userId);
    const cached = cacheRef.current.get(key);
    
    if (!cached) return null;
    
    const now = Date.now();
    const age = now - cached.timestamp;
    
    // During rapid navigation, use slightly stale data to prevent reads
    const effectiveTTL = isNavigating && navigationCountRef.current > 2 
      ? fullConfig.cacheTTL * 2 // Double TTL during rapid navigation
      : fullConfig.cacheTTL;
    
    if (age > effectiveTTL) {
      // Data is stale, but return it anyway if we're navigating rapidly
      if (isNavigating && navigationCountRef.current > 3) {
        console.log(`🚀 RAPID NAV: Using stale cache for ${route} (age: ${Math.round(age/1000)}s)`);
        updateAccessOrder(key);
        return cached.data;
      }
      return null;
    }
    
    updateAccessOrder(key);
    return cached.data;
  }, [shouldCache, getCacheKey, isNavigating, fullConfig.cacheTTL, updateAccessOrder]);
  
  // Set cached data
  const setCachedData = useCallback((route: string, data: any, userId?: string, etag?: string) => {
    if (!shouldCache(route)) return;
    
    const key = getCacheKey(route, userId);
    const cached: CachedRouteData = {
      data,
      timestamp: Date.now(),
      etag,
    };
    
    cacheRef.current.set(key, cached);
    updateAccessOrder(key);
    
    console.log(`📦 CACHE: Stored data for ${route} (size: ${cacheRef.current.size})`);
  }, [shouldCache, getCacheKey, updateAccessOrder]);
  
  // Smart fetch with deduplication and caching
  const fetchWithCache = useCallback(async <T>(
    route: string,
    fetcher: () => Promise<T>,
    options: {
      userId?: string;
      forceRefresh?: boolean;
      backgroundRefresh?: boolean;
    } = {}
  ): Promise<T> => {
    const { userId, forceRefresh = false, backgroundRefresh = false } = options;
    const key = getCacheKey(route, userId);
    
    // Check for pending request to prevent duplicate fetches
    if (pendingRequestsRef.current.has(key)) {
      console.log(`⏳ DEDUP: Waiting for pending request for ${route}`);
      return pendingRequestsRef.current.get(key)!;
    }
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCachedData(route, userId);
      if (cached) {
        console.log(`🎯 CACHE HIT: Using cached data for ${route}`);
        
        // Background refresh for critical routes if enabled
        if (backgroundRefresh && fullConfig.backgroundRefresh && 
            fullConfig.criticalRoutes.includes(route)) {
          setTimeout(() => {
            fetchWithCache(route, fetcher, { ...options, forceRefresh: true, backgroundRefresh: false });
          }, 100);
        }
        
        return cached;
      }
    }
    
    // Create fetch promise
    const fetchPromise = (async () => {
      try {
        console.log(`🌐 FETCH: Loading fresh data for ${route}`);
        const data = await fetcher();
        setCachedData(route, data, userId);
        return data;
      } catch (error) {
        console.error(`❌ FETCH ERROR for ${route}:`, error);
        throw error;
      } finally {
        pendingRequestsRef.current.delete(key);
      }
    })();
    
    pendingRequestsRef.current.set(key, fetchPromise);
    return fetchPromise;
  }, [getCacheKey, getCachedData, setCachedData, fullConfig]);
  
  // Invalidate cache for specific route
  const invalidateRoute = useCallback((route: string, userId?: string) => {
    const key = getCacheKey(route, userId);
    cacheRef.current.delete(key);
    changeListenersRef.current.delete(key);
    
    const index = accessOrderRef.current.indexOf(key);
    if (index > -1) {
      accessOrderRef.current.splice(index, 1);
    }
    
    console.log(`🗑️ CACHE: Invalidated ${route}`);
  }, [getCacheKey]);
  
  // Clear all cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    accessOrderRef.current.length = 0;
    changeListenersRef.current.clear();
    pendingRequestsRef.current.clear();
    console.log('🧹 CACHE: Cleared all cached data');
  }, []);
  
  // Preload critical routes
  const preloadCriticalRoutes = useCallback(async (routes: string[]) => {
    if (!user?.uid) return;
    
    const preloadPromises = routes.map(route => {
      // Only preload if not already cached
      if (!getCachedData(route, user.uid)) {
        return fetch(`/api${route === '/' ? '/home' : route}?userId=${user.uid}`)
          .then(res => res.json())
          .then(data => setCachedData(route, data, user.uid))
          .catch(err => console.warn(`Preload failed for ${route}:`, err));
      }
      return Promise.resolve();
    });
    
    await Promise.allSettled(preloadPromises);
    console.log(`🚀 PRELOAD: Completed for ${routes.length} routes`);
  }, [user?.uid, getCachedData, setCachedData]);
  
  // Auto-preload critical routes when user changes
  useEffect(() => {
    if (user?.uid && fullConfig.criticalRoutes.length > 0) {
      const timer = setTimeout(() => {
        preloadCriticalRoutes(fullConfig.criticalRoutes);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user?.uid, fullConfig.criticalRoutes, preloadCriticalRoutes]);
  
  return {
    // Core caching functions
    fetchWithCache,
    getCachedData,
    setCachedData,
    
    // Cache management
    invalidateRoute,
    clearCache,
    preloadCriticalRoutes,
    
    // Navigation state
    isRapidNavigating: isNavigating && navigationCountRef.current > 2,
    navigationCount: navigationCountRef.current,
    
    // Cache stats
    cacheSize: cacheRef.current.size,
    maxCacheSize: fullConfig.maxCacheSize,
  };
}

export default useNavigationCache;
