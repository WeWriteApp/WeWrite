"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  unifiedStatsService, 
  UnifiedPageStats, 
  UnifiedUserStats, 
  BatchStatsResult 
} from '../services/UnifiedStatsService';

export interface UsePageStatsOptions {
  pageId: string;
  realTime?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UsePageStatsResult {
  stats: UnifiedPageStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  subscribe: () => () => void;
  unsubscribe: () => void;
}

export interface UseUserStatsOptions {
  userId: string;
  realTime?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseUserStatsResult {
  stats: UnifiedUserStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  subscribe: () => () => void;
  unsubscribe: () => void;
}

export interface UseBatchStatsOptions {
  pageIds?: string[];
  userIds?: string[];
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseBatchStatsResult {
  result: BatchStatsResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for page statistics with real-time updates
 * Replaces individual stats hooks and provides unified interface
 */
export function usePageStats(options: UsePageStatsOptions): UsePageStatsResult {
  const {
    pageId,
    realTime = false,
    autoRefresh = false,
    refreshInterval = 60000 // 1 minute
  } = options;

  const [stats, setStats] = useState<UnifiedPageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsubscriber, setUnsubscriber] = useState<(() => void) | null>(null);

  const fetchStats = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await unifiedStatsService.getPageStats(pageId, forceRefresh);
      setStats(result);
      
      console.log(`📊 [usePageStats] Fetched stats for ${pageId}:`, {
        cached: result.cached,
        totalViews: result.totalViews,
        supporterCount: result.supporterCount,
        recentChanges: result.recentChanges
      });
      
    } catch (err) {
      console.error('Error fetching page stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch page stats');
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  const subscribe = useCallback(() => {
    if (!realTime) return () => {};

    const unsub = unifiedStatsService.subscribeToPageStats(pageId, (newStats) => {
      setStats(newStats);
      console.log(`📊 [usePageStats] Real-time update for ${pageId}:`, newStats);
    });

    setUnsubscriber(() => unsub);
    return unsub;
  }, [pageId, realTime]);

  const unsubscribe = useCallback(() => {
    if (unsubscriber) {
      unsubscriber();
      setUnsubscriber(null);
    }
  }, [unsubscriber]);

  const refresh = useCallback(() => fetchStats(true), [fetchStats]);

  // Initial fetch
  useEffect(() => {
    if (pageId) {
      fetchStats();
    }
  }, [fetchStats]);

  // Set up real-time subscription
  useEffect(() => {
    if (realTime && pageId) {
      const unsub = subscribe();
      return unsub;
    }
  }, [realTime, pageId, subscribe]);

  // Set up auto-refresh
  useEffect(() => {
    if (autoRefresh && !realTime) {
      const interval = setInterval(() => {
        fetchStats(true);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, realTime, refreshInterval, fetchStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    stats,
    loading,
    error,
    refresh,
    subscribe,
    unsubscribe
  };
}

/**
 * Hook for user statistics with real-time updates
 */
export function useUserStats(options: UseUserStatsOptions): UseUserStatsResult {
  const {
    userId,
    realTime = false,
    autoRefresh = false,
    refreshInterval = 300000 // 5 minutes (less frequent than page stats)
  } = options;

  const [stats, setStats] = useState<UnifiedUserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsubscriber, setUnsubscriber] = useState<(() => void) | null>(null);

  const fetchStats = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await unifiedStatsService.getUserStats(userId, forceRefresh);
      setStats(result);
      
      console.log(`📊 [useUserStats] Fetched stats for ${userId}:`, {
        cached: result.cached,
        pageCount: result.pageCount,
        totalViews: result.totalViews,
        followerCount: result.followerCount
      });
      
    } catch (err) {
      console.error('Error fetching user stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user stats');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const subscribe = useCallback(() => {
    if (!realTime) return () => {};

    const unsub = unifiedStatsService.subscribeToUserStats(userId, (newStats) => {
      setStats(newStats);
      console.log(`📊 [useUserStats] Real-time update for ${userId}:`, newStats);
    });

    setUnsubscriber(() => unsub);
    return unsub;
  }, [userId, realTime]);

  const unsubscribe = useCallback(() => {
    if (unsubscriber) {
      unsubscriber();
      setUnsubscriber(null);
    }
  }, [unsubscriber]);

  const refresh = useCallback(() => fetchStats(true), [fetchStats]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchStats();
    }
  }, [fetchStats]);

  // Set up real-time subscription
  useEffect(() => {
    if (realTime && userId) {
      const unsub = subscribe();
      return unsub;
    }
  }, [realTime, userId, subscribe]);

  // Set up auto-refresh
  useEffect(() => {
    if (autoRefresh && !realTime) {
      const interval = setInterval(() => {
        fetchStats(true);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, realTime, refreshInterval, fetchStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    stats,
    loading,
    error,
    refresh,
    subscribe,
    unsubscribe
  };
}

/**
 * Hook for batch statistics fetching
 */
export function useBatchStats(options: UseBatchStatsOptions): UseBatchStatsResult {
  const {
    pageIds = [],
    userIds = [],
    autoRefresh = false,
    refreshInterval = 120000 // 2 minutes
  } = options;

  const [result, setResult] = useState<BatchStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const batchResult = await unifiedStatsService.getBatchStats(pageIds, userIds);
      setResult(batchResult);
      
      console.log(`📊 [useBatchStats] Fetched batch stats:`, {
        pageIds: pageIds.length,
        userIds: userIds.length,
        cached: batchResult.cached.length,
        fetched: batchResult.fetched.length,
        loadTime: batchResult.loadTime
      });
      
    } catch (err) {
      console.error('Error fetching batch stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch batch stats');
    } finally {
      setLoading(false);
    }
  }, [pageIds, userIds]);

  const refresh = useCallback(() => fetchStats(), [fetchStats]);

  // Initial fetch
  useEffect(() => {
    if (pageIds.length > 0 || userIds.length > 0) {
      fetchStats();
    }
  }, [fetchStats]);

  // Set up auto-refresh
  useEffect(() => {
    if (autoRefresh && (pageIds.length > 0 || userIds.length > 0)) {
      const interval = setInterval(fetchStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchStats, pageIds.length, userIds.length]);

  return {
    result,
    loading,
    error,
    refresh
  };
}

/**
 * Convenience hooks for specific use cases
 */

export function usePageStatsRealTime(pageId: string) {
  return usePageStats({ pageId, realTime: true });
}

export function usePageStatsWithAutoRefresh(pageId: string, refreshInterval = 60000) {
  return usePageStats({ pageId, autoRefresh: true, refreshInterval });
}

export function useUserStatsRealTime(userId: string) {
  return useUserStats({ userId, realTime: true });
}
