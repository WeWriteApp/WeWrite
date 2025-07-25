import { useState, useEffect, useCallback } from 'react';
import { type DateRange } from '../components/admin/DateRangeFilter';

// Debounce utility (copied from useDashboardAnalytics.ts)
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface TokenAnalyticsData {
  unfundedLoggedOut: {
    totalTokens: number;
    totalUsdValue: number;
    allocations: number;
  };
  unfundedLoggedIn: {
    totalTokens: number;
    totalUsdValue: number;
    allocations: number;
  };
  funded: {
    totalTokens: number;
    totalUsdValue: number;
    allocations: number;
  };
  totalSubscriptionRevenue: number;
  totalWriterPayouts: number;
  platformFeeRevenue: number;
}

interface UseTokenAnalyticsResult {
  data: TokenAnalyticsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTokenAnalytics(dateRange: DateRange): UseTokenAnalyticsResult {
  const [data, setData] = useState<TokenAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes to avoid excessive API calls
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    // Early return if dateRange is not properly initialized
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔄 [useTokenAnalytics] Fetching token analytics data...', debouncedDateRange);

      const params = new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString()
      });

      const response = await fetch(`/api/admin/token-analytics?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch token analytics: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch token analytics');
      }

      console.log('✅ [useTokenAnalytics] Token analytics data fetched:', result.data);
      setData(result.data);

    } catch (err) {
      console.error('❌ [useTokenAnalytics] Error fetching token analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch token analytics');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { 
    data, 
    loading, 
    error, 
    refetch: fetchData 
  };
}

// Individual hooks for specific metrics
export function useUnfundedLoggedOutTokens(dateRange: DateRange) {
  const { data, loading, error, refetch } = useTokenAnalytics(dateRange);
  
  return {
    data: data?.unfundedLoggedOut || { totalTokens: 0, totalUsdValue: 0, allocations: 0 },
    loading,
    error,
    refetch
  };
}

export function useUnfundedLoggedInTokens(dateRange: DateRange) {
  const { data, loading, error, refetch } = useTokenAnalytics(dateRange);
  
  return {
    data: data?.unfundedLoggedIn || { totalTokens: 0, totalUsdValue: 0, allocations: 0 },
    loading,
    error,
    refetch
  };
}

export function useFundedTokens(dateRange: DateRange) {
  const { data, loading, error, refetch } = useTokenAnalytics(dateRange);
  
  return {
    data: data?.funded || { totalTokens: 0, totalUsdValue: 0, allocations: 0 },
    loading,
    error,
    refetch
  };
}

export function useSubscriptionRevenue(dateRange: DateRange) {
  const { data, loading, error, refetch } = useTokenAnalytics(dateRange);
  
  return {
    data: data?.totalSubscriptionRevenue || 0,
    loading,
    error,
    refetch
  };
}

export function useWriterPayouts(dateRange: DateRange) {
  const { data, loading, error, refetch } = useTokenAnalytics(dateRange);
  
  return {
    data: data?.totalWriterPayouts || 0,
    loading,
    error,
    refetch
  };
}

export function usePlatformFeeRevenueFromTokens(dateRange: DateRange) {
  const { data, loading, error, refetch } = useTokenAnalytics(dateRange);
  
  return {
    data: data?.platformFeeRevenue || 0,
    loading,
    error,
    refetch
  };
}
