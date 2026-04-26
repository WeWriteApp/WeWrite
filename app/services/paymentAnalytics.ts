/**
 * Payment Analytics Service for WeWrite Admin Dashboard
 * 
 * Provides data fetching functions for payment-related analytics widgets
 * including subscription conversions, revenue metrics, and token allocation data.
 */

// Firebase imports removed - now using API endpoints
import {
  SubscriptionConversionFunnelData,
  SubscriptionMetrics,
  RevenueMetrics,
  TokenAllocationMetrics,
  PaymentAnalyticsData
} from '../types/database';
import { DateRange } from './adminAnalytics';
import { adminFetch } from '../utils/adminFetch';
import { format, eachDayOfInterval, eachHourOfInterval, startOfDay, endOfDay, startOfHour } from 'date-fns';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * Safely parse a date key back to a Date object for formatting
 */
function safeParseDateKey(dateKey: string, granularity: string, context: string = 'analytics'): Date {
  try {
    let date: Date;

    // Handle different date key formats more robustly
    if (granularity === 'hourly' || granularity === 'custom') {
      // Handle hourly format like "2025-06-25-14" or custom formats
      const parts = dateKey.split('-');
      if (parts.length === 4) {
        const [year, month, day, hour] = parts.map(part => parseInt(part, 10));

        // Validate the parsed numbers
        if (year >= 2020 && year <= 2030 &&
            month >= 1 && month <= 12 &&
            day >= 1 && day <= 31 &&
            hour >= 0 && hour <= 23) {
          date = new Date(year, month - 1, day, hour);
        } else {
          throw new Error(`Invalid date components: ${year}-${month}-${day}-${hour}`);
        }
      } else {
        // Try alternative parsing methods
        const isoString = dateKey.replace(/-(\d{1,2})$/, 'T$1:00:00.000Z');
        date = new Date(isoString);
      }
    } else {
      // For daily format like "2025-06-25"
      if (dateKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = new Date(dateKey + 'T00:00:00.000Z');
      } else {
        // Try parsing as-is for other formats
        date = new Date(dateKey);
      }
    }

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      // Only log warnings in development to reduce noise
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Invalid date key in ${context}: ${dateKey} (granularity: ${granularity})`);
      }
      return new Date();
    }

    return date;
  } catch (error) {
    // Only log warnings in development to reduce noise
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Error parsing date key in ${context}: ${dateKey}`, error);
    }
    return new Date(); // Fallback to current date
  }
}

function getCacheKey(method: string, dateRange: DateRange): string {
  const timeConfig = getTimeIntervals(dateRange);
  return `${method}_${format(dateRange.startDate, 'yyyy-MM-dd-HH')}_${format(dateRange.endDate, 'yyyy-MM-dd-HH')}_${timeConfig.granularity}`;
}

function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Helper function to determine granularity and generate time intervals
 */
function getTimeIntervals(dateRange: DateRange, customGranularity?: number) {
  const { startDate, endDate } = dateRange;
  const totalDuration = endDate.getTime() - startDate.getTime();

  // If custom granularity is specified, create that many equal intervals
  if (customGranularity && customGranularity > 0) {
    const intervalDuration = totalDuration / customGranularity;
    const intervals: Date[] = [];

    for (let i = 0; i < customGranularity; i++) {
      const intervalStart = new Date(startDate.getTime() + (i * intervalDuration));
      intervals.push(intervalStart);
    }

    return {
      intervals,
      granularity: 'custom' as const,
      customGranularity,
      intervalDuration,
      formatKey: (date: Date) => format(date, 'yyyy-MM-dd-HH'),
      formatLabel: (date: Date) => format(date, 'MMM d, HH:mm'),
      buckets: intervals.map(interval => format(interval, 'yyyy-MM-dd-HH'))
    };
  }

  // Auto-determine granularity based on date range
  const diffInHours = totalDuration / (1000 * 60 * 60);

  if (diffInHours <= 48) {
    // Use hourly intervals for ranges 48 hours or less
    const intervals = eachHourOfInterval({ start: startDate, end: endDate });
    return {
      intervals,
      granularity: 'hourly' as const,
      formatKey: (date: Date) => format(date, 'yyyy-MM-dd-HH'),
      formatLabel: (date: Date) => format(date, 'MMM d, HH:mm'),
      buckets: intervals.map(interval => format(interval, 'yyyy-MM-dd-HH'))
    };
  } else {
    // Use daily intervals for longer ranges
    const intervals = eachDayOfInterval({ start: startOfDay(startDate), end: endOfDay(endDate) });
    return {
      intervals,
      granularity: 'daily' as const,
      formatKey: (date: Date) => format(date, 'yyyy-MM-dd'),
      formatLabel: (date: Date) => format(date, 'MMM d'),
      buckets: intervals.map(interval => format(interval, 'yyyy-MM-dd'))
    };
  }
}

/**
 * Payment Analytics Service
 * Provides data fetching functions for payment analytics widgets with caching
 */
export class PaymentAnalyticsService {

  /**
   * Get subscription conversion funnel data (using server-side API)
   */
  static async getSubscriptionConversionFunnel(dateRange: DateRange): Promise<SubscriptionConversionFunnelData[]> {
    try {
      // Check cache first
      const cacheKey = getCacheKey('subscription-funnel', dateRange);
      const cachedData = getCachedData<SubscriptionConversionFunnelData[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }


      const response = await adminFetch('/api/admin/verify-subscription-funnel');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const counts = result?.data?.funnelEvents?.counts || {};

      const stageConfig = [
        {
          stage: 'subscription_flow_started',
          stageName: 'Started Checkout',
          description: 'Users who began the subscription flow'
        },
        {
          stage: 'subscription_completed',
          stageName: 'Completed Subscription',
          description: 'Users who finished checkout successfully'
        },
        {
          stage: 'first_token_allocation',
          stageName: 'First Allocation',
          description: 'Subscribers who made their first allocation'
        },
        {
          stage: 'ongoing_token_allocation',
          stageName: 'Ongoing Allocation',
          description: 'Subscribers continuing allocations over time'
        }
      ];

      const startedCount = Number(counts.subscription_flow_started || 0);
      const normalized = stageConfig.map((stage, index) => {
        const count = Number(counts[stage.stage] || 0);
        const previousCount = index === 0 ? startedCount : Number(counts[stageConfig[index - 1].stage] || 0);
        const conversionRate = startedCount > 0 ? (count / startedCount) * 100 : 0;
        const dropOffRate = index === 0 || previousCount <= 0 ? 0 : ((previousCount - count) / previousCount) * 100;

        return {
          stage: stage.stage,
          stageName: stage.stageName,
          count,
          conversionRate,
          dropOffRate,
          description: stage.description
        } as SubscriptionConversionFunnelData;
      });

      setCachedData(cacheKey, normalized);
      return normalized;

    } catch (error) {
      console.error('Error fetching subscription conversion funnel:', error);
      return [];
    }
  }

  /**
   * Get subscriptions created over time (using server-side API)
   */
  static async getSubscriptionsOverTime(dateRange: DateRange, granularity?: number): Promise<SubscriptionMetrics[]> {
    try {
      // Check cache first
      const cacheKey = getCacheKey('subscriptions-over-time', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<SubscriptionMetrics[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }


      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        type: 'subscriptions',
        granularity: granularity?.toString() || '50'
      });

      const response = await adminFetch(`/api/admin/dashboard-analytics?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const source = result.data?.data || result.data || [];
      const safeSource = Array.isArray(source) ? source : [];

      let cumulativeActive = 0;
      const normalized = safeSource.map((item: any) => {
        const subscriptionsCreated = Number(item.count || 0);
        cumulativeActive += subscriptionsCreated;

        return {
          date: item.date,
          subscriptionsCreated,
          subscriptionsCancelled: 0,
          netSubscriptions: subscriptionsCreated,
          cumulativeActive,
          label: item.label || item.date
        } as SubscriptionMetrics;
      });

      setCachedData(cacheKey, normalized);
      return normalized;

    } catch (error) {
      console.error('Error fetching subscriptions over time:', error);
      throw error; // Re-throw to let the UI handle the error
    }
  }

  /**
   * Get subscription revenue analysis (using server-side API)
   */
  static async getSubscriptionRevenue(dateRange: DateRange, granularity?: number): Promise<RevenueMetrics[]> {
    try {
      // Check cache first
      const cacheKey = getCacheKey('subscription-revenue', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<RevenueMetrics[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }


      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        type: 'revenue',
        granularity: granularity?.toString() || '50'
      });

      const response = await adminFetch(`/api/admin/dashboard-analytics?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const source = result.data?.data || result.data || [];
      const safeSource = Array.isArray(source) ? source : [];

      let cumulativeRevenue = 0;
      const normalized = safeSource.map((item: any) => {
        const activeRevenue = Number(item.count || 0);
        cumulativeRevenue += activeRevenue;

        return {
          date: item.date,
          activeRevenue,
          cancelledRevenue: 0,
          netRevenue: activeRevenue,
          cumulativeRevenue,
          averageRevenuePerUser: 0,
          churnRate: 0,
          label: item.label || item.date
        } as RevenueMetrics;
      });

      setCachedData(cacheKey, normalized);
      return normalized;

    } catch (error) {
      console.error('Error fetching subscription revenue:', error);
      throw error; // Re-throw to let the UI handle the error
    }
  }

  /**
   * Get token allocation percentage metrics (using server-side API)
   */
  static async getTokenAllocationMetrics(dateRange: DateRange, granularity?: number): Promise<TokenAllocationMetrics[]> {
    try {
      // Check cache first
      const cacheKey = getCacheKey('token-allocation-metrics', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<TokenAllocationMetrics[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }


      const response = await adminFetch('/api/admin/monthly-financials');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const totals = result?.totals || {};
      const currentMonth = result?.currentMonth?.data || {};
      const subscribers = Number(result?.stripeSubscriptions?.totalActiveSubscriptions || 0);
      const allocatedCents = Number(totals.totalAllocatedCents || currentMonth.totalAllocatedCents || 0);
      const subscriptionCents = Number(totals.totalSubscriptionCents || currentMonth.totalSubscriptionCents || 0);
      const label = currentMonth.month || 'Current';

      const normalized: TokenAllocationMetrics[] = [
        {
          date: label,
          totalSubscribers: subscribers,
          subscribersWithAllocations: subscribers,
          allocationPercentage: subscriptionCents > 0 ? (allocatedCents / subscriptionCents) * 100 : 0,
          averageAllocationPercentage: subscriptionCents > 0 ? (allocatedCents / subscriptionCents) * 100 : 0,
          totalTokensAllocated: allocatedCents,
          totalTokensAvailable: subscriptionCents,
          label
        }
      ];

      setCachedData(cacheKey, normalized);
      return normalized;

    } catch (error) {
      console.error('Error fetching token allocation metrics:', error);
      return [];
    }
  }

  /**
   * Get all payment analytics data
   */
  static async getAllPaymentAnalytics(dateRange: DateRange, granularity?: number): Promise<PaymentAnalyticsData> {
    try {

      const [
        conversionFunnel,
        subscriptionMetrics,
        revenueMetrics,
        tokenAllocationMetrics
      ] = await Promise.all([
        this.getSubscriptionConversionFunnel(dateRange),
        this.getSubscriptionsOverTime(dateRange, granularity),
        this.getSubscriptionRevenue(dateRange, granularity),
        this.getTokenAllocationMetrics(dateRange, granularity)
      ]);


      return {
        conversionFunnel,
        subscriptionMetrics,
        revenueMetrics,
        tokenAllocationMetrics
      };
    } catch (error) {
      console.error('❌ [Payment Analytics] Error fetching payment analytics:', error);
      return {
        conversionFunnel: [],
        subscriptionMetrics: [],
        revenueMetrics: [],
        tokenAllocationMetrics: []
      };
    }
  }
}