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
import { format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

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
  newPagesCreated: ChartDataPoint[];
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
  return `${method}_${format(dateRange.startDate, 'yyyy-MM-dd')}_${format(dateRange.endDate, 'yyyy-MM-dd')}`;
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
 * Dashboard Analytics Service
 * Provides data fetching functions for admin dashboard widgets with caching
 */
export class DashboardAnalyticsService {
  
  /**
   * Get new accounts created within date range
   */
  static async getNewAccountsCreated(dateRange: DateRange): Promise<ChartDataPoint[]> {


    try {
      // Check cache first
      const cacheKey = getCacheKey('accounts', dateRange);
      const cachedData = getCachedData<ChartDataPoint[]>(cacheKey);
      if (cachedData) {

        return cachedData;
      }

      const { startDate, endDate } = dateRange;
      
      // Query users collection for accounts created in date range
      const usersRef = collection(db, 'users');

      // Optimized query approach - use single timestamp format consistently
      // Use Firestore Timestamp for better performance and index efficiency
      const q = query(
        usersRef,
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate)),
        orderBy('createdAt', 'asc'),
        limit(1000) // Add limit to prevent excessive reads
      );

      console.log('🔍 [Analytics Service] Executing optimized users query...');
      await throttleQuery(); // Throttle query execution
      const snapshot = await getDocs(q);
      console.log(`✅ [Analytics Service] Users query successful, found ${snapshot.size} documents`);

      // Group by date
      const dateMap = new Map<string, number>();
      
      // Initialize all dates in range with 0
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        dateMap.set(dateKey, 0);
      });

      // Count users by creation date
      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        
        if (createdAt) {
          let date: Date;
          if (createdAt instanceof Timestamp) {
            date = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            date = new Date(createdAt);
          } else {
            return; // Skip invalid dates
          }
          
          const dateKey = format(date, 'yyyy-MM-dd');
          const currentCount = dateMap.get(dateKey) || 0;
          dateMap.set(dateKey, currentCount + 1);
        }
      });

      // Convert to chart data format
      const result = Array.from(dateMap.entries()).map(([date, count]) => ({
        date,
        count,
        label: format(new Date(date), 'MMM dd')
      }));

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
   * Get new pages created within date range
   */
  static async getNewPagesCreated(dateRange: DateRange): Promise<ChartDataPoint[]> {
    console.log('🔍 [Analytics Service] getNewPagesCreated called with dateRange:', {
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString()
    });

    try {
      // Check cache first
      const cacheKey = getCacheKey('pages', dateRange);
      const cachedData = getCachedData<ChartDataPoint[]>(cacheKey);
      if (cachedData) {
        console.log('📦 [Analytics Service] Returning cached pages data:', cachedData.length, 'items');
        return cachedData;
      }

      const { startDate, endDate } = dateRange;
      
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
      
      // Group by date
      const dateMap = new Map<string, number>();
      
      // Initialize all dates in range with 0
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        dateMap.set(dateKey, 0);
      });

      // Count pages by creation date, filtering out deleted pages in memory
      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        const deleted = data.deleted;

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
            return; // Skip invalid dates
          }

          const dateKey = format(date, 'yyyy-MM-dd');
          const currentCount = dateMap.get(dateKey) || 0;
          dateMap.set(dateKey, currentCount + 1);
        }
      });

      // Convert to chart data format
      const result = Array.from(dateMap.entries()).map(([date, count]) => ({
        date,
        count,
        label: format(new Date(date), 'MMM dd')
      }));

      // Cache the result
      setCachedData(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching new pages data:', error);
      return [];
    }
  }

  /**
   * Get shares analytics within date range
   * TODO: Implement real share analytics by querying actual analytics events
   * This should query Google Analytics 4 events or a Firestore analytics collection
   */
  static async getSharesAnalytics(dateRange: DateRange): Promise<SharesDataPoint[]> {
    try {
      // Check cache first
      const cacheKey = getCacheKey('shares', dateRange);
      const cachedData = getCachedData<SharesDataPoint[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      // TODO: Replace this with real implementation
      // Real implementation would:
      // 1. Query Google Analytics 4 for PAGE_SHARE_ABORTED and PAGE_SHARE_SUCCEEDED events
      // 2. Or query a Firestore 'analytics_events' collection
      // 3. Aggregate the data by date within the dateRange

      // For now, return empty array to show proper empty state
      const result: SharesDataPoint[] = [];

      // Cache the result
      setCachedData(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching shares analytics:', error);
      throw new Error('Failed to fetch share analytics data');
    }
  }

  /**
   * Get page edits made within date range
   * Uses simplified approach to avoid complex index requirements
   */
  static async getEditsAnalytics(dateRange: DateRange): Promise<EditsDataPoint[]> {
    try {
      // Check cache first
      const cacheKey = getCacheKey('edits', dateRange);
      const cachedData = getCachedData<EditsDataPoint[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const { startDate, endDate } = dateRange;

      // Group by date
      const dateMap = new Map<string, number>();

      // Initialize all dates in range with 0
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
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
            return; // Skip invalid dates
          }

          if (createdAt instanceof Timestamp) {
            createDate = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            createDate = new Date(createdAt);
          } else {
            return; // Skip invalid dates
          }

          // Only count as edit if lastModified is different from createdAt
          // (i.e., the page was actually edited after creation)
          if (modDate.getTime() !== createDate.getTime()) {
            const dateKey = format(modDate, 'yyyy-MM-dd');
            const currentCount = dateMap.get(dateKey) || 0;
            dateMap.set(dateKey, currentCount + 1);
          }
        }
      });

      // Convert to chart data format
      const result = Array.from(dateMap.entries()).map(([date, count]) => ({
        date,
        count,
        label: format(new Date(date), 'MMM dd')
      }));

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
   * For now, returns empty state as historical character tracking is not available
   * TODO: Implement real character tracking when page edit events are enhanced
   */
  static async getContentChangesAnalytics(dateRange: DateRange): Promise<ContentChangesDataPoint[]> {
    try {
      // Check cache first
      const cacheKey = getCacheKey('content-changes', dateRange);
      const cachedData = getCachedData<ContentChangesDataPoint[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      // TODO: Implement real content changes tracking
      // Real implementation would:
      // 1. Track character additions/deletions in page edit events
      // 2. Store this data in a separate analytics collection
      // 3. Query that collection for the date range
      // 4. Calculate net changes per day

      // For now, return empty array to show proper empty state
      // Historical character tracking is not available without complex version analysis
      const result: ContentChangesDataPoint[] = [];

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
   * TODO: Implement PWA installation tracking
   * For now, returns empty state as PWA installation tracking is not implemented
   */
  static async getPWAInstallsAnalytics(dateRange: DateRange): Promise<PWAInstallsDataPoint[]> {
    try {
      // Check cache first
      const cacheKey = getCacheKey('pwa-installs', dateRange);
      const cachedData = getCachedData<PWAInstallsDataPoint[]>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      // TODO: Implement real PWA installation tracking
      // Real implementation would:
      // 1. Listen for 'beforeinstallprompt' and 'appinstalled' events
      // 2. Track these events in Google Analytics or Firestore
      // 3. Query the analytics data for the date range
      // 4. Aggregate installations per day

      // For now, return empty array to show proper empty state
      // PWA installation tracking is not yet implemented
      const result: PWAInstallsDataPoint[] = [];

      // Cache the result
      setCachedData(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching PWA installs analytics:', error);
      throw new Error('Failed to fetch PWA installation data');
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
