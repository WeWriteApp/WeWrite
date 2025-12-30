import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from './useDebounce';
import { adminFetch } from '../utils/adminFetch';

// Types for analytics data
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ChartDataPoint {
  date: string;
  count: number;
  label: string;
}

export interface PagesDataPoint {
  date: string;
  publicPages: number;
  privatePages: number;
  totalPages: number;
  label: string;
}

export interface DashboardMetrics {
  newAccountsCreated: ChartDataPoint[];
  newPagesCreated: PagesDataPoint[];
  sharesAnalytics: ChartDataPoint[];
  editsAnalytics: ChartDataPoint[];
  contentChangesAnalytics: ChartDataPoint[];
  pwaInstallsAnalytics: ChartDataPoint[];
  liveVisitorsCount: number;
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
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all metrics via API endpoint
      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
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
        pwaInstallsAnalytics: pwaInstallsData || [],
        liveVisitorsCount: 0 // Live visitors tracked separately
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
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
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

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
    } catch (err) {
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

      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
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

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
    } catch (err) {
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

      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
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

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const rawData = Array.isArray(responseData) ? responseData : [];

      // Transform simple count data to shares format expected by widget
      const transformedData = rawData.map(item => ({
        ...item,
        // Map simple count to shares format
        total: item.count || 0,
        successful: item.count || 0, // Assume all shares are successful for now
        aborted: 0, // No aborted shares in simplified model
        // Keep original fields for backward compatibility
        count: item.count || 0
      }));

      setData(transformedData);
    } catch (err) {
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

      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
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

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const rawData = Array.isArray(responseData) ? responseData : [];

      // Transform simple count data to edits format expected by widget
      const transformedData = rawData.map(item => ({
        ...item,
        // Map simple count to edits format (if needed by widget)
        value: item.count || 0,
        edits: item.count || 0,
        // Keep original fields for backward compatibility
        count: item.count || 0
      }));

      setData(transformedData);
    } catch (err) {
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

      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
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

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const rawData = Array.isArray(responseData) ? responseData : [];

      // Use real data fields from analytics_events (charactersAdded, charactersDeleted are tracked)
      // The count represents the number of content_change events per day
      const transformedData = rawData.map(item => ({
        ...item,
        // Use real data if available, otherwise use count as a fallback
        charactersAdded: item.charactersAdded || item.count || 0,
        charactersDeleted: item.charactersDeleted || 0,
        netChange: item.netChange || (item.charactersAdded || item.count || 0) - (item.charactersDeleted || 0),
        added: item.charactersAdded || item.count || 0,
        deleted: item.charactersDeleted || 0,
        total: item.count || 0,
        // Keep original fields for backward compatibility
        count: item.count || 0
      }));

      setData(transformedData);
    } catch (err) {
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

      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
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

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const rawData = Array.isArray(responseData) ? responseData : [];

      // Transform simple count data to PWA installs format expected by widget
      const transformedData = rawData.map(item => ({
        ...item,
        // Map simple count to PWA installs format
        value: item.count || 0,
        installs: item.count || 0,
        // Keep original fields for backward compatibility
        count: item.count || 0
      }));

      setData(transformedData);
    } catch (err) {
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

export function usePWANotificationsMetrics(dateRange: DateRange, granularity?: number) {
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

    setLoading(true);
    setError(null);

    try {
      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'pwaNotifications'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch PWA notifications metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch PWA notifications metrics');
      }

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const rawData = Array.isArray(responseData) ? responseData : [];

      // Transform simple count data to PWA notifications format expected by widget
      const transformedData = rawData.map(item => ({
        ...item,
        // Map simple count to PWA notifications format
        value: item.count || 0,
        notifications: item.count || 0,
        // Keep original fields for backward compatibility
        count: item.count || 0
      }));

      setData(transformedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch PWA notifications data');
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

      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
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

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
    } catch (err) {
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
      // Use API endpoint instead of direct service call
      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        type: 'pages',
        granularity: (granularity || 50).toString()
      }), {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pages data: ${response.status}`);
      }

      const apiResult = await response.json();
      if (!apiResult.success) {
        throw new Error(apiResult.error || 'Failed to fetch pages data');
      }

      // Fix: API returns nested structure {data: {data: [array]}}
      const rawData = apiResult.data?.data || apiResult.data;

      // Transform simple pages data to composite format expected by widget
      const transformedData = Array.isArray(rawData) ? rawData.map(item => ({
        ...item,
        // Map simple data to composite format
        pagesCreated: item.totalPages || 0,
        pagesDeleted: 0, // We don't track deletions in simplified model
        publicPagesCreated: 0, // Legacy field - not tracked anymore
        privatePagesCreated: item.totalPages || 0, // Assume all pages are private now
        netChange: item.totalPages || 0,
        // Keep original fields for backward compatibility
        totalPages: item.totalPages || 0,
        publicPages: item.publicPages || 0,
        privatePages: item.privatePages || 0
      })) : [];

      setData(transformedData);
    } catch (err) {
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
      // Use API endpoint instead of direct service call
      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        type: 'pages',
        granularity: (granularity || 50).toString()
      }), {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch cumulative pages data: ${response.status}`);
      }

      const apiResult = await response.json();
      if (!apiResult.success) {
        throw new Error(apiResult.error || 'Failed to fetch cumulative pages data');
      }

      // Fix: API returns nested structure {data: {data: [array]}}
      const result = apiResult.data?.data || apiResult.data;
      setData(result);
    } catch (err) {
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
      // Use API endpoint instead of direct service call
      const response = await adminFetch('/api/admin/dashboard-analytics?' + new URLSearchParams({
        type: 'pages',
        startDate: new Date('2020-01-01').toISOString(), // Get all pages ever
        endDate: new Date().toISOString()
      }), {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch total pages count: ${response.status}`);
      }

      const apiResult = await response.json();
      if (!apiResult.success) {
        throw new Error(apiResult.error || 'Failed to fetch total pages count');
      }

      // Fix: API returns nested structure {data: {data: [array]}}
      const pagesData = apiResult.data?.data || apiResult.data;
      const result = Array.isArray(pagesData) ? pagesData.reduce((sum: number, item: any) => sum + (item.totalPages || 0), 0) : 0;
      setData(result);
    } catch (err) {
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

/**
 * Hook for replies analytics (agree, disagree, neutral)
 * Returns data suitable for stacked bar charts
 */
export function useRepliesMetrics(dateRange: DateRange, granularity?: number) {
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

      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'replies'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch replies metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch replies metrics');
      }

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch replies data');
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
 * Hook for platform fee revenue analytics
 */
export function usePlatformFeeMetrics(dateRange: DateRange, granularity?: number, cumulative: boolean = false) {
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    growth: 0,
    averageFeePerPayout: 0,
    totalPayouts: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminFetch(`/api/admin/platform-fee-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        cumulative: cumulative.toString()
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch platform fee metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch platform fee metrics');
      }

      setData(result.data || []);
      setStats(result.stats || {
        totalRevenue: 0,
        monthlyRevenue: 0,
        growth: 0,
        averageFeePerPayout: 0,
        totalPayouts: 0
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch platform fee data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity, cumulative]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, stats, loading, error, refetch: fetchData };
}

/**
 * Hook for platform revenue analytics (platform fees + unallocated funds)
 */
export function usePlatformRevenueMetrics(dateRange: DateRange, granularity?: number, cumulative: boolean = false) {
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalRevenue: 0,
    totalPlatformFees: 0,
    totalUnallocatedFunds: 0,
    monthlyRevenue: 0,
    growth: 0,
    averageRevenuePerMonth: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminFetch(`/api/admin/platform-revenue?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        cumulative: cumulative.toString()
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch platform revenue metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch platform revenue metrics');
      }

      setData(result.chartData || []);
      setStats(result.stats || {
        totalRevenue: 0,
        totalPlatformFees: 0,
        totalUnallocatedFunds: 0,
        monthlyRevenue: 0,
        growth: 0,
        averageRevenuePerMonth: 0
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch platform revenue data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity, cumulative]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, stats, loading, error, refetch: fetchData };
}

/**
 * Hook for followed users analytics
 */
export function useFollowedUsersMetrics(dateRange: DateRange, granularity?: number) {
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

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: (granularity || 24).toString()
      });

      const response = await adminFetch(`/api/admin/analytics/followed-users?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch followed users analytics: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setData(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch followed users analytics');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error };
}

// Hook for page views analytics
export function usePageViewsMetrics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'pageViews'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch page views metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch page views metrics');
      }

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch page views data');
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
 * Hook for link analytics (internal and external links)
 * Returns data suitable for stacked bar charts
 */
export function useLinkMetrics(dateRange: DateRange, granularity?: number) {
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

      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'links'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch link metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch link metrics');
      }

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch link data');
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
 * Hook for notifications sent analytics (emails + push notifications)
 * Returns data suitable for stacked bar charts
 */
export function useNotificationsSentMetrics(dateRange: DateRange, granularity?: number) {
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

      const response = await adminFetch(`/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        granularity: granularity?.toString() || '50',
        type: 'notificationsSent'
      }), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications sent metrics: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch notifications sent metrics');
      }

      // Fix: API returns nested structure {data: {data: [array]}}
      const responseData = result.data?.data || result.data;
      const safeData = Array.isArray(responseData) ? responseData : [];
      setData(safeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications sent data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}