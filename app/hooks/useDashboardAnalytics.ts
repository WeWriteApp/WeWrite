import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DashboardAnalyticsService,
  type DashboardMetrics,
  type DateRange
} from '../services/dashboardAnalytics';

// Debounce utility
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

interface UseDashboardAnalyticsReturn {
  metrics: DashboardMetrics | null;
  summaryStats: {
    totalNewAccounts: number;
    totalNewPages: number;
    totalShares: number;
    totalSuccessfulShares: number;
    shareSuccessRate: number;
  } | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching dashboard analytics data with debouncing
 */
export function useDashboardAnalytics(dateRange: DateRange): UseDashboardAnalyticsReturn {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes to avoid excessive API calls
  const debouncedDateRange = useDebounce(dateRange, 300);

  // Track if this is the initial load
  const isInitialLoad = useRef(true);

  const fetchData = useCallback(async () => {

    try {
      setLoading(true);
      setError(null);

      // Fetch both metrics and summary stats
      const [metricsData, statsData] = await Promise.all([
        DashboardAnalyticsService.getAllMetrics(debouncedDateRange),
        DashboardAnalyticsService.getSummaryStats(debouncedDateRange)
      ]);

      setMetrics(metricsData);
      setSummaryStats(statsData);
    } catch (err) {
      console.error('Error fetching dashboard analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, [debouncedDateRange]);

  // Fetch data when debounced date range changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    metrics,
    summaryStats,
    loading,
    error,
    refetch: fetchData
  };
}

/**
 * Hook for fetching individual metric types
 */
export function useAccountsMetrics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await DashboardAnalyticsService.getNewAccountsCreated(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching accounts metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function usePagesMetrics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await DashboardAnalyticsService.getNewPagesCreated(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching pages metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pages data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useSharesMetrics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await DashboardAnalyticsService.getSharesAnalytics(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching shares metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch shares data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useEditsMetrics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    console.log('🔍 [useEditsMetrics] Fetching edits data for date range:', {
      startDate: debouncedDateRange.startDate.toISOString(),
      endDate: debouncedDateRange.endDate.toISOString()
    });

    try {
      setLoading(true);
      setError(null);
      const result = await DashboardAnalyticsService.getEditsAnalytics(debouncedDateRange, granularity);
      console.log('✅ [useEditsMetrics] Received edits data:', result);
      setData(result);
    } catch (err) {
      console.error('❌ [useEditsMetrics] Error fetching edits metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch edits data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useContentChangesMetrics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await DashboardAnalyticsService.getContentChangesAnalytics(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching content changes metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch content changes data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function usePWAInstallsMetrics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await DashboardAnalyticsService.getPWAInstallsAnalytics(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching PWA installs metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch PWA installs data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching visitor analytics metrics
 */
export function useVisitorMetrics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await DashboardAnalyticsService.getVisitorAnalytics(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching visitor metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch visitor data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useCompositePagesMetrics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await DashboardAnalyticsService.getCompositePagesData(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching composite pages metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch composite pages data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useCumulativePagesMetrics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await DashboardAnalyticsService.getCumulativePagesData(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching cumulative pages metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch cumulative pages data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useTotalPagesEverCreated() {
  const [data, setData] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await DashboardAnalyticsService.getTotalPagesEverCreated();
      setData(result);
    } catch (err) {
      console.error('Error fetching total pages count:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch total pages count');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}