/**
 * Payment Analytics Service for WeWrite Admin Dashboard
 * 
 * Provides data fetching functions for payment-related analytics widgets
 * including subscription conversions, revenue metrics, and token allocation data.
 */

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
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
   * Get subscription conversion funnel data
   */
  static async getSubscriptionConversionFunnel(dateRange: DateRange): Promise<SubscriptionConversionFunnelData[]> {
    try {
      // Check cache first
      const cacheKey = getCacheKey('subscription-funnel', dateRange);
      const cachedData = getCachedData<SubscriptionConversionFunnelData[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      console.log('🔄 [Payment Analytics] Fetching subscription conversion funnel data...');

      // Get analytics events for the funnel stages
      const analyticsQuery = query(
        collection(db, 'analytics_events'),
        where('timestamp', '>=', Timestamp.fromDate(dateRange.startDate)),
        where('timestamp', '<=', Timestamp.fromDate(dateRange.endDate)),
        where('category', '==', 'subscription'),
        where('action', 'in', [
          'subscription_flow_started',
          'subscription_abandoned_before_payment',
          'subscription_abandoned_during_payment',
          'subscription_completed',
          'first_token_allocation',
          'ongoing_token_allocation'
        ]),
        orderBy('timestamp', 'asc')
      );

      const analyticsSnapshot = await getDocs(analyticsQuery);
      const events = analyticsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Count events by stage
      const stageCounts = {
        initiated: events.filter(e => e.action === 'subscription_flow_started').length,
        abandoned_before_stripe: events.filter(e => e.action === 'subscription_abandoned_before_payment').length,
        abandoned_during_stripe: events.filter(e => e.action === 'subscription_abandoned_during_payment').length,
        completed: events.filter(e => e.action === 'subscription_completed').length,
        first_allocation: events.filter(e => e.action === 'first_token_allocation').length,
        ongoing_allocations: events.filter(e => e.action === 'ongoing_token_allocation').length
      };

      // Calculate conversion rates and drop-offs
      const totalInitiated = stageCounts.initiated || 1; // Avoid division by zero
      
      const funnelData: SubscriptionConversionFunnelData[] = [
        {
          stage: 'initiated',
          stageName: 'Subscription Flow Initiated',
          count: stageCounts.initiated,
          conversionRate: 100,
          dropOffRate: 0,
          description: 'Users who clicked subscribe'
        },
        {
          stage: 'abandoned_before_stripe',
          stageName: 'Abandoned Before Stripe',
          count: stageCounts.abandoned_before_stripe,
          conversionRate: ((totalInitiated - stageCounts.abandoned_before_stripe) / totalInitiated) * 100,
          dropOffRate: (stageCounts.abandoned_before_stripe / totalInitiated) * 100,
          description: 'Users who left before payment'
        },
        {
          stage: 'abandoned_during_stripe',
          stageName: 'Abandoned During Stripe',
          count: stageCounts.abandoned_during_stripe,
          conversionRate: ((totalInitiated - stageCounts.abandoned_before_stripe - stageCounts.abandoned_during_stripe) / totalInitiated) * 100,
          dropOffRate: (stageCounts.abandoned_during_stripe / totalInitiated) * 100,
          description: 'Users who started but didn\'t complete payment'
        },
        {
          stage: 'completed',
          stageName: 'Subscription Activated',
          count: stageCounts.completed,
          conversionRate: (stageCounts.completed / totalInitiated) * 100,
          dropOffRate: ((totalInitiated - stageCounts.completed) / totalInitiated) * 100,
          description: 'Completed payments via Stripe'
        },
        {
          stage: 'first_allocation',
          stageName: 'First Token Allocation',
          count: stageCounts.first_allocation,
          conversionRate: stageCounts.completed > 0 ? (stageCounts.first_allocation / stageCounts.completed) * 100 : 0,
          dropOffRate: stageCounts.completed > 0 ? ((stageCounts.completed - stageCounts.first_allocation) / stageCounts.completed) * 100 : 0,
          description: 'Users who allocated tokens to pages'
        },
        {
          stage: 'ongoing_allocations',
          stageName: 'Ongoing Allocations',
          count: stageCounts.ongoing_allocations,
          conversionRate: stageCounts.first_allocation > 0 ? (stageCounts.ongoing_allocations / stageCounts.first_allocation) * 100 : 0,
          dropOffRate: stageCounts.first_allocation > 0 ? ((stageCounts.first_allocation - stageCounts.ongoing_allocations) / stageCounts.first_allocation) * 100 : 0,
          description: 'Users who continue allocating monthly'
        }
      ];

      console.log('📊 [Payment Analytics] Conversion funnel data:', {
        totalStages: funnelData.length,
        totalInitiated: stageCounts.initiated,
        completionRate: funnelData[3]?.conversionRate || 0
      });

      // Cache the result
      setCachedData(cacheKey, funnelData);
      return funnelData;

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
   * Get token allocation percentage metrics
   */
  static async getTokenAllocationMetrics(dateRange: DateRange, granularity?: number): Promise<TokenAllocationMetrics[]> {
    try {
      // Check cache first
      const cacheKey = getCacheKey('token-allocation-metrics', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<TokenAllocationMetrics[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      console.log('🔄 [Payment Analytics] Fetching token allocation metrics...');

      // Get time configuration for bucketing
      const timeConfig = getTimeIntervals(dateRange, granularity);

      // Query token balances and allocations
      const tokenBalancesQuery = query(
        collection(db, 'tokenBalances'),
        where('lastAllocationDate', '>=', dateRange.startDate.toISOString()),
        where('lastAllocationDate', '<=', dateRange.endDate.toISOString())
      );

      const tokenAllocationsQuery = query(
        collection(db, 'tokenAllocations'),
        where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate)),
        where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate)),
        orderBy('createdAt', 'asc')
      );

      const [balancesSnapshot, allocationsSnapshot] = await Promise.all([
        getDocs(tokenBalancesQuery),
        getDocs(tokenAllocationsQuery)
      ]);

      const balances = balancesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const allocations = allocationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Create date buckets for allocation tracking
      const dateMap = new Map<string, {
        totalSubscribers: Set<string>;
        subscribersWithAllocations: Set<string>;
        totalTokensAllocated: number;
        totalTokensAvailable: number;
      }>();

      // Initialize all time buckets
      for (const bucket of timeConfig.buckets) {
        dateMap.set(bucket, {
          totalSubscribers: new Set(),
          subscribersWithAllocations: new Set(),
          totalTokensAllocated: 0,
          totalTokensAvailable: 0
        });
      }

      // Process token balances by date bucket
      balances.forEach(balance => {
        // Safely parse the date, skip if invalid
        if (!balance.lastAllocationDate) return;

        let balanceDate: Date;
        try {
          balanceDate = new Date(balance.lastAllocationDate);
          // Check if the date is valid
          if (isNaN(balanceDate.getTime())) return;
        } catch (error) {
          console.warn('Invalid date in token balance:', balance.lastAllocationDate);
          return;
        }

        const dateKey = timeConfig.formatKey(balanceDate);

        if (dateMap.has(dateKey)) {
          const current = dateMap.get(dateKey)!;
          current.totalSubscribers.add(balance.userId);
          current.totalTokensAvailable += balance.totalTokens || 0;
        }
      });

      // Process token allocations by date bucket
      allocations.forEach(allocation => {
        const allocationDate = allocation.createdAt?.toDate() || new Date();
        const dateKey = timeConfig.formatKey(allocationDate);

        if (dateMap.has(dateKey)) {
          const current = dateMap.get(dateKey)!;
          current.subscribersWithAllocations.add(allocation.userId);
          current.totalTokensAllocated += allocation.tokens || 0;
        }
      });

      // Convert to chart data format
      const result = Array.from(dateMap.entries()).map(([dateKey, metrics]) => {
        const totalSubscribers = metrics.totalSubscribers.size;
        const subscribersWithAllocations = metrics.subscribersWithAllocations.size;
        const allocationPercentage = totalSubscribers > 0 ? (subscribersWithAllocations / totalSubscribers) * 100 : 0;
        const averageAllocationPercentage = metrics.totalTokensAvailable > 0 ? (metrics.totalTokensAllocated / metrics.totalTokensAvailable) * 100 : 0;

        // Parse the date key back to a Date object for formatting
        const date = safeParseDateKey(dateKey, timeConfig.granularity, 'token allocation metrics');

        // Safely format the label
        let label: string;
        try {
          label = timeConfig.formatLabel(date);
        } catch (error) {
          console.warn('Error formatting date label in token allocation metrics:', dateKey, error);
          label = dateKey; // Fallback to the raw date key
        }

        return {
          date: dateKey,
          totalSubscribers,
          subscribersWithAllocations,
          allocationPercentage,
          averageAllocationPercentage,
          totalTokensAllocated: metrics.totalTokensAllocated,
          totalTokensAvailable: metrics.totalTokensAvailable,
          label
        };
      });

      console.log('📊 [Payment Analytics] Token allocation metrics result:', {
        totalIntervals: result.length,
        totalTokensAllocated: result.reduce((sum, item) => sum + item.totalTokensAllocated, 0),
        averageAllocationRate: result.reduce((sum, item) => sum + item.allocationPercentage, 0) / result.length
      });

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