/**
 * Analytics Aggregation Service
 * Provides scalable analytics using pre-computed counters and aggregation documents
 * Designed to handle millions of records efficiently without full collection scans
 */

import {
  Timestamp,
  writeBatch,
  doc,
  increment
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  AnalyticsDataLayer,
  type GlobalCounters,
  type DailyAggregation,
  type HourlyAggregation
} from '../firebase/database/analytics';

// Daily aggregation document structure
export interface DailyAggregation {
  date: string; // YYYY-MM-DD format
  pagesCreated: number;
  pagesDeleted: number;
  publicPagesCreated: number;
  privatePagesCreated: number;
  netChange: number;
  cumulativeActive: number;
  cumulativeTotal: number;
  lastUpdated: Timestamp;
}

// Hourly aggregation for more granular data
export interface HourlyAggregation {
  datetime: string; // YYYY-MM-DD-HH format
  pagesCreated: number;
  pagesDeleted: number;
  publicPagesCreated: number;
  privatePagesCreated: number;
  netChange: number;
  lastUpdated: Timestamp;
}

/**
 * Analytics Aggregation Service Class
 */
export class AnalyticsAggregationService {
  
  /**
   * Get global counters (total pages ever created, active pages, etc.)
   */
  static async getGlobalCounters(): Promise<GlobalCounters> {
    try {
      const counters = await AnalyticsDataLayer.getGlobalCounters();

      if (counters) {
        return counters;
      }

      // If no counter exists, initialize it by counting existing pages
      console.log('🔄 Initializing global counters...');
      return await this.initializeGlobalCounters();

    } catch (error) {
      console.error('Error fetching global counters:', error);
      // Return default values if there's an error
      return {
        totalPagesEverCreated: 0,
        totalActivePages: 0,
        totalDeletedPages: 0,
        totalPublicPages: 0,
        totalPrivatePages: 0,
        lastUpdated: Timestamp.now()
      };
    }
  }

  /**
   * Initialize global counters by counting existing pages
   * This should only run once during system setup
   */
  private static async initializeGlobalCounters(): Promise<GlobalCounters> {
    try {
      // Use the data layer to count pages properly
      const pageCounts = await AnalyticsDataLayer.countTotalPages();

      const counters: GlobalCounters = {
        ...pageCounts,
        lastUpdated: Timestamp.now()
      };

      // Store the initialized counters using the data layer
      await AnalyticsDataLayer.setGlobalCounters(counters);

      console.log('✅ Global counters initialized:', counters);
      return counters;

    } catch (error) {
      console.error('Error initializing global counters:', error);
      throw error;
    }
  }

  /**
   * Increment counters when a page is created
   */
  static async incrementPageCreated(isPublic: boolean): Promise<void> {
    try {
      const batch = writeBatch(db);
      const globalRef = doc(db, 'analytics_counters', 'global');
      
      // Update global counters
      batch.update(globalRef, {
        totalPagesEverCreated: increment(1),
        totalActivePages: increment(1),
        ...(isPublic ? { totalPublicPages: increment(1) } : { totalPrivatePages: increment(1) }),
        lastUpdated: Timestamp.now()
      });

      // Update daily aggregation
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const dailyRef = doc(db, 'analytics_daily', today);
      batch.set(dailyRef, {
        date: today,
        pagesCreated: increment(1),
        ...(isPublic ? { publicPagesCreated: increment(1) } : { privatePagesCreated: increment(1) }),
        netChange: increment(1),
        lastUpdated: Timestamp.now()
      }, { merge: true });

      // Update hourly aggregation
      const now = new Date();
      const hourKey = `${today}-${now.getHours().toString().padStart(2, '0')}`;
      const hourlyRef = doc(db, 'analytics_hourly', hourKey);
      batch.set(hourlyRef, {
        datetime: hourKey,
        pagesCreated: increment(1),
        ...(isPublic ? { publicPagesCreated: increment(1) } : { privatePagesCreated: increment(1) }),
        netChange: increment(1),
        lastUpdated: Timestamp.now()
      }, { merge: true });

      await batch.commit();
      console.log('📊 Page creation counters updated');
      
    } catch (error: any) {
      // Handle permission denied errors gracefully
      if (error?.code === 'permission-denied') {
        console.log('Permission denied incrementing page created counters - this is expected in some environments');
      } else {
        console.error('Error incrementing page created counters:', error);
      }
    }
  }

