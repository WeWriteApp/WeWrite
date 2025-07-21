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
import { DateRange } from './dashboardAnalytics';
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

      console.log('🔄 [Payment Analytics] Fetching subscription conversion funnel data via API...');

      // Build query parameters
      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        type: 'conversion-funnel'
      });

      // Fetch from server-side API
      const response = await fetch(`/api/admin/payment-analytics?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      console.log(`✅ [Payment Analytics] Subscription conversion funnel data fetched: ${result.length} stages`);

      // Cache the result
      setCachedData(cacheKey, result);

      return result;

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

      console.log('🔄 [Payment Analytics] Fetching subscriptions over time data via API...');

      // Build query parameters
      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        type: 'subscriptions'
      });

      if (granularity) {
        params.append('granularity', granularity.toString());
      }

      // Fetch from server-side API
      const response = await fetch(`/api/admin/payment-analytics?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      console.log(`✅ [Payment Analytics] Subscriptions over time data fetched: ${result.length} data points`);

      // Cache the result
      setCachedData(cacheKey, result);

      return result;

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

      console.log('🔄 [Payment Analytics] Fetching subscription revenue data via API...');

      // Build query parameters
      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        type: 'revenue'
      });

      if (granularity) {
        params.append('granularity', granularity.toString());
      }

      // Fetch from server-side API
      const response = await fetch(`/api/admin/payment-analytics?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      console.log(`✅ [Payment Analytics] Subscription revenue data fetched: ${result.length} data points`);

      // Cache the result
      setCachedData(cacheKey, result);

      return result;

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

      console.log('🔄 [Payment Analytics] Fetching token allocation metrics via API...');

      // Build query parameters
      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        type: 'token-allocation'
      });

      if (granularity) {
        params.append('granularity', granularity.toString());
      }

      // Fetch from server-side API
      const response = await fetch(`/api/admin/payment-analytics?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      console.log(`✅ [Payment Analytics] Token allocation metrics data fetched: ${result.length} data points`);

      // Cache the result
      setCachedData(cacheKey, result);

      return result;

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
      console.log('🔄 [Payment Analytics] Fetching all payment analytics data...');

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

      console.log('✅ [Payment Analytics] All payment analytics fetched successfully');

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