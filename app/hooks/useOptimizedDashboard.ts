"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { getCacheItem, setCacheItem, generateCacheKey } from '../utils/cacheUtils';

interface DashboardData {
  recentPages: any[];
  userGroups: any[];
  trendingPages: any[];
  userStats?: any;
  timestamp: number;
  loadTime: number;
  cached?: boolean;
  cacheAge?: number;
}

interface UseOptimizedDashboardReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isStale: boolean;
  lastUpdated: number | null;
}

// Cache TTL for dashboard data
const DASHBOARD_CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const STALE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

/**
 * Optimized dashboard hook that fetches all home page data in a single request
 * Uses intelligent caching and background refresh strategies
 */
export function useOptimizedDashboard(): UseOptimizedDashboardReturn {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const backgroundRefreshRef = useRef<boolean>(false);

  /**
   * Check if data is stale
   */
  const isStale = data ? (Date.now() - data.timestamp) > STALE_THRESHOLD : false;

  /**
   * Fetch dashboard data from API
   */
  const fetchDashboardData = useCallback(async (forceRefresh = false, isBackground = false) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      if (!isBackground) {
        setLoading(true);
        setError(null);
      }
      
      const params = new URLSearchParams();
      if (user?.uid) {
        params.append('userId', user.uid);
      }
      if (forceRefresh) {
        params.append('forceRefresh', 'true');
      }
      
      console.log(`Dashboard: Fetching data (background: ${isBackground}, forceRefresh: ${forceRefresh})`);
      
      const response = await fetch(`/api/home-dashboard?${params}`, {
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const dashboardData: DashboardData = await response.json();
      
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      console.log(`Dashboard: Data received (cached: ${dashboardData.cached}, loadTime: ${dashboardData.loadTime?.toFixed(2)}ms)`);
      
      setData(dashboardData);
      setLastUpdated(Date.now());
      
      // If this was a background refresh, show a subtle indicator
      if (isBackground && dashboardData.cached === false) {
        console.log('Dashboard: Background refresh completed with fresh data');
      }
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled
      }
      
      console.error('Error fetching dashboard data:', err);
      
      if (!isBackground) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
      backgroundRefreshRef.current = false;
    }
  }, [user?.uid]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    await fetchDashboardData(true, false);
  }, [fetchDashboardData]);

  /**
   * Background refresh function
   */
  const backgroundRefresh = useCallback(async () => {
    if (backgroundRefreshRef.current) {
      return; // Already refreshing in background
    }
    
    backgroundRefreshRef.current = true;
    await fetchDashboardData(true, true);
  }, [fetchDashboardData]);

  // Initial data load
  useEffect(() => {
    fetchDashboardData(false, false);
  }, [fetchDashboardData]);

  // Set up background refresh for stale data
  useEffect(() => {
    if (!data || !isStale || backgroundRefreshRef.current) {
      return;
    }
    
    // Delay background refresh to avoid overwhelming the server
    const timer = setTimeout(() => {
      console.log('Dashboard: Data is stale, starting background refresh');
      backgroundRefresh();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [data, isStale, backgroundRefresh]);

  // Set up periodic refresh for active users
  useEffect(() => {
    if (!user || !data) {
      return;
    }
    
    // Refresh every 5 minutes for active users
    const interval = setInterval(() => {
      console.log('Dashboard: Periodic refresh for active user');
      backgroundRefresh();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user, data, backgroundRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
    isStale,
    lastUpdated
  };
}

/**
 * Hook for individual dashboard sections (fallback)
 */
export function useDashboardSection<T>(
  sectionName: keyof DashboardData,
  fallbackFetch?: () => Promise<T>
): {
  data: T | null;
  loading: boolean;
  error: string | null;
} {
  const dashboard = useOptimizedDashboard();
  const [fallbackData, setFallbackData] = useState<T | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  // Use dashboard data if available
  if (dashboard.data && dashboard.data[sectionName]) {
    return {
      data: dashboard.data[sectionName] as T,
      loading: dashboard.loading,
      error: dashboard.error
    };
  }

  // Fallback to individual fetch if dashboard fails and fallback is provided
  useEffect(() => {
    if (dashboard.error && fallbackFetch && !fallbackData && !fallbackLoading) {
      setFallbackLoading(true);
      setFallbackError(null);
      
      fallbackFetch()
        .then(setFallbackData)
        .catch(err => {
          console.error(`Error fetching ${sectionName} fallback:`, err);
          setFallbackError(err instanceof Error ? err.message : 'Failed to load data');
        })
        .finally(() => setFallbackLoading(false));
    }
  }, [dashboard.error, fallbackFetch, fallbackData, fallbackLoading, sectionName]);

  return {
    data: fallbackData,
    loading: dashboard.loading || fallbackLoading,
    error: dashboard.error || fallbackError
  };
}

export default useOptimizedDashboard;
