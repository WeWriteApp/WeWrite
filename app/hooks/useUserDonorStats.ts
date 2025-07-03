"use client";

import { useState, useEffect } from 'react';
import { UserDonorAnalyticsService, UserDonorStats } from '../services/userDonorAnalytics';
import { useFeatureFlag } from '../utils/feature-flags';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';

interface UseUserDonorStatsResult {
  donorStats: UserDonorStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage user donor statistics
 */
export function useUserDonorStats(userId: string): UseUserDonorStatsResult {
  const { currentAccount } = useCurrentAccount();
  const isPaymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);
  
  const [donorStats, setDonorStats] = useState<UserDonorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDonorStats = async () => {
    if (!isPaymentsEnabled || !userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Try API endpoint first
      try {
        const response = await fetch(`/api/users/${userId}/donors`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setDonorStats(result.data);
            return;
          }
        }
      } catch (apiError) {
        console.warn('API endpoint failed, using direct service:', apiError);
      }
      
      // Fallback to direct service call
      const stats = await UserDonorAnalyticsService.getUserDonorAnalytics(userId);
      setDonorStats(stats);
      
    } catch (err) {
      console.error('Error loading donor analytics:', err);
      setError('Failed to load donor data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDonorStats();
  }, [userId, isPaymentsEnabled]);

  return {
    donorStats,
    isLoading,
    error,
    refetch: fetchDonorStats
  };
}