  /**
   * Increment counters when a page is deleted
   */
  static async incrementPageDeleted(wasPublic: boolean): Promise<void> {
    try {
      const batch = writeBatch(db);
      const globalRef = doc(db, 'analytics_counters', 'global');
      
      // Update global counters
      batch.update(globalRef, {
        totalActivePages: increment(-1),
        totalDeletedPages: increment(1),
        ...(wasPublic ? { totalPublicPages: increment(-1) } : { totalPrivatePages: increment(-1) }),
        lastUpdated: Timestamp.now()
      });

      // Update daily aggregation
      const today = new Date().toISOString().split('T')[0];
      const dailyRef = doc(db, 'analytics_daily', today);
      batch.set(dailyRef, {
        date: today,
        pagesDeleted: increment(1),
        netChange: increment(-1),
        lastUpdated: Timestamp.now()
      }, { merge: true });

      // Update hourly aggregation
      const now = new Date();
      const hourKey = `${today}-${now.getHours().toString().padStart(2, '0')}`;
      const hourlyRef = doc(db, 'analytics_hourly', hourKey);
      batch.set(hourlyRef, {
        datetime: hourKey,
        pagesDeleted: increment(1),
        netChange: increment(-1),
        lastUpdated: Timestamp.now()
      }, { merge: true });

      await batch.commit();
      console.log('📊 Page deletion counters updated');
      
    } catch (error) {
      console.error('Error incrementing page deleted counters:', error);
    }
  }

  /**
   * Get daily aggregations for a date range
   */
  static async getDailyAggregations(startDate: Date, endDate: Date): Promise<DailyAggregation[]> {
    try {
      return await AnalyticsDataLayer.getDailyAggregations(startDate, endDate);
    } catch (error) {
      console.error('Error fetching daily aggregations:', error);
      return [];
    }
  }

  /**
   * Get hourly aggregations for a date range (for more granular data)
   */
  static async getHourlyAggregations(startDate: Date, endDate: Date): Promise<HourlyAggregation[]> {
    try {
      return await AnalyticsDataLayer.getHourlyAggregations(startDate, endDate);
    } catch (error) {
      console.error('Error fetching hourly aggregations:', error);
      return [];
    }
  }

  /**
   * Compute cumulative totals from daily aggregations
   */
  static async getCumulativeData(startDate: Date, endDate: Date): Promise<Array<{
    date: string;
    totalActivePages: number;
    totalPagesEverCreated: number;
    label: string;
  }>> {
    try {
      const dailyAggregations = await this.getDailyAggregations(startDate, endDate);
      const globalCounters = await this.getGlobalCounters();

      // Calculate baseline (active pages before start date)
      let runningActiveTotal = globalCounters.totalActivePages;
      let runningCreatedTotal = globalCounters.totalPagesEverCreated;

      // Subtract changes that happened during our date range to get baseline
      const totalNetChange = dailyAggregations.reduce((sum, day) => sum + (day.netChange || 0), 0);
      const totalCreatedInRange = dailyAggregations.reduce((sum, day) => sum + (day.pagesCreated || 0), 0);

      runningActiveTotal -= totalNetChange;
      runningCreatedTotal -= totalCreatedInRange;

      // Build cumulative data
      const result = dailyAggregations.map(day => {
        runningActiveTotal += (day.netChange || 0);
        runningCreatedTotal += (day.pagesCreated || 0);

        return {
          date: day.date,
          totalActivePages: Math.max(0, runningActiveTotal),
          totalPagesEverCreated: runningCreatedTotal,
          label: new Date(day.date).toLocaleDateString()
        };
      });

      return result;

    } catch (error) {
      console.error('Error computing cumulative data:', error);
      return [];
    }
  }

  /**
   * Update cumulative totals in daily aggregations (run periodically)
   */
  static async updateCumulativeTotals(): Promise<void> {
    try {
      const globalCounters = await this.getGlobalCounters();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyAggregations = await this.getDailyAggregations(thirtyDaysAgo, new Date());

      let runningActive = globalCounters.totalActivePages;
      let runningTotal = globalCounters.totalPagesEverCreated;

      // Work backwards to calculate what the totals were at each day
      for (let i = dailyAggregations.length - 1; i >= 0; i--) {
        const day = dailyAggregations[i];

        // Update the document with cumulative totals
        await updateDoc(doc(db, 'analytics_daily', day.date), {
          cumulativeActive: runningActive,
          cumulativeTotal: runningTotal,
          lastUpdated: Timestamp.now()
        });

        // Move backwards in time
        runningActive -= (day.netChange || 0);
        runningTotal -= (day.pagesCreated || 0);
      }

      console.log('✅ Cumulative totals updated for daily aggregations');

    } catch (error) {
      console.error('Error updating cumulative totals:', error);
    }
  }
}