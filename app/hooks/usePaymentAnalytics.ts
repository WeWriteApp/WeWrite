/**
 * Payment Analytics Hooks for WeWrite Admin Dashboard
 * 
 * Custom hooks for fetching payment analytics data with proper debouncing,
 * error handling, and loading states following existing patterns.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { PaymentAnalyticsService } from '../services/paymentAnalytics';
import { adminFetch } from '../utils/adminFetch';
import {
  SubscriptionConversionFunnelData,
  SubscriptionMetrics,
  RevenueMetrics,
  TokenAllocationMetrics,
  PaymentAnalyticsData
} from '../types/database';
// Define DateRange type locally to avoid importing Firebase Admin SDK
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

function normalizeGranularityAndCumulative(
  granularityOrCumulative?: number | boolean,
  cumulativeArg?: boolean
): { granularity?: number; cumulative: boolean } {
  if (typeof granularityOrCumulative === 'boolean') {
    return { granularity: undefined, cumulative: granularityOrCumulative };
  }

  return {
    granularity: typeof granularityOrCumulative === 'number' ? granularityOrCumulative : undefined,
    cumulative: cumulativeArg ?? false
  };
}

/**
 * Hook for subscription conversion funnel data
 */
export function useSubscriptionConversionFunnel(dateRange: DateRange) {
  const [data, setData] = useState<SubscriptionConversionFunnelData[]>([]);
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
      const result = await PaymentAnalyticsService.getSubscriptionConversionFunnel(debouncedDateRange);
      setData(result);
    } catch (err) {
      console.error('Error fetching subscription conversion funnel:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch conversion funnel data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for subscriptions over time metrics
 */
export function useSubscriptionsOverTime(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<SubscriptionMetrics[]>([]);
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
      const result = await PaymentAnalyticsService.getSubscriptionsOverTime(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching subscriptions over time:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscriptions data');
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
 * Hook for subscription revenue metrics
 */
export function useSubscriptionRevenue(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<RevenueMetrics[]>([]);
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
      const result = await PaymentAnalyticsService.getSubscriptionRevenue(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching subscription revenue:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch revenue data');
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
 * Hook for token allocation metrics
 */
export function useTokenAllocationMetrics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<TokenAllocationMetrics[]>([]);
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
      const result = await PaymentAnalyticsService.getTokenAllocationMetrics(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching token allocation metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch token allocation data');
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
 * Hook for all payment analytics data
 */
export function useAllPaymentAnalytics(dateRange: DateRange, granularity?: number) {
  const [data, setData] = useState<PaymentAnalyticsData>({
    conversionFunnel: [],
    subscriptionMetrics: [],
    revenueMetrics: [],
    usdAllocationMetrics: [],
    tokenAllocationMetrics: [] // Legacy support
  });
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
      const result = await PaymentAnalyticsService.getAllPaymentAnalytics(debouncedDateRange, granularity);
      setData(result);
    } catch (err) {
      console.error('Error fetching all payment analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch payment analytics data');
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
 * Hook for subscription summary statistics
 */
export function useSubscriptionSummaryStats(dateRange: DateRange) {
  const [stats, setStats] = useState({
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    cancelledSubscriptions: 0,
    totalRevenue: 0,
    averageRevenuePerUser: 0,
    churnRate: 0,
    conversionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all payment analytics to calculate summary stats
      const analytics = await PaymentAnalyticsService.getAllPaymentAnalytics(debouncedDateRange);
      
      // Calculate summary statistics
      const totalSubscriptions = analytics.subscriptionMetrics.reduce((sum, item) => sum + item.subscriptionsCreated, 0);
      const cancelledSubscriptions = analytics.subscriptionMetrics.reduce((sum, item) => sum + item.subscriptionsCancelled, 0);
      const activeSubscriptions = totalSubscriptions - cancelledSubscriptions;
      const totalRevenue = analytics.revenueMetrics.reduce((sum, item) => sum + item.activeRevenue, 0);
      const averageRevenuePerUser = totalSubscriptions > 0 ? totalRevenue / totalSubscriptions : 0;
      const churnRate = totalSubscriptions > 0 ? (cancelledSubscriptions / totalSubscriptions) * 100 : 0;
      
      // Get conversion rate from funnel data
      const conversionFunnel = analytics.conversionFunnel;
      const conversionRate = conversionFunnel.length > 3 ? conversionFunnel[3].conversionRate : 0;

      setStats({
        totalSubscriptions,
        activeSubscriptions,
        cancelledSubscriptions,
        totalRevenue,
        averageRevenuePerUser,
        churnRate,
        conversionRate
      });
    } catch (err) {
      console.error('Error fetching subscription summary stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch summary statistics');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, loading, error, refetch: fetchData };
}

/**
 * Hook for token allocation summary statistics
 */
export function useTokenAllocationSummaryStats(dateRange: DateRange) {
  const [stats, setStats] = useState({
    totalSubscribers: 0,
    subscribersWithAllocations: 0,
    allocationRate: 0,
    totalTokensAllocated: 0,
    totalTokensAvailable: 0,
    allocationPercentage: 0
  });
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

      const tokenMetrics = await PaymentAnalyticsService.getTokenAllocationMetrics(debouncedDateRange);
      
      // Calculate summary statistics
      const totalSubscribers = tokenMetrics.reduce((max, item) => Math.max(max, item.totalSubscribers), 0);
      const subscribersWithAllocations = tokenMetrics.reduce((max, item) => Math.max(max, item.subscribersWithAllocations), 0);
      const allocationRate = totalSubscribers > 0 ? (subscribersWithAllocations / totalSubscribers) * 100 : 0;
      const totalTokensAllocated = tokenMetrics.reduce((sum, item) => sum + item.totalTokensAllocated, 0);
      const totalTokensAvailable = tokenMetrics.reduce((sum, item) => sum + item.totalTokensAvailable, 0);
      const allocationPercentage = totalTokensAvailable > 0 ? (totalTokensAllocated / totalTokensAvailable) * 100 : 0;

      setStats({
        totalSubscribers,
        subscribersWithAllocations,
        allocationRate,
        totalTokensAllocated,
        totalTokensAvailable,
        allocationPercentage
      });
    } catch (err) {
      console.error('Error fetching token allocation summary stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch token allocation statistics');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, loading, error, refetch: fetchData };
}

/**
 * Hook for platform fee metrics
 * @deprecated Use usePlatformFeeMetrics from useDashboardAnalytics instead
 * This is kept for backward compatibility and re-exports the same hook
 */
export { usePlatformFeeMetrics } from './useDashboardAnalytics';

/**
 * Hook for writer payouts metrics
 */
export function useWriterPayouts(dateRange: DateRange, cumulative: boolean = false) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        cumulative: cumulative.toString()
      });

      const [summaryResponse, chartResponse] = await Promise.all([
        adminFetch(`/api/admin/writer-payouts?${params.toString()}`),
        adminFetch(`/api/admin/payout-analytics?${params.toString()}`)
      ]);

      if (!summaryResponse.ok) {
        throw new Error(`Failed to fetch writer payouts: ${summaryResponse.status}`);
      }

      if (!chartResponse.ok) {
        throw new Error(`Failed to fetch payout chart data: ${chartResponse.status}`);
      }

      const [summaryResult, chartResult] = await Promise.all([
        summaryResponse.json(),
        chartResponse.json()
      ]);

      setData({
        ...(summaryResult.data || {}),
        chartData: chartResult.data || []
      });
    } catch (err) {
      console.error('Error fetching writer payouts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch writer payouts data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, cumulative]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for USD allocations metrics
 */
export function useUsdAllocations(dateRange: DateRange, granularity?: number, cumulative: boolean = false) {
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalAllocated: 0,
    totalPageAllocations: 0,
    totalUserAllocations: 0,
    totalUnallocated: 0,
    activeAllocators: 0,
    allocationRate: 0,
    averageAllocation: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await adminFetch('/api/admin/monthly-financials');

      if (!response.ok) {
        throw new Error(`Failed to fetch USD allocations: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch USD allocations data');
      }

      const historical = Array.isArray(result.historicalData) ? result.historicalData : [];
      const currentMonthRecord = result.currentMonth?.data;

      const monthlyData = [...historical];
      if (currentMonthRecord && !monthlyData.some((item: any) => item.month === currentMonthRecord.month)) {
        monthlyData.push(currentMonthRecord);
      }

      monthlyData.sort((a: any, b: any) => String(a.month || '').localeCompare(String(b.month || '')));

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedData = monthlyData.map((item: any) => {
        const monthKey = String(item.month || '');
        const [year, month] = monthKey.split('-');
        const monthIndex = Number(month) - 1;
        const label = Number.isFinite(monthIndex) && monthIndex >= 0 && monthIndex < 12
          ? `${monthNames[monthIndex]} '${String(year || '').slice(-2)}`
          : monthKey;

        return {
          label,
          totalAllocated: (item.totalAllocatedCents || 0) / 100,
          pageAllocations: (item.totalAllocatedCents || 0) / 100,
          userAllocations: 0,
          totalUnallocated: (item.totalUnallocatedCents || 0) / 100,
        };
      });

      const chartData = cumulative
        ? formattedData.reduce((acc: any[], item: any) => {
            const previous = acc[acc.length - 1];
            acc.push({
              ...item,
              totalAllocated: item.totalAllocated + (previous?.totalAllocated || 0),
              pageAllocations: item.pageAllocations + (previous?.pageAllocations || 0),
              userAllocations: item.userAllocations + (previous?.userAllocations || 0),
              totalUnallocated: item.totalUnallocated + (previous?.totalUnallocated || 0),
            });
            return acc;
          }, [])
        : formattedData;

      setData(chartData);

      const totals = result.totals || {};
      const totalAllocated = (totals.totalAllocatedCents || 0) / 100;
      const totalUnallocated = (totals.totalUnallocatedCents || 0) / 100;
      const activeAllocators = result.stripeSubscriptions?.totalActiveSubscriptions || 0;

      setStats({
        totalAllocated,
        totalPageAllocations: totalAllocated,
        totalUserAllocations: 0,
        totalUnallocated,
        activeAllocators,
        allocationRate: totals.averageAllocationRate || 0,
        averageAllocation: activeAllocators > 0 ? totalAllocated / activeAllocators : 0
      });
    } catch (err) {
      console.error('Error fetching USD allocations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch USD allocations data');
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
 * Hook for writer earnings metrics
 */
export function useWriterEarnings(dateRange: DateRange, cumulative: boolean = false) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        cumulative: cumulative.toString()
      });

      const response = await adminFetch(`/api/admin/writer-earnings?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch writer earnings: ${response.status}`);
      }

      const result = await response.json();
      setData(result.data || result);
    } catch (err) {
      console.error('Error fetching writer earnings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch writer earnings data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, cumulative]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for payout analytics with time-series data
 */
export function usePayoutAnalytics(
  dateRange: DateRange,
  granularityOrCumulative?: number | boolean,
  cumulativeArg?: boolean
) {
  const { granularity, cumulative } = normalizeGranularityAndCumulative(granularityOrCumulative, cumulativeArg);
  const [data, setData] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    // Early return if dateRange is not properly initialized
    // This prevents fetch errors during initial hydration
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        cumulative: cumulative.toString()
      });

      if (typeof granularity === 'number' && Number.isFinite(granularity) && granularity > 0) {
        params.set('granularity', Math.floor(granularity).toString());
      }

      const response = await adminFetch(`/api/admin/payout-analytics?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch payout analytics: ${response.status}`);
      }

      const result = await response.json();
      setData(result.data || []);
      setMetadata(result.metadata || null);
    } catch (err) {
      console.error('Error fetching payout analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch payout analytics data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, cumulative, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, metadata, loading, error, refetch: fetchData };
}

/**
 * Hook for writer pending earnings (status = 'pending')
 * Shows current month allocations that haven't been finalized yet
 */
export function useWriterPendingEarnings(
  dateRange: DateRange,
  granularityOrCumulative?: number | boolean,
  cumulativeArg?: boolean
) {
  const { granularity, cumulative } = normalizeGranularityAndCumulative(granularityOrCumulative, cumulativeArg);
  const [data, setData] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        cumulative: cumulative.toString(),
        status: 'pending'
      });

      if (typeof granularity === 'number' && Number.isFinite(granularity) && granularity > 0) {
        params.set('granularity', Math.floor(granularity).toString());
      }

      const response = await adminFetch(`/api/admin/earnings-analytics?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch pending earnings: ${response.status}`);
      }

      const result = await response.json();
      setData(result.data || []);
      setMetadata(result.metadata || null);
    } catch (err) {
      console.error('Error fetching pending earnings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pending earnings data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, cumulative, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, metadata, loading, error, refetch: fetchData };
}

/**
 * Hook for writer final earnings (status = 'available' or 'paid_out')
 * Shows earnings that have been finalized after allocation freeze
 */
export function useWriterFinalEarnings(
  dateRange: DateRange,
  granularityOrCumulative?: number | boolean,
  cumulativeArg?: boolean
) {
  const { granularity, cumulative } = normalizeGranularityAndCumulative(granularityOrCumulative, cumulativeArg);
  const [data, setData] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce date range changes
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchData = useCallback(async () => {
    if (!debouncedDateRange || !debouncedDateRange.startDate || !debouncedDateRange.endDate ||
        !(debouncedDateRange.startDate instanceof Date) || !(debouncedDateRange.endDate instanceof Date) ||
        isNaN(debouncedDateRange.startDate.getTime()) || isNaN(debouncedDateRange.endDate.getTime())) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate: debouncedDateRange.startDate.toISOString(),
        endDate: debouncedDateRange.endDate.toISOString(),
        cumulative: cumulative.toString(),
        status: 'final'
      });

      if (typeof granularity === 'number' && Number.isFinite(granularity) && granularity > 0) {
        params.set('granularity', Math.floor(granularity).toString());
      }

      const response = await adminFetch(`/api/admin/earnings-analytics?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch final earnings: ${response.status}`);
      }

      const result = await response.json();
      setData(result.data || []);
      setMetadata(result.metadata || null);
    } catch (err) {
      console.error('Error fetching final earnings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch final earnings data');
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, cumulative, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, metadata, loading, error, refetch: fetchData };
}