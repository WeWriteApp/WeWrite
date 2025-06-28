import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  limit,
  type QuerySnapshot,
  type DocumentData
} from 'firebase/firestore';
import { db } from '../firebase/database/core';
import { format, eachDayOfInterval, eachHourOfInterval, startOfDay, endOfDay, startOfHour } from 'date-fns';
import { AnalyticsAggregationService } from './analyticsAggregation';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

// Query throttling configuration
const QUERY_THROTTLE_MS = 100; // Minimum time between queries
let lastQueryTime = 0;

// Query throttling helper
const throttleQuery = async () => {
  const now = Date.now();
  const timeSinceLastQuery = now - lastQueryTime;

  if (timeSinceLastQuery < QUERY_THROTTLE_MS) {
    const waitTime = QUERY_THROTTLE_MS - timeSinceLastQuery;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastQueryTime = Date.now();
};

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface DashboardMetrics {
  newAccountsCreated: ChartDataPoint[];
  newPagesCreated: PagesDataPoint[];
  sharesAnalytics: SharesDataPoint[];
  editsAnalytics: EditsDataPoint[];
  contentChangesAnalytics: ContentChangesDataPoint[];
  pwaInstallsAnalytics: PWAInstallsDataPoint[];
}

export interface ChartDataPoint {
  date: string;
  count: number;
  label: string; // Human readable date
}

export interface PagesDataPoint {
  date: string;
  publicPages: number;
  privatePages: number;
  totalPages: number;
  label: string; // Human readable date
}

export interface CompositePagesDataPoint {
  date: string;
  pagesCreated: number;
  pagesDeleted: number;
  publicPagesCreated: number;
  privatePagesCreated: number;
  netChange: number;
  label: string; // Human readable date
}

export interface CumulativePagesDataPoint {
  date: string;
  totalActivePages: number;
  totalPagesEverCreated: number;
  label: string; // Human readable date
}

export interface SharesDataPoint {
  date: string;
  successful: number;
  aborted: number;
  total: number;
  label: string;
}

export interface EditsDataPoint {
  date: string;
  count: number;
  label: string; // Human readable date
}

export interface ContentChangesDataPoint {
  date: string;
  charactersAdded: number;
  charactersDeleted: number;
  netChange: number;
  label: string; // Human readable date
}

export interface PWAInstallsDataPoint {
  date: string;
  count: number;
  label: string; // Human readable date
}

/**
 * Cache utility functions
 */
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

function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp >= CACHE_DURATION) {
      cache.delete(key);
    }
  }
}

// Clear expired cache every minute
setInterval(clearExpiredCache, 60 * 1000);

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

    // Determine format based on interval duration
    const intervalHours = intervalDuration / (1000 * 60 * 60);
    const useHourlyFormat = intervalHours < 24;

    return {
      intervals,
      formatKey: (date: Date) => useHourlyFormat
        ? format(date, 'yyyy-MM-dd-HH')
        : format(date, 'yyyy-MM-dd'),
      formatLabel: (date: Date) => useHourlyFormat
        ? format(date, 'MMM dd HH:mm')
        : format(date, 'MMM dd'),
      granularity: useHourlyFormat ? 'hourly' as const : 'daily' as const,
      intervalDuration,
      customGranularity
    };
  }

  // Default behavior: automatic granularity based on date range
  const diffInHours = totalDuration / (1000 * 60 * 60);
  const useHourlyGranularity = diffInHours <= 168;

  if (useHourlyGranularity) {
    const hours = eachHourOfInterval({ start: startDate, end: endDate });
    return {
      intervals: hours,
      formatKey: (date: Date) => format(date, 'yyyy-MM-dd-HH'),
      formatLabel: (date: Date) => format(date, 'MMM dd HH:mm'),
      granularity: 'hourly' as const
    };
  } else {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return {
      intervals: days,
      formatKey: (date: Date) => format(date, 'yyyy-MM-dd'),
      formatLabel: (date: Date) => format(date, 'MMM dd'),
      granularity: 'daily' as const
    };
  }
}

/**
 * Dashboard Analytics Service
 * Provides data fetching functions for admin dashboard widgets with caching
 */
export class DashboardAnalyticsService {
  
  /**
   * Get new accounts created within date range
   */
  static async getNewAccountsCreated(dateRange: DateRange, granularity?: number): Promise<ChartDataPoint[]> {


    try {
      // Check cache first (include granularity in cache key)
      const cacheKey = getCacheKey('accounts', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<ChartDataPoint[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const { startDate, endDate } = dateRange;
      const timeConfig = getTimeIntervals(dateRange, granularity);

      // Query users collection for accounts created in date range
      const usersRef = collection(db, 'users');

      // Since we may not have the right indexes and createdAt can be stored as either
      // ISO string or Timestamp, let's use a simpler approach: get all users and filter in memory
      // This is acceptable for analytics since we limit to 1000 users anyway

      console.log('🔍 [Analytics Service] Fetching users for analytics (limited to 1000)...');
      await throttleQuery();

      const simpleQuery = query(usersRef, limit(1000));
      const snapshot = await getDocs(simpleQuery);

      console.log(`✅ [Analytics Service] Users query successful, found ${snapshot.size} documents, will filter by date in memory`);



      // Group by time interval
      const dateMap = new Map<string, number>();

      // Initialize all time intervals in range with 0
      timeConfig.intervals.forEach(interval => {
        const dateKey = timeConfig.formatKey(interval);
        dateMap.set(dateKey, 0);
      });

      // Count users by creation time interval, filtering by date range in memory
      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;

        if (createdAt) {
          let date: Date;
          if (createdAt instanceof Timestamp) {
            date = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            date = new Date(createdAt);
            // Validate the parsed date
            if (isNaN(date.getTime())) {
              console.warn('Invalid date string:', createdAt, 'for user:', doc.id);
              return; // Skip invalid dates
            }
          } else {
            console.warn('Unknown createdAt format:', typeof createdAt, createdAt, 'for user:', doc.id);
            return; // Skip invalid dates
          }

          // Filter by date range in memory since we couldn't use indexes
          if (date < startDate || date > endDate) {
            return; // Skip users outside the date range
          }

          // Find the appropriate interval bucket for this date
          let intervalDate: Date;
          if (timeConfig.customGranularity && timeConfig.intervalDuration) {
            // For custom granularity, find which bucket this date belongs to
            const timeSinceStart = date.getTime() - startDate.getTime();
            const bucketIndex = Math.floor(timeSinceStart / timeConfig.intervalDuration);
            const clampedIndex = Math.max(0, Math.min(bucketIndex, timeConfig.intervals.length - 1));
            intervalDate = timeConfig.intervals[clampedIndex];
          } else {
            // Use standard rounding for automatic granularity
            intervalDate = timeConfig.granularity === 'hourly' ? startOfHour(date) : startOfDay(date);
          }

          const dateKey = timeConfig.formatKey(intervalDate);
          const currentCount = dateMap.get(dateKey) || 0;
          dateMap.set(dateKey, currentCount + 1);
        }
      });

      // Convert to chart data format
      const result = Array.from(dateMap.entries()).map(([dateKey, count]) => {
        // Parse the date key back to a Date object for formatting
        const date = timeConfig.granularity === 'hourly'
          ? new Date(dateKey.replace(/-(\d{2})$/, ':$1:00'))
          : new Date(dateKey);

        return {
          date: dateKey,
          count,
          label: timeConfig.formatLabel(date)
        };
      });

      // Cache the result
      setCachedData(cacheKey, result);
      console.log('📊 [Analytics Service] Returning accounts result:', result.length, 'data points, total accounts:', result.reduce((sum, item) => sum + item.count, 0));
      return result;

    } catch (error) {
      console.error('Error fetching new accounts data:', error);
      return [];
    }
  }

  /**
   * Get composite pages data (created and deleted) within date range using aggregation
   */
  static async getCompositePagesData(dateRange: DateRange, granularity?: number): Promise<CompositePagesDataPoint[]> {
    console.log('🔍 [Analytics Service] getCompositePagesData called with dateRange:', {
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
      daysDifference: Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24))
    });

    try {
      // Check cache first
      const cacheKey = getCacheKey('composite-pages', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<CompositePagesDataPoint[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const { startDate, endDate } = dateRange;
      const timeConfig = getTimeIntervals(dateRange, granularity);

      // Use aggregation service for efficient data retrieval
      const diffInHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

      if (diffInHours <= 168) { // 7 days or less - use hourly aggregations
        const hourlyData = await AnalyticsAggregationService.getHourlyAggregations(startDate, endDate);

        // Group hourly data into the requested time intervals
        const dateMap = new Map<string, {
          pagesCreated: number;
          pagesDeleted: number;
          publicPagesCreated: number;
          privatePagesCreated: number;
        }>();

        timeConfig.intervals.forEach(interval => {
          const dateKey = timeConfig.formatKey(interval);
          dateMap.set(dateKey, {
            pagesCreated: 0,
            pagesDeleted: 0,
            publicPagesCreated: 0,
            privatePagesCreated: 0
          });
        });

        // Aggregate hourly data into time intervals
        hourlyData.forEach(hour => {
          const hourDate = new Date(hour.datetime.replace(/-(\d{2})$/, ':$1:00'));
          const dateKey = timeConfig.formatKey(hourDate);
          const currentCounts = dateMap.get(dateKey);

          if (currentCounts) {
            currentCounts.pagesCreated += hour.pagesCreated || 0;
            currentCounts.pagesDeleted += hour.pagesDeleted || 0;
            currentCounts.publicPagesCreated += hour.publicPagesCreated || 0;
            currentCounts.privatePagesCreated += hour.privatePagesCreated || 0;
            dateMap.set(dateKey, currentCounts);
          }
        });

        // Convert to chart data format
        const result = Array.from(dateMap.entries()).map(([dateKey, counts]) => {
          const date = timeConfig.granularity === 'hourly'
            ? new Date(dateKey.replace(/-(\d{2})$/, ':$1:00'))
            : new Date(dateKey);

          const netChange = counts.pagesCreated - counts.pagesDeleted;

          return {
            date: dateKey,
            pagesCreated: counts.pagesCreated,
            pagesDeleted: counts.pagesDeleted,
            publicPagesCreated: counts.publicPagesCreated,
            privatePagesCreated: counts.privatePagesCreated,
            netChange,
            label: timeConfig.formatLabel(date)
          };
        });

        setCachedData(cacheKey, result);
        return result;

      } else {
        // Use daily aggregations for longer periods
        const dailyData = await AnalyticsAggregationService.getDailyAggregations(startDate, endDate);

        // Convert daily aggregations to chart format
        const result = dailyData.map(day => ({
          date: day.date,
          pagesCreated: day.pagesCreated || 0,
          pagesDeleted: day.pagesDeleted || 0,
          publicPagesCreated: day.publicPagesCreated || 0,
          privatePagesCreated: day.privatePagesCreated || 0,
          netChange: day.netChange || 0,
          label: new Date(day.date).toLocaleDateString()
        }));

        setCachedData(cacheKey, result);
        return result;
      }

    } catch (error) {
      console.error('Error fetching composite pages data:', error);
      return [];
    }
  }

  /**
   * Get new pages created within date range with public/private breakdown
   */
  static async getNewPagesCreated(dateRange: DateRange, granularity?: number): Promise<PagesDataPoint[]> {
    console.log('🔍 [Analytics Service] getNewPagesCreated called with dateRange:', {
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
      daysDifference: Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24))
    });

    try {
      // Check cache first (include granularity in cache key)
      const cacheKey = getCacheKey('pages', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<PagesDataPoint[]>(cacheKey);
      if (cachedData) {
        console.log('📦 [Analytics Service] Returning cached pages data:', cachedData.length, 'items');
        return cachedData;
      }

      const { startDate, endDate } = dateRange;
      const timeConfig = getTimeIntervals(dateRange, granularity);

      // Query pages collection for pages created in date range
      const pagesRef = collection(db, 'pages');

      // Optimized query approach - avoid complex compound queries
      // Use simpler query without the deleted field to avoid index complexity
      const q = query(
        pagesRef,
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate)),
        orderBy('createdAt', 'asc'),
        limit(1000) // Add limit to prevent excessive reads
      );

      console.log('🔍 [Analytics Service] Executing optimized pages query...');
      await throttleQuery(); // Throttle query execution
      const snapshot = await getDocs(q);
      console.log(`✅ [Analytics Service] Pages query successful, found ${snapshot.size} documents`);

      // Group by time interval with public/private breakdown
      const dateMap = new Map<string, { publicPages: number; privatePages: number }>();

      // Initialize all time intervals in range with 0
      timeConfig.intervals.forEach(interval => {
        const dateKey = timeConfig.formatKey(interval);
        dateMap.set(dateKey, { publicPages: 0, privatePages: 0 });
      });

      // Count pages by creation date with public/private breakdown, filtering out deleted pages in memory
      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        const deleted = data.deleted;
        const isPublic = data.isPublic;

        // Skip soft-deleted pages (filter in memory to avoid complex query)
        if (deleted === true) {
          return;
        }

        if (createdAt) {
          let date: Date;
          if (createdAt instanceof Timestamp) {
            date = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            date = new Date(createdAt);
          } else {
            console.warn('Invalid createdAt format:', createdAt, 'for page:', doc.id);
            return; // Skip invalid dates
          }

          // Validate the date is within our expected range
          if (date >= startDate && date <= endDate) {
            // Round to appropriate time interval
            const intervalDate = timeConfig.granularity === 'hourly' ? startOfHour(date) : startOfDay(date);
            const dateKey = timeConfig.formatKey(intervalDate);
            const currentCounts = dateMap.get(dateKey) || { publicPages: 0, privatePages: 0 };

            // Increment the appropriate counter based on page visibility
            if (isPublic === true) {
              currentCounts.publicPages += 1;
              console.log(`📊 [Analytics] Found public page created on ${dateKey}, public count now: ${currentCounts.publicPages}`);
            } else {
              currentCounts.privatePages += 1;
              console.log(`📊 [Analytics] Found private page created on ${dateKey}, private count now: ${currentCounts.privatePages}`);
            }

            dateMap.set(dateKey, currentCounts);
          } else {
            console.log(`📊 [Analytics] Page ${doc.id} created outside date range: ${date.toISOString()}`);
          }
        }
      });

      // Convert to chart data format with public/private breakdown
      const result = Array.from(dateMap.entries()).map(([dateKey, counts]) => {
        // Parse the date key back to a Date object for formatting
        const date = timeConfig.granularity === 'hourly'
          ? new Date(dateKey.replace(/-(\d{2})$/, ':$1:00'))
          : new Date(dateKey);

        const totalPages = counts.publicPages + counts.privatePages;

        return {
          date: dateKey,
          publicPages: counts.publicPages,
          privatePages: counts.privatePages,
          totalPages,
          label: timeConfig.formatLabel(date)
        };
      });

      console.log('📊 [Analytics Service] New pages result summary:', {
        totalDays: result.length,
        totalPages: result.reduce((sum, item) => sum + item.totalPages, 0),
        totalPublicPages: result.reduce((sum, item) => sum + item.publicPages, 0),
        totalPrivatePages: result.reduce((sum, item) => sum + item.privatePages, 0),
        daysWithData: result.filter(item => item.totalPages > 0).length,
        sampleData: result.slice(0, 5)
      });

      // Cache the result
      setCachedData(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching new pages data:', error);
      return [];
    }
  }

  /**
   * Get cumulative pages data showing running total of active pages over time using aggregation
   */
  static async getCumulativePagesData(dateRange: DateRange, granularity?: number): Promise<CumulativePagesDataPoint[]> {
    console.log('🔍 [Analytics Service] getCumulativePagesData called with dateRange:', {
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString()
    });

    try {
      // Check cache first
      const cacheKey = getCacheKey('cumulative-pages', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<CumulativePagesDataPoint[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      // Use the efficient aggregation service
      const result = await AnalyticsAggregationService.getCumulativeData(dateRange.startDate, dateRange.endDate);

      setCachedData(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching cumulative pages data:', error);
      return [];
    }
  }

  /**
   * Get total pages ever created in the system using global counters
   */
  static async getTotalPagesEverCreated(): Promise<number> {
    try {
      // Check cache first
      const cacheKey = 'total-pages-ever-created';
      const cachedData = getCachedData<number>(cacheKey);
      if (cachedData !== null) {
        return cachedData;
      }

      // Use the efficient aggregation service
      const globalCounters = await AnalyticsAggregationService.getGlobalCounters();
      const totalCount = globalCounters.totalPagesEverCreated;

      console.log('📊 [Analytics Service] Total pages ever created:', totalCount);

      // Cache for 5 minutes since this changes infrequently
      setCachedData(cacheKey, totalCount);
      return totalCount;

    } catch (error) {
      console.error('Error fetching total pages count:', error);
      return 0;
    }
  }

  /**
   * Get shares analytics within date range
   * Queries the analytics_events collection for share_event events
   */
  static async getSharesAnalytics(dateRange: DateRange, granularity?: number): Promise<SharesDataPoint[]> {
    try {
      // Check cache first (include granularity in cache key)
      const cacheKey = getCacheKey('shares', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<SharesDataPoint[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const { startDate, endDate } = dateRange;
      const timeConfig = getTimeIntervals(dateRange, granularity);

      // Group by time interval
      const dateMap = new Map<string, { successful: number; aborted: number }>();

      // Initialize all time intervals in range with 0
      timeConfig.intervals.forEach(interval => {
        const dateKey = timeConfig.formatKey(interval);
        dateMap.set(dateKey, { successful: 0, aborted: 0 });
      });

      // Query analytics_events collection for share events
      const analyticsRef = collection(db, 'analytics_events');
      const q = query(
        analyticsRef,
        where('eventType', '==', 'share_event'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate)),
        orderBy('timestamp', 'asc'),
        limit(1000)
      );

      console.log('🔍 [Analytics Service] Executing shares query...');
      await throttleQuery();
      const snapshot = await getDocs(q);
      console.log(`✅ [Analytics Service] Shares query successful, found ${snapshot.size} events`);

      // Aggregate share events by time interval
      snapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp;
        const eventType = data.eventType; // 'share_succeeded' or 'share_aborted'

        if (timestamp) {
          let date: Date;
          if (timestamp instanceof Timestamp) {
            date = timestamp.toDate();
          } else {
            return;
          }

          // Find the appropriate interval bucket for this date
          let intervalDate: Date;
          if (timeConfig.customGranularity && timeConfig.intervalDuration) {
            const timeSinceStart = date.getTime() - startDate.getTime();
            const bucketIndex = Math.floor(timeSinceStart / timeConfig.intervalDuration);
            const clampedIndex = Math.max(0, Math.min(bucketIndex, timeConfig.intervals.length - 1));
            intervalDate = timeConfig.intervals[clampedIndex];
          } else {
            intervalDate = timeConfig.granularity === 'hourly' ? startOfHour(date) : startOfDay(date);
          }

          const dateKey = timeConfig.formatKey(intervalDate);
          const current = dateMap.get(dateKey) || { successful: 0, aborted: 0 };

          if (eventType === 'share_succeeded') {
            current.successful += 1;
          } else if (eventType === 'share_aborted') {
            current.aborted += 1;
          }

          dateMap.set(dateKey, current);
        }
      });

      // Convert to chart data format
      const result = Array.from(dateMap.entries()).map(([dateKey, shares]) => {
        // Parse the date key back to a Date object for formatting
        const date = timeConfig.granularity === 'hourly'
          ? new Date(dateKey.replace(/-(\d{2})$/, ':$1:00'))
          : new Date(dateKey);

        const total = shares.successful + shares.aborted;

        return {
          date: dateKey,
          successful: shares.successful,
          aborted: shares.aborted,
          total,
          label: timeConfig.formatLabel(date)
        };
      });

      console.log('📊 [Analytics Service] Shares result summary:', {
        totalIntervals: result.length,
        totalShares: result.reduce((sum, item) => sum + item.total, 0),
        totalSuccessful: result.reduce((sum, item) => sum + item.successful, 0),
        totalAborted: result.reduce((sum, item) => sum + item.aborted, 0),
        intervalsWithData: result.filter(item => item.total > 0).length
      });

      // Cache the result
      setCachedData(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching shares analytics:', error);
      return [];
    }
  }

  /**
   * Get page edits made within date range
   * Uses simplified approach to avoid complex index requirements
   */
  static async getEditsAnalytics(dateRange: DateRange, granularity?: number): Promise<EditsDataPoint[]> {
    try {
      // Check cache first (include granularity in cache key)
      const cacheKey = getCacheKey('edits', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<EditsDataPoint[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const { startDate, endDate } = dateRange;
      const timeConfig = getTimeIntervals(dateRange, granularity);

      // Group by time interval
      const dateMap = new Map<string, number>();

      // Initialize all time intervals in range with 0
      timeConfig.intervals.forEach(interval => {
        const dateKey = timeConfig.formatKey(interval);
        dateMap.set(dateKey, 0);
      });

      // Use a simpler approach: query pages by lastModified date
      // This avoids the need for complex subcollection queries
      const pagesRef = collection(db, 'pages');

      // Optimized query for edits analytics
      const q = query(
        pagesRef,
        where('lastModified', '>=', Timestamp.fromDate(startDate)),
        where('lastModified', '<=', Timestamp.fromDate(endDate)),
        orderBy('lastModified', 'asc'),
        limit(1000) // Add limit to prevent excessive reads
      );

      console.log('🔍 [Analytics Service] Executing optimized edits query...');
      await throttleQuery(); // Throttle query execution
      const snapshot = await getDocs(q);
      console.log(`✅ [Analytics Service] Edits query successful, found ${snapshot.size} documents`);

      // Count edits by modification date
      snapshot.forEach(doc => {
        const data = doc.data();
        const lastModified = data.lastModified;
        const createdAt = data.createdAt;
        const deleted = data.deleted;

        // Skip deleted pages
        if (deleted === true) {
          return;
        }

        if (lastModified && createdAt) {
          let modDate: Date;
          let createDate: Date;

          if (lastModified instanceof Timestamp) {
            modDate = lastModified.toDate();
          } else if (typeof lastModified === 'string') {
            modDate = new Date(lastModified);
          } else {
            console.warn('Invalid lastModified format:', lastModified, 'for page:', doc.id);
            return; // Skip invalid dates
          }

          if (createdAt instanceof Timestamp) {
            createDate = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            createDate = new Date(createdAt);
          } else {
            console.warn('Invalid createdAt format:', createdAt, 'for page:', doc.id);
            return; // Skip invalid dates
          }

          // Only count as edit if lastModified is different from createdAt
          // (i.e., the page was actually edited after creation)
          if (modDate.getTime() !== createDate.getTime()) {
            // Validate the date is within our expected range
            if (modDate >= startDate && modDate <= endDate) {
              // Round to appropriate time interval
              const intervalDate = timeConfig.granularity === 'hourly' ? startOfHour(modDate) : startOfDay(modDate);
              const dateKey = timeConfig.formatKey(intervalDate);
              const currentCount = dateMap.get(dateKey) || 0;
              dateMap.set(dateKey, currentCount + 1);
              console.log(`📊 [Analytics] Found page edit on ${dateKey}, count now: ${currentCount + 1}`);
            } else {
              console.log(`📊 [Analytics] Page ${doc.id} edited outside date range: ${modDate.toISOString()}`);
            }
          } else {
            console.log(`📊 [Analytics] Page ${doc.id} not counted as edit (same creation/modification time)`);
          }
        }
      });

      // Convert to chart data format
      const result = Array.from(dateMap.entries()).map(([dateKey, count]) => {
        // Parse the date key back to a Date object for formatting
        const date = timeConfig.granularity === 'hourly'
          ? new Date(dateKey.replace(/-(\d{2})$/, ':$1:00'))
          : new Date(dateKey);

        return {
          date: dateKey,
          count,
          label: timeConfig.formatLabel(date)
        };
      });

      console.log('📊 [Analytics Service] Edits result summary:', {
        totalDays: result.length,
        totalEdits: result.reduce((sum, item) => sum + item.count, 0),
        daysWithData: result.filter(item => item.count > 0).length,
        sampleData: result.slice(0, 5)
      });

      // Cache the result
      setCachedData(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching edits analytics:', error);
      return [];
    }
  }

  /**
   * Get content changes analytics within date range
   * Queries the analytics_events collection for content_change events
   */
  static async getContentChangesAnalytics(dateRange: DateRange, granularity?: number): Promise<ContentChangesDataPoint[]> {
    try {
      // Check cache first (include granularity in cache key)
      const cacheKey = getCacheKey('content-changes', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<ContentChangesDataPoint[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const { startDate, endDate } = dateRange;
      const timeConfig = getTimeIntervals(dateRange, granularity);

      // Group by time interval
      const dateMap = new Map<string, { added: number; deleted: number }>();

      // Initialize all time intervals in range with 0
      timeConfig.intervals.forEach(interval => {
        const dateKey = timeConfig.formatKey(interval);
        dateMap.set(dateKey, { added: 0, deleted: 0 });
      });

      // Query analytics_events collection for content changes
      const analyticsRef = collection(db, 'analytics_events');
      const q = query(
        analyticsRef,
        where('eventType', '==', 'content_change'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate)),
        orderBy('timestamp', 'asc'),
        limit(1000)
      );

      console.log('🔍 [Analytics Service] Executing content changes query...');
      await throttleQuery();
      const snapshot = await getDocs(q);
      console.log(`✅ [Analytics Service] Content changes query successful, found ${snapshot.size} events`);

      // Aggregate content changes by time interval
      snapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp;
        const charactersAdded = data.charactersAdded || 0;
        const charactersDeleted = data.charactersDeleted || 0;

        if (timestamp) {
          let date: Date;
          if (timestamp instanceof Timestamp) {
            date = timestamp.toDate();
          } else {
            return;
          }

          // Round to appropriate time interval
          const intervalDate = timeConfig.granularity === 'hourly' ? startOfHour(date) : startOfDay(date);
          const dateKey = timeConfig.formatKey(intervalDate);
          const current = dateMap.get(dateKey) || { added: 0, deleted: 0 };

          dateMap.set(dateKey, {
            added: current.added + charactersAdded,
            deleted: current.deleted + charactersDeleted
          });
        }
      });

      // Convert to chart data format
      const result = Array.from(dateMap.entries()).map(([dateKey, changes]) => {
        // Parse the date key back to a Date object for formatting
        const date = timeConfig.granularity === 'hourly'
          ? new Date(dateKey.replace(/-(\d{2})$/, ':$1:00'))
          : new Date(dateKey);

        const netChange = changes.added - changes.deleted;

        return {
          date: dateKey,
          charactersAdded: changes.added,
          charactersDeleted: changes.deleted,
          netChange,
          label: timeConfig.formatLabel(date)
        };
      });

      console.log('📊 [Analytics Service] Content changes result summary:', {
        totalIntervals: result.length,
        totalAdded: result.reduce((sum, item) => sum + item.charactersAdded, 0),
        totalDeleted: result.reduce((sum, item) => sum + item.charactersDeleted, 0),
        intervalsWithData: result.filter(item => item.charactersAdded > 0 || item.charactersDeleted > 0).length
      });

      // Cache the result
      setCachedData(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching content changes analytics:', error);
      return [];
    }
  }

  /**
   * Helper function to extract text content from editor content
   */
  private static extractTextFromContent(content: any): string {
    if (!content) return '';

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(node => this.extractTextFromNode(node)).join('');
    }

    return '';
  }

  /**
   * Helper function to extract text from editor nodes
   */
  private static extractTextFromNode(node: any): string {
    if (!node) return '';

    if (typeof node === 'string') {
      return node;
    }

    if (node.text) {
      return node.text;
    }

    if (node.children && Array.isArray(node.children)) {
      return node.children.map((child: any) => this.extractTextFromNode(child)).join('');
    }

    return '';
  }

  /**
   * Get PWA installation analytics within date range
   * Queries the analytics_events collection for pwa_install events
   */
  static async getPWAInstallsAnalytics(dateRange: DateRange, granularity?: number): Promise<PWAInstallsDataPoint[]> {
    try {
      // Check cache first (include granularity in cache key)
      const cacheKey = getCacheKey('pwa-installs', dateRange) + (granularity ? `-g${granularity}` : '');
      const cachedData = getCachedData<PWAInstallsDataPoint[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const { startDate, endDate } = dateRange;
      const timeConfig = getTimeIntervals(dateRange, granularity);

      // Group by time interval
      const dateMap = new Map<string, number>();

      // Initialize all time intervals in range with 0
      timeConfig.intervals.forEach(interval => {
        const dateKey = timeConfig.formatKey(interval);
        dateMap.set(dateKey, 0);
      });

      // Query analytics_events collection for PWA installations
      const analyticsRef = collection(db, 'analytics_events');
      const q = query(
        analyticsRef,
        where('eventType', '==', 'pwa_install'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate)),
        orderBy('timestamp', 'asc'),
        limit(1000)
      );

      console.log('🔍 [Analytics Service] Executing PWA installs query...');
      await throttleQuery();
      const snapshot = await getDocs(q);
      console.log(`✅ [Analytics Service] PWA installs query successful, found ${snapshot.size} events`);

      // Count PWA installations by time interval
      // Only count 'app_installed' events as actual installations
      snapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp;
        const eventType = data.eventType;

        // Only count actual installations, not prompts
        if (timestamp && eventType === 'app_installed') {
          let date: Date;
          if (timestamp instanceof Timestamp) {
            date = timestamp.toDate();
          } else {
            return;
          }

          // Round to appropriate time interval
          const intervalDate = timeConfig.granularity === 'hourly' ? startOfHour(date) : startOfDay(date);
          const dateKey = timeConfig.formatKey(intervalDate);
          const currentCount = dateMap.get(dateKey) || 0;
          dateMap.set(dateKey, currentCount + 1);
        }
      });

      // Convert to chart data format
      const result = Array.from(dateMap.entries()).map(([dateKey, count]) => {
        // Parse the date key back to a Date object for formatting
        const date = timeConfig.granularity === 'hourly'
          ? new Date(dateKey.replace(/-(\d{2})$/, ':$1:00'))
          : new Date(dateKey);

        return {
          date: dateKey,
          count,
          label: timeConfig.formatLabel(date)
        };
      });

      console.log('📊 [Analytics Service] PWA installs result summary:', {
        totalIntervals: result.length,
        totalInstalls: result.reduce((sum, item) => sum + item.count, 0),
        intervalsWithData: result.filter(item => item.count > 0).length
      });

      // Cache the result
      setCachedData(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching PWA installs analytics:', error);
      return [];
    }
  }

  /**
   * Get all dashboard metrics in a single call with optimized batching
   */
  static async getAllMetrics(dateRange: DateRange): Promise<DashboardMetrics> {
    console.log('🔄 [Analytics Service] getAllMetrics called, executing batch queries...');

    try {
      // Execute queries in smaller batches to reduce load
      // Batch 1: Core metrics (accounts and pages)
      const [newAccountsCreated, newPagesCreated] = await Promise.all([
        this.getNewAccountsCreated(dateRange),
        this.getNewPagesCreated(dateRange)
      ]);

      // Batch 2: Activity metrics (edits and shares)
      const [editsAnalytics, sharesAnalytics] = await Promise.all([
        this.getEditsAnalytics(dateRange),
        this.getSharesAnalytics(dateRange)
      ]);

      // Batch 3: Advanced metrics (content changes and PWA installs)
      const [contentChangesAnalytics, pwaInstallsAnalytics] = await Promise.all([
        this.getContentChangesAnalytics(dateRange),
        this.getPWAInstallsAnalytics(dateRange)
      ]);

      console.log('✅ [Analytics Service] All metrics fetched successfully');

      return {
        newAccountsCreated,
        newPagesCreated,
        sharesAnalytics,
        editsAnalytics,
        contentChangesAnalytics,
        pwaInstallsAnalytics
      };
    } catch (error) {
      console.error('❌ [Analytics Service] Error fetching dashboard metrics:', error);
      return {
        newAccountsCreated: [],
        newPagesCreated: [],
        sharesAnalytics: [],
        editsAnalytics: [],
        contentChangesAnalytics: [],
        pwaInstallsAnalytics: []
      };
    }
  }

  /**
   * Get summary statistics for the date range
   */
  static async getSummaryStats(dateRange: DateRange) {
    try {
      const metrics = await this.getAllMetrics(dateRange);

      const totalNewAccounts = metrics.newAccountsCreated.reduce((sum, item) => sum + item.count, 0);
      const totalNewPages = metrics.newPagesCreated.reduce((sum, item) => sum + item.count, 0);
      const totalShares = metrics.sharesAnalytics.reduce((sum, item) => sum + item.total, 0);
      const totalSuccessfulShares = metrics.sharesAnalytics.reduce((sum, item) => sum + item.successful, 0);

      return {
        totalNewAccounts,
        totalNewPages,
        totalShares,
        totalSuccessfulShares,
        shareSuccessRate: totalShares > 0 ? (totalSuccessfulShares / totalShares) * 100 : 0
      };
    } catch (error) {
      console.error('Error fetching summary stats:', error);
      return {
        totalNewAccounts: 0,
        totalNewPages: 0,
        totalShares: 0,
        totalSuccessfulShares: 0,
        shareSuccessRate: 0
      };
    }
  }

  /**
   * Get visitor analytics over time for the date range
   */
  static async getVisitorAnalytics(dateRange: DateRange, granularity?: number) {
    try {
      const { startDate, endDate } = dateRange;
      const timeConfig = getTimeIntervals(dateRange, granularity);

      // Group by time interval
      const dateMap = new Map<string, { authenticated: number; anonymous: number; total: number }>();

      // Initialize all time intervals in range with 0
      timeConfig.intervals.forEach(interval => {
        const dateKey = timeConfig.formatKey(interval);
        dateMap.set(dateKey, { authenticated: 0, anonymous: 0, total: 0 });
      });

      // Query pageViews collection for visitor data
      const pageViewsRef = collection(db, 'pageViews');
      const q = query(
        pageViewsRef,
        where('lastUpdated', '>=', Timestamp.fromDate(startDate)),
        where('lastUpdated', '<=', Timestamp.fromDate(endDate)),
        orderBy('lastUpdated', 'asc'),
        limit(1000)
      );

      const snapshot = await getDocs(q);

      // Process page view data
      snapshot.forEach(doc => {
        const data = doc.data();
        const lastUpdated = data.lastUpdated;
        const hours = data.hours || {};

        if (lastUpdated) {
          let date: Date;
          if (lastUpdated instanceof Timestamp) {
            date = lastUpdated.toDate();
          } else {
            return;
          }

          // For each hour in the day, add to the appropriate time interval
          Object.entries(hours).forEach(([hour, views]) => {
            const hourDate = new Date(date);
            hourDate.setHours(parseInt(hour), 0, 0, 0);

            // Skip if outside our date range
            if (hourDate < startDate || hourDate > endDate) {
              return;
            }

            // Round to appropriate time interval
            const intervalDate = timeConfig.granularity === 'hourly' ? startOfHour(hourDate) : startOfDay(hourDate);
            const dateKey = timeConfig.formatKey(intervalDate);

            if (dateMap.has(dateKey)) {
              const current = dateMap.get(dateKey)!;
              // For now, treat all page views as anonymous visitors
              // In the future, we could track authenticated vs anonymous separately
              current.anonymous += views as number;
              current.total += views as number;
              dateMap.set(dateKey, current);
            }
          });
        }
      });

      // Convert to array format
      const result = Array.from(dateMap.entries()).map(([dateKey, counts]) => ({
        date: dateKey,
        label: dateKey,
        authenticated: counts.authenticated,
        anonymous: counts.anonymous,
        total: counts.total
      }));

      return result;

    } catch (error) {
      console.error('❌ [Analytics Service] Error fetching visitor analytics:', error);
      return [];
    }
  }

  /**
   * Clear all cached data
   */
  static clearCache(): void {
    cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return {
      size: cache.size,
      keys: Array.from(cache.keys()),
      totalMemory: JSON.stringify(Array.from(cache.values())).length
    };
  }
}
