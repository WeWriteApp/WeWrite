/**
 * Platform Fee Analytics Service
 * Efficient, cached analytics for WeWrite platform fee revenue
 * Supports all granularity settings and time ranges
 */

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { 
  format, 
  startOfHour, 
  startOfDay, 
  startOfWeek, 
  startOfMonth,
  eachHourOfInterval,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval
} from 'date-fns';
import { db } from '../firebase/config';
import { getCollectionName, COLLECTIONS } from '../utils/environmentConfig';
import { PLATFORM_FEE_CONFIG } from '../config/platformFee';
// Temporarily disable caching for server-side usage
// import { getCacheItem, setCacheItem } from '../utils/cacheUtils';

// Server-side cache key generation (avoiding client-side generateCacheKey)
function createCacheKey(prefix: string, identifier: string): string {
  return `wewrite_${prefix}_${identifier}`;
}

export interface PlatformFeeDataPoint {
  date: string;
  revenue: number;
  payouts: number;
  averageFee: number;
  label: string;
}

export interface PlatformFeeStats {
  totalRevenue: number;
  monthlyRevenue: number;
  growth: number;
  averageFeePerPayout: number;
  totalPayouts: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

type GranularityType = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface TimeConfig {
  intervals: Date[];
  formatKey: (date: Date) => string;
  formatLabel: (date: Date) => string;
  granularity: GranularityType;
}

/**
 * Intelligent granularity selection based on date range and user preference
 */
function getOptimalGranularity(dateRange: DateRange, userGranularity?: number): TimeConfig {
  const { startDate, endDate } = dateRange;
  const diffInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const diffInHours = diffInDays * 24;

  // User granularity affects the automatic selection
  const granularityFactor = userGranularity ? userGranularity / 50 : 1; // 50 is default

  // Determine optimal granularity based on time range and user preference
  let granularity: GranularityType;
  let intervals: Date[];
  let formatKey: (date: Date) => string;
  let formatLabel: (date: Date) => string;

  if (diffInHours <= 48 * granularityFactor) {
    // Hourly for very short ranges
    granularity = 'hourly';
    intervals = eachHourOfInterval({ start: startDate, end: endDate });
    formatKey = (date: Date) => format(date, 'yyyy-MM-dd-HH');
    formatLabel = (date: Date) => format(date, 'MMM dd HH:mm');
  } else if (diffInDays <= 90 * granularityFactor) {
    // Daily for short to medium ranges
    granularity = 'daily';
    intervals = eachDayOfInterval({ start: startDate, end: endDate });
    formatKey = (date: Date) => format(date, 'yyyy-MM-dd');
    formatLabel = (date: Date) => format(date, 'MMM dd');
  } else if (diffInDays <= 365 * granularityFactor) {
    // Weekly for medium to long ranges
    granularity = 'weekly';
    intervals = eachWeekOfInterval({ start: startDate, end: endDate });
    formatKey = (date: Date) => format(date, 'yyyy-MM-dd');
    formatLabel = (date: Date) => format(date, 'MMM dd');
  } else {
    // Monthly for very long ranges
    granularity = 'monthly';
    intervals = eachMonthOfInterval({ start: startDate, end: endDate });
    formatKey = (date: Date) => format(date, 'yyyy-MM');
    formatLabel = (date: Date) => format(date, 'MMM yyyy');
  }

  return { intervals, formatKey, formatLabel, granularity };
}

/**
 * Round date to appropriate interval based on granularity
 */
function roundToInterval(date: Date, granularity: GranularityType): Date {
  switch (granularity) {
    case 'hourly':
      return startOfHour(date);
    case 'daily':
      return startOfDay(date);
    case 'weekly':
      return startOfWeek(date);
    case 'monthly':
      return startOfMonth(date);
    default:
      return startOfDay(date);
  }
}

/**
 * Get platform fee revenue analytics with intelligent caching and granularity
 */
export async function getPlatformFeeAnalytics(
  dateRange: DateRange, 
  granularity?: number
): Promise<PlatformFeeDataPoint[]> {
  try {
    // Generate cache key including granularity
    const cacheKey = createCacheKey('platform-fees', `${dateRange.startDate.toISOString()}_${dateRange.endDate.toISOString()}`) + (granularity ? `-g${granularity}` : '');

    // Temporarily disable caching for server-side usage
    // const cachedData = getCacheItem<PlatformFeeDataPoint[]>(cacheKey);
    // if (cachedData) {
    //   console.log('📦 [Platform Fee Analytics] Returning cached data:', cachedData.length, 'points');
    //   return cachedData;
    // }

    const { startDate, endDate } = dateRange;
    const timeConfig = getOptimalGranularity(dateRange, granularity);


    // Initialize data map with all intervals
    const dataMap = new Map<string, { revenue: number; payouts: number }>();
    timeConfig.intervals.forEach(interval => {
      const dateKey = timeConfig.formatKey(interval);
      dataMap.set(dateKey, { revenue: 0, payouts: 0 });
    });

    // Query completed payouts in date range
    const payoutsRef = collection(db, getCollectionName(COLLECTIONS.TOKEN_PAYOUTS));
    const q = query(
      payoutsRef,
      where('status', '==', 'completed'),
      where('completedAt', '>=', Timestamp.fromDate(startDate)),
      where('completedAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('completedAt', 'asc'),
      limit(2000) // Reasonable limit for performance
    );

    const snapshot = await getDocs(q);

    // Process payouts and calculate platform fees
    snapshot.forEach(doc => {
      const payout = doc.data();
      const completedAt = payout.completedAt;
      const payoutAmount = payout.amount || 0;

      if (completedAt && payoutAmount > 0) {
        const date = completedAt instanceof Timestamp ? completedAt.toDate() : new Date(completedAt);

        // Round to appropriate interval
        const intervalDate = roundToInterval(date, timeConfig.granularity);
        const dateKey = timeConfig.formatKey(intervalDate);

        // Calculate platform fee correctly:
        // The payout amount is the net amount after platform fee (10%) and Stripe fees
        // To find the gross amount: gross = net / (1 - platform_fee_rate - stripe_fee_rate)
        const estimatedStripeFeeRate = 0.005; // 0.5% estimate for standard payouts
        const platformFeeRate = PLATFORM_FEE_CONFIG.PERCENTAGE; // 10%
        const totalFeeRate = platformFeeRate + estimatedStripeFeeRate;

        // Calculate gross amount from net payout
        const grossAmount = payoutAmount / (1 - totalFeeRate);

        // Platform fee is 10% of gross amount
        const platformFee = grossAmount * platformFeeRate;

        const current = dataMap.get(dateKey);
        if (current) {
          dataMap.set(dateKey, {
            revenue: current.revenue + platformFee,
            payouts: current.payouts + 1
          });
        }
      }
    });

    // Convert to chart data format
    const result = Array.from(dataMap.entries()).map(([dateKey, data]) => {
      // Parse date for label formatting
      const date = timeConfig.granularity === 'hourly'
        ? new Date(dateKey.replace(/-(\d{2})$/, ':$1:00'))
        : new Date(dateKey);

      return {
        date: dateKey,
        revenue: Math.round(data.revenue * 100) / 100, // Round to 2 decimal places
        payouts: data.payouts,
        averageFee: data.payouts > 0 ? Math.round((data.revenue / data.payouts) * 100) / 100 : 0,
        label: timeConfig.formatLabel(date)
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    // Temporarily disable caching for server-side usage
    // setCacheItem(cacheKey, result, 30 * 60 * 1000);

    return result;

  } catch (error) {
    console.error('❌ [Platform Fee Analytics] Error:', error);
    return [];
  }
}

/**
 * Get platform fee statistics
 */
export async function getPlatformFeeStats(dateRange: DateRange): Promise<PlatformFeeStats> {
  try {
    const cacheKey = createCacheKey('platform-fee-stats', `${dateRange.startDate.toISOString()}_${dateRange.endDate.toISOString()}`);
    // Temporarily disable caching for server-side usage
    // const cachedStats = getCacheItem<PlatformFeeStats>(cacheKey);
    // if (cachedStats) {
    //   return cachedStats;
    // }

    // Get all-time data for total revenue
    const allTimeData = await getPlatformFeeAnalytics({
      startDate: new Date('2020-01-01'),
      endDate: new Date()
    });

    // Get current month data
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthData = await getPlatformFeeAnalytics({
      startDate: currentMonthStart,
      endDate: now
    });

    // Get previous month data for growth calculation
    const previousMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const previousMonthEnd = new Date(currentMonthStart.getTime() - 1);
    const previousMonthData = await getPlatformFeeAnalytics({
      startDate: previousMonthStart,
      endDate: previousMonthEnd
    });

    const totalRevenue = allTimeData.reduce((sum, item) => sum + item.revenue, 0);
    const totalPayouts = allTimeData.reduce((sum, item) => sum + item.payouts, 0);
    const monthlyRevenue = currentMonthData.reduce((sum, item) => sum + item.revenue, 0);
    const previousMonthRevenue = previousMonthData.reduce((sum, item) => sum + item.revenue, 0);

    const growth = previousMonthRevenue > 0 
      ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : 0;

    const stats: PlatformFeeStats = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      growth: Math.round(growth * 10) / 10,
      averageFeePerPayout: totalPayouts > 0 ? Math.round((totalRevenue / totalPayouts) * 100) / 100 : 0,
      totalPayouts
    };

    // Temporarily disable caching for server-side usage
    // setCacheItem(cacheKey, stats, 15 * 60 * 1000);
    return stats;

  } catch (error) {
    console.error('❌ [Platform Fee Stats] Error:', error);
    return {
      totalRevenue: 0,
      monthlyRevenue: 0,
      growth: 0,
      averageFeePerPayout: 0,
      totalPayouts: 0
    };
  }
}
