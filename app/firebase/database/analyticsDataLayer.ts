/**
 * Analytics Data Layer
 * 
 * This module provides a proper data abstraction layer for analytics operations,
 * following the existing database architecture patterns in WeWrite.
 * 
 * Instead of direct Firestore queries scattered throughout the codebase,
 * all analytics data access goes through this centralized layer.
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  increment, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db, createPageQuery } from './core';
import { trackQueryPerformance } from '../../utils/queryMonitor';
import { getCollectionName } from '../../utils/environmentConfig';

// Analytics data types
export interface GlobalCounters {
  totalPagesEverCreated: number;
  totalActivePages: number;
  totalDeletedPages: number;
  totalPublicPages: number;
  totalPrivatePages: number;
  lastUpdated: Timestamp;
}

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
 * Analytics Data Access Layer
 * Provides centralized access to analytics collections with proper error handling,
 * caching, and performance tracking.
 */
export class AnalyticsDataLayer {
  
  /**
   * Get global analytics counters
   */
  static async getGlobalCounters(): Promise<GlobalCounters | null> {
    return await trackQueryPerformance('analytics.getGlobalCounters', async () => {
      try {
        const counterDoc = await getDoc(doc(db, getCollectionName('analytics_counters'), 'global'));
        
        if (counterDoc.exists()) {
          return counterDoc.data() as GlobalCounters;
        }
        
        return null;
      } catch (error) {
        console.error('Error fetching global counters:', error);
        throw error;
      }
    });
  }

  /**
   * Set global analytics counters
   */
  static async setGlobalCounters(counters: GlobalCounters): Promise<void> {
    return await trackQueryPerformance('analytics.setGlobalCounters', async () => {
      try {
await setDoc(doc(db, getCollectionName("analytics_counters"), 'global'), counters);
      } catch (error) {
        console.error('Error setting global counters:', error);
        throw error;
      }
    });
  }

  /**
   * Update global analytics counters
   */
  static async updateGlobalCounters(updates: Partial<GlobalCounters>): Promise<void> {
    return await trackQueryPerformance('analytics.updateGlobalCounters', async () => {
      try {
await updateDoc(doc(db, getCollectionName("analytics_counters"), 'global'), {
          ...updates,
          lastUpdated: Timestamp.now()
        });
      } catch (error) {
        console.error('Error updating global counters:', error);
        throw error;
      }
    });
  }

  /**
   * Get daily aggregations for a date range
   */
  static async getDailyAggregations(startDate: Date, endDate: Date): Promise<DailyAggregation[]> {
    return await trackQueryPerformance('analytics.getDailyAggregations', async () => {
      try {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        const dailyRef = collection(db, getCollectionName('analytics_daily'));
        const q = query(
          dailyRef,
          where('date', '>=', startDateStr),
          where('date', '<=', endDateStr),
          orderBy('date', 'asc'),
          limit(400) // Max ~1 year of daily data
        );
        
        const snapshot = await getDocs(q);
        const aggregations: DailyAggregation[] = [];
        
        snapshot.forEach(doc => {
          aggregations.push(doc.data() as DailyAggregation);
        });
        
        return aggregations;
        
      } catch (error) {
        console.error('Error fetching daily aggregations:', error);
        throw error;
      }
    });
  }

  /**
   * Get hourly aggregations for a date range
   */
  static async getHourlyAggregations(startDate: Date, endDate: Date): Promise<HourlyAggregation[]> {
    return await trackQueryPerformance('analytics.getHourlyAggregations', async () => {
      try {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        const hourlyRef = collection(db, getCollectionName('analytics_hourly'));
        const q = query(
          hourlyRef,
          where('datetime', '>=', `${startDateStr}-00`),
          where('datetime', '<=', `${endDateStr}-23`),
          orderBy('datetime', 'asc'),
          limit(2000) // Max ~80 days of hourly data
        );
        
        const snapshot = await getDocs(q);
        const aggregations: HourlyAggregation[] = [];
        
        snapshot.forEach(doc => {
          aggregations.push(doc.data() as HourlyAggregation);
        });
        
        return aggregations;
        
      } catch (error) {
        console.error('Error fetching hourly aggregations:', error);
        throw error;
      }
    });
  }

  /**
   * Set daily aggregation data
   */
  static async setDailyAggregation(date: string, data: Omit<DailyAggregation, 'date'>): Promise<void> {
    return await trackQueryPerformance('analytics.setDailyAggregation', async () => {
      try {
await setDoc(doc(db, getCollectionName("analytics_daily"), date), {
          date,
          ...data
        });
      } catch (error) {
        console.error('Error setting daily aggregation:', error);
        throw error;
      }
    });
  }

  /**
   * Set hourly aggregation data
   */
  static async setHourlyAggregation(datetime: string, data: Omit<HourlyAggregation, 'datetime'>): Promise<void> {
    return await trackQueryPerformance('analytics.setHourlyAggregation', async () => {
      try {
        await setDoc(doc(db, 'analytics_hourly', datetime), {
          datetime,
          ...data
        });
      } catch (error) {
        console.error('Error setting hourly aggregation:', error);
        throw error;
      }
    });
  }

  /**
   * Count total pages using the existing page query helpers
   * This respects the soft delete patterns and access controls
   */
  static async countTotalPages(): Promise<{
    totalPagesEverCreated: number;
    totalActivePages: number;
    totalDeletedPages: number;
    totalPublicPages: number;
    totalPrivatePages: number;
  }> {
    return await trackQueryPerformance('analytics.countTotalPages', async () => {
      try {
        // Use the existing createPageQuery helper to respect soft deletes
        const allPagesQuery = createPageQuery([], true); // Include deleted pages
        const activePagesQuery = createPageQuery([], false); // Exclude deleted pages
        
        // Apply reasonable limits to avoid Firestore constraints
        const allPagesLimited = query(allPagesQuery, limit(10000));
        const activePagesLimited = query(activePagesQuery, limit(10000));
        
        const [allSnapshot, activeSnapshot] = await Promise.all([
          getDocs(allPagesLimited),
          getDocs(activePagesLimited)
        ]);
        
        const totalPagesEverCreated = allSnapshot.size;
        const totalActivePages = activeSnapshot.size;
        const totalDeletedPages = totalPagesEverCreated - totalActivePages;
        
        // Count public/private from active pages
        let totalPublicPages = 0;
        let totalPrivatePages = 0;
        
        activeSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.isPublic === true) {
            totalPublicPages++;
          } else {
            totalPrivatePages++;
          }
        });
        
        return {
          totalPagesEverCreated,
          totalActivePages,
          totalDeletedPages,
          totalPublicPages,
          totalPrivatePages
        };
        
      } catch (error) {
        console.error('Error counting total pages:', error);
        throw error;
      }
    });
  }
}