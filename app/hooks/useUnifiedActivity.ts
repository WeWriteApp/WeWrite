"use client";

import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';

export interface ActivityItem {
  id: string;
  title: string;
  userId: string;
  username: string;
  displayName?: string;
  lastModified: any;
  isPublic: boolean;
  totalPledged?: number;
  pledgeCount?: number;
  
  // Activity-specific data
  activityType: 'edit' | 'page';
  lastDiff?: {
    added: number;
    removed: number;
    hasChanges: boolean;
    preview?: any;
  };
  
  // Metadata
  isOwn?: boolean;
  isFollowed?: boolean;
}

export interface ActivityFilters {
  type: 'all' | 'edits' | 'pages';
  includeOwn: boolean;
  followingOnly: boolean;
}

export interface UseUnifiedActivityOptions {
  limit?: number;
  initialFilters?: Partial<ActivityFilters>;
  followedPageIds?: string[];
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseUnifiedActivityResult {
  activities: ActivityItem[];
  loading: boolean;
  error: string | null;
  filters: ActivityFilters;
  setFilters: (filters: Partial<ActivityFilters>) => void;
  refresh: () => Promise<void>;
  metadata: {
    total: number;
    hasMore: boolean;
    loadTime: number;
    timestamp: number;
  } | null;
}

/**
 * Unified hook for all recent activity needs
 * Replaces useOptimizedHome, useRecentActivity, and custom fetching logic
 */
export function useUnifiedActivity(options: UseUnifiedActivityOptions = {}): UseUnifiedActivityResult {
  const {
    limit = 20,
    initialFilters = {},
    followedPageIds = [],
    autoRefresh = false,
    refreshInterval = 60000 // 1 minute
  } = options;

  const { currentAccount } = useCurrentAccount();
  
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  
  const [filters, setFiltersState] = useState<ActivityFilters>({
    type: 'all',
    includeOwn: true,
    followingOnly: false,
    ...initialFilters
  });

  const setFilters = useCallback((newFilters: Partial<ActivityFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: limit.toString(),
        type: filters.type,
        includeOwn: filters.includeOwn.toString(),
        followingOnly: filters.followingOnly.toString()
      });

      if (currentAccount?.uid) {
        params.set('userId', currentAccount.uid);
      }

      if (followedPageIds.length > 0) {
        params.set('followedPageIds', followedPageIds.join(','));
      }

      console.log('🔄 [useUnifiedActivity] Fetching with params:', Object.fromEntries(params));

      const response = await fetch(`/api/activity/recent?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      console.log('🔄 [useUnifiedActivity] Received data:', {
        activities: data.activities?.length || 0,
        metadata: data.metadata,
        debug: data.debug
      });

      setActivities(data.activities || []);
      setMetadata(data.metadata || null);
      setError(null);

    } catch (err) {
      console.error('🔄 [useUnifiedActivity] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch activity');
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.uid, limit, filters, followedPageIds]);

  // Initial fetch and filter changes
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchActivity, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchActivity]);

  return {
    activities,
    loading,
    error,
    filters,
    setFilters,
    refresh: fetchActivity,
    metadata
  };
}

/**
 * Convenience hooks for specific use cases
 */

export function useRecentEdits(options: Omit<UseUnifiedActivityOptions, 'initialFilters'> = {}) {
  return useUnifiedActivity({
    ...options,
    initialFilters: {
      type: 'edits',
      includeOwn: false, // Hide own edits by default for recent edits view
      followingOnly: false
    }
  });
}

export function useRecentPages(options: Omit<UseUnifiedActivityOptions, 'initialFilters'> = {}) {
  return useUnifiedActivity({
    ...options,
    initialFilters: {
      type: 'all',
      includeOwn: true,
      followingOnly: false
    }
  });
}

export function useFollowingActivity(followedPageIds: string[], options: Omit<UseUnifiedActivityOptions, 'initialFilters' | 'followedPageIds'> = {}) {
  return useUnifiedActivity({
    ...options,
    followedPageIds,
    initialFilters: {
      type: 'all',
      includeOwn: false,
      followingOnly: true
    }
  });
}
