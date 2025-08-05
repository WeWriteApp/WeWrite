"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useSmartDataFetching } from './useSmartDataFetching';

interface HomeData {
  recentlyVisitedPages: any[];
  trendingPages: any[];
  userStats?: any;
  batchUserData?: Record<string, any>;
}

/**
 * Optimized home data hook with smart caching and rapid navigation support
 */
export function useOptimizedHome() {
  const { user } = useAuth();

  // Use smart data fetching with caching and rapid navigation optimization
  const {
    data,
    loading,
    error,
    isFromCache,
    refetch
  } = useSmartDataFetching<HomeData>(
    'home-data',
    async () => {
      console.log('[useOptimizedHome] Fetching fresh data for user:', user?.uid);

      const response = await fetch(`/api/home?userId=${user?.uid}`, {
        headers: {
          'Cache-Control': 'max-age=60', // Browser cache for 1 minute
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      console.log('[useOptimizedHome] Fresh data received:', {
        recentlyVisitedPages: data.recentlyVisitedPages?.length || 0,
        trendingPages: data.trendingPages?.length || 0,
        hasBatchUserData: !!data.batchUserData,
        fromCache: false
      });

      return data;
    },
    {
      enableCache: true,
      backgroundRefresh: true,
      cacheTTL: 15 * 60 * 1000, // 🚨 EMERGENCY: 15 minutes cache to reduce reads
      enabled: !!user?.uid,
    }
  );

  // Log cache hits for monitoring
  if (data && isFromCache) {
    console.log('[useOptimizedHome] Using cached data:', {
      recentlyVisitedPages: data.recentlyVisitedPages?.length || 0,
      trendingPages: data.trendingPages?.length || 0,
      hasBatchUserData: !!data.batchUserData,
      fromCache: true
    });
  }

  return {
    data,
    loading,
    error: error || null,
    isFromCache,
    refetch
  };
}