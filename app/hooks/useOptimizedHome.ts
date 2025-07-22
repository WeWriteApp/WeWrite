"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';

interface HomeData {
  recentlyVisitedPages: any[];
  trendingPages: any[];
  userStats?: any;
  batchUserData?: Record<string, any>;
}

/**
 * Simple home data hook - no bullshit
 */
export function useOptimizedHome() {
  const { user } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchHomeData = async () => {
      try {
        console.log('[useOptimizedHome] Fetching data for user:', user.uid);

        const response = await fetch(`/api/home?userId=${user.uid}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        console.log('[useOptimizedHome] Data received:', {
          recentlyVisitedPages: data.recentlyVisitedPages?.length || 0,
          trendingPages: data.trendingPages?.length || 0,
          hasBatchUserData: !!data.batchUserData
        });

        setData(data);
        setError(null);
      } catch (err) {
        console.error('[useOptimizedHome] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, [user?.uid]);

  return { data, loading, error };
}