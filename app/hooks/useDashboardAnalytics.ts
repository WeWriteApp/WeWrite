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
    // Early return if dateRange is not properly initialized
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      console.log('🔍 [useDashboardAnalytics] Skipping fetch - dateRange not properly initialized:', debouncedDateRange);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all metrics via API endpoint
      const response = await fetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        type: 'all'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard analytics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch dashboard analytics');
      }

      const {
        accounts: accountsData,
        pages: pagesData,
        shares: sharesData,
        edits: editsData,
        contentChanges: contentChangesData,
        pwaInstalls: pwaInstallsData
      } = result.data;

      const dashboardMetrics: DashboardMetrics = {
        newAccountsCreated: accountsData || [],
        newPagesCreated: pagesData || [],
        sharesAnalytics: sharesData || [],
        editsAnalytics: editsData || [],
        contentChangesAnalytics: contentChangesData || [],
        pwaInstallsAnalytics: pwaInstallsData || []
      };

      setMetrics(dashboardMetrics);

      // Calculate summary stats
      const totalNewAccounts = accountsData?.reduce((sum: number, item: any) => sum + item.newAccountsCreated, 0) || 0;
      const totalNewPages = pagesData?.reduce((sum: number, item: any) => sum + item.newPagesCreated, 0) || 0;
      const totalShares = sharesData?.reduce((sum: number, item: any) => sum + item.totalShares, 0) || 0;
      const totalSuccessfulShares = sharesData?.reduce((sum: number, item: any) => sum + item.successfulShares, 0) || 0;
      const shareSuccessRate = totalShares > 0 ? (totalSuccessfulShares / totalShares) * 100 : 0;

      setSummaryStats({
        totalNewAccounts,
        totalNewPages,
        totalShares,
        totalSuccessfulShares,
        shareSuccessRate
      });
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
    // Early return if dateRange is not properly initialized
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      console.log('🔍 [useAccountsMetrics] Skipping fetch - dateRange not properly initialized');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'accounts'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch accounts metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch accounts metrics');
      }

      // Ensure data is always an array
      const responseData = result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      console.log('🔍 [useAccountsMetrics] API Response:', { responseData, safeData });
      setData(safeData);
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
    // Early return if dateRange is not properly initialized
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'pages'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pages metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch pages metrics');
      }

      // Ensure data is always an array
      const responseData = result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
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
    // Early return if dateRange is not properly initialized
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'shares'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch shares metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch shares metrics');
      }

      // Ensure data is always an array
      const responseData = result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
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
    // Early return if dateRange is not properly initialized
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'edits'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch edits metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch edits metrics');
      }

      // Ensure data is always an array
      const responseData = result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
    } catch (err) {
      console.error('Error fetching edits metrics:', err);
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
    // Early return if dateRange is not properly initialized
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'contentChanges'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch content changes metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch content changes metrics');
      }

      // Ensure data is always an array
      const responseData = result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
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
    // Early return if dateRange is not properly initialized
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'pwaInstalls'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch PWA installs metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch PWA installs metrics');
      }

      // Ensure data is always an array
      const responseData = result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
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
    // Early return if dateRange is not properly initialized
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'visitors'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch visitor metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch visitor metrics');
      }

      // Ensure data is always an array
      const responseData = result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
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
    // Early return if dateRange is not properly initialized
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

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
    // Early return if dateRange is not properly initialized
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

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