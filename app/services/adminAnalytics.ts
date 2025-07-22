/**
 * Admin Analytics Service - Uses Firebase Admin SDK for admin dashboard
 * This service bypasses Firestore security rules and is only for admin use
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName } from '../utils/environmentConfig';

// Helper function to get Firestore instance from Firebase Admin
function getAdminFirestore() {
  const admin = getFirebaseAdmin();
  return admin.firestore();
}

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

/**
 * Simple Admin Analytics Service - Reliable and bulletproof
 */
export class AdminAnalyticsService {

  /**
   * Get new accounts created within date range
   */
  static async getNewAccountsCreated(dateRange: DateRange): Promise<ChartDataPoint[]> {
    console.log('🔍 [Admin Analytics] Getting new accounts created...');
    
    try {
      const db = getAdminFirestore();
      const usersRef = db.collection(getCollectionName('users'));
      
      // Fetch all users and filter in memory (simple and reliable)
      const snapshot = await usersRef.limit(1000).get();
      console.log(`✅ [Admin Analytics] Found ${snapshot.size} users`);
      
      // Group by day
      const dailyCounts = new Map<string, number>();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        
        if (createdAt) {
          let date: Date;
          if (createdAt.toDate) {
            date = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            date = new Date(createdAt);
          } else {
            return; // Skip invalid dates
          }
          
          // Filter by date range
          if (date >= dateRange.startDate && date <= dateRange.endDate) {
            const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
          }
        }
      });
      
      // Convert to chart data
      const result: ChartDataPoint[] = [];
      const currentDate = new Date(dateRange.startDate);
      
      while (currentDate <= dateRange.endDate) {
        const dayKey = currentDate.toISOString().split('T')[0];
        const count = dailyCounts.get(dayKey) || 0;
        
        result.push({
          date: dayKey,
          count,
          label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log(`📊 [Admin Analytics] Accounts result: ${result.length} days, ${result.reduce((sum, item) => sum + item.count, 0)} total accounts`);
      return result;
      
    } catch (error) {
      console.error('❌ [Admin Analytics] Error fetching accounts:', error);
      return [];
    }
  }

  /**
   * Get new pages created within date range
   */
  static async getNewPagesCreated(dateRange: DateRange): Promise<PagesDataPoint[]> {
    console.log('🔍 [Admin Analytics] Getting new pages created...');
    
    try {
      const db = getAdminFirestore();
      const pagesRef = db.collection(getCollectionName('pages'));
      
      // Fetch all pages and filter in memory (simple and reliable)
      const snapshot = await pagesRef.limit(1000).get();
      console.log(`✅ [Admin Analytics] Found ${snapshot.size} pages`);
      
      // Group by day
      const dailyCounts = new Map<string, number>();
      let processedCount = 0;
      let skippedDeleted = 0;
      let skippedNoCreatedAt = 0;
      let skippedOutOfRange = 0;
      let addedToResults = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        const deleted = data.deleted;
        processedCount++;

        // Skip deleted pages
        if (deleted === true) {
          skippedDeleted++;
          return;
        }
        
        if (createdAt) {
          let date: Date;
          if (createdAt.toDate) {
            date = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            date = new Date(createdAt);
          } else {
            skippedNoCreatedAt++;
            return; // Skip invalid dates
          }

          // Filter by date range
          if (date >= dateRange.startDate && date <= dateRange.endDate) {
            const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
            addedToResults++;
          } else {
            skippedOutOfRange++;
          }
        } else {
          skippedNoCreatedAt++;
        }
      });
      
      // Convert to chart data
      const result: PagesDataPoint[] = [];
      const currentDate = new Date(dateRange.startDate);
      
      while (currentDate <= dateRange.endDate) {
        const dayKey = currentDate.toISOString().split('T')[0];
        const totalPages = dailyCounts.get(dayKey) || 0;
        
        result.push({
          date: dayKey,
          publicPages: 0, // Legacy field
          privatePages: 0, // Legacy field
          totalPages,
          label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log(`📊 [Admin Analytics] Pages processing summary:`, {
        totalDocuments: snapshot.size,
        processedCount,
        skippedDeleted,
        skippedNoCreatedAt,
        skippedOutOfRange,
        addedToResults,
        dateRange: {
          start: dateRange.startDate.toISOString(),
          end: dateRange.endDate.toISOString()
        },
        resultDays: result.length,
        totalPagesInResult: result.reduce((sum, item) => sum + item.totalPages, 0)
      });

      console.log(`📊 [Admin Analytics] Pages result: ${result.length} days, ${result.reduce((sum, item) => sum + item.totalPages, 0)} total pages`);
      return result;
      
    } catch (error) {
      console.error('❌ [Admin Analytics] Error fetching pages:', error);
      return [];
    }
  }

  /**
   * Get analytics events (shares, content changes, etc.)
   */
  static async getAnalyticsEvents(dateRange: DateRange, eventType?: string): Promise<ChartDataPoint[]> {
    console.log('🔍 [Admin Analytics] Getting analytics events...', { eventType });
    
    try {
      const db = getAdminFirestore();
      const eventsRef = db.collection(getCollectionName('analytics_events'));
      
      // Fetch all events and filter in memory (simple and reliable)
      const snapshot = await eventsRef.limit(1000).get();
      console.log(`✅ [Admin Analytics] Found ${snapshot.size} analytics events`);
      
      // Group by day
      const dailyCounts = new Map<string, number>();
      let processedEvents = 0;
      let matchedEvents = 0;
      let skippedWrongType = 0;
      let skippedNoTimestamp = 0;
      let skippedOutOfRange = 0;
      let addedToResults = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp;
        const event = data.event || data.eventType; // CRITICAL FIX: Check both field names
        processedEvents++;

        // Filter by event type if specified
        if (eventType && event !== eventType) {
          skippedWrongType++;
          return;
        }

        matchedEvents++;
        
        if (timestamp) {
          let date: Date;
          if (timestamp.toDate) {
            date = timestamp.toDate();
          } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
          } else {
            skippedNoTimestamp++;
            return; // Skip invalid dates
          }

          // Filter by date range
          if (date >= dateRange.startDate && date <= dateRange.endDate) {
            const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
            addedToResults++;
          } else {
            skippedOutOfRange++;
          }
        } else {
          skippedNoTimestamp++;
        }
      });
      
      // Convert to chart data
      const result: ChartDataPoint[] = [];
      const currentDate = new Date(dateRange.startDate);
      
      while (currentDate <= dateRange.endDate) {
        const dayKey = currentDate.toISOString().split('T')[0];
        const count = dailyCounts.get(dayKey) || 0;
        
        result.push({
          date: dayKey,
          count,
          label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log(`📊 [Admin Analytics] Events processing summary:`, {
        eventType,
        totalDocuments: snapshot.size,
        processedEvents,
        matchedEvents,
        skippedWrongType,
        skippedNoTimestamp,
        skippedOutOfRange,
        addedToResults,
        dateRange: {
          start: dateRange.startDate.toISOString(),
          end: dateRange.endDate.toISOString()
        },
        resultDays: result.length,
        totalEventsInResult: result.reduce((sum, item) => sum + item.count, 0)
      });

      console.log(`📊 [Admin Analytics] Events result: ${result.length} days, ${result.reduce((sum, item) => sum + item.count, 0)} total events`);
      return result;
      
    } catch (error) {
      console.error('❌ [Admin Analytics] Error fetching analytics events:', error);
      return [];
    }
  }

  /**
   * Get subscriptions created within date range
   */
  static async getSubscriptionsCreated(dateRange: DateRange): Promise<ChartDataPoint[]> {
    console.log('🔍 [Admin Analytics] Getting subscriptions created...');

    try {
      const db = getAdminFirestore();
      const subscriptionsRef = db.collection(getCollectionName('subscriptions'));

      // Fetch all subscriptions and filter in memory
      const snapshot = await subscriptionsRef.limit(1000).get();
      console.log(`✅ [Admin Analytics] Found ${snapshot.size} subscriptions`);

      // Group by day
      const dailyCounts = new Map<string, number>();

      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;

        if (createdAt) {
          let date: Date;
          if (createdAt.toDate) {
            date = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            date = new Date(createdAt);
          } else {
            return; // Skip invalid dates
          }

          // Filter by date range
          if (date >= dateRange.startDate && date <= dateRange.endDate) {
            const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
          }
        }
      });

      // Convert to chart data
      const result: ChartDataPoint[] = [];
      const currentDate = new Date(dateRange.startDate);

      while (currentDate <= dateRange.endDate) {
        const dayKey = currentDate.toISOString().split('T')[0];
        const count = dailyCounts.get(dayKey) || 0;

        result.push({
          date: dayKey,
          count,
          label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`📊 [Admin Analytics] Subscriptions result: ${result.length} days, ${result.reduce((sum, item) => sum + item.count, 0)} total subscriptions`);
      return result;

    } catch (error) {
      console.error('❌ [Admin Analytics] Error fetching subscriptions:', error);
      return [];
    }
  }

  /**
   * Get subscription revenue within date range (including refunds)
   */
  static async getSubscriptionRevenue(dateRange: DateRange): Promise<ChartDataPoint[]> {
    console.log('🔍 [Admin Analytics] Getting subscription revenue...');

    try {
      const db = getAdminFirestore();
      const subscriptionsRef = db.collection(getCollectionName('subscriptions'));

      // Fetch all subscriptions and filter in memory
      const snapshot = await subscriptionsRef.limit(1000).get();
      console.log(`✅ [Admin Analytics] Found ${snapshot.size} subscriptions for revenue calculation`);

      // Group by day and calculate revenue
      const dailyRevenue = new Map<string, number>();

      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        const amount = data.amount || 0; // Revenue amount
        const refunded = data.refunded || false;
        const refundAmount = data.refundAmount || 0;

        if (createdAt) {
          let date: Date;
          if (createdAt.toDate) {
            date = createdAt.toDate();
          } else if (typeof createdAt === 'string') {
            date = new Date(createdAt);
          } else {
            return; // Skip invalid dates
          }

          // Filter by date range
          if (date >= dateRange.startDate && date <= dateRange.endDate) {
            const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            let revenue = amount;

            // Subtract refunds (making revenue negative if refunded)
            if (refunded) {
              revenue = -Math.abs(refundAmount || amount);
            }

            dailyRevenue.set(dayKey, (dailyRevenue.get(dayKey) || 0) + revenue);
          }
        }
      });

      // Convert to chart data
      const result: ChartDataPoint[] = [];
      const currentDate = new Date(dateRange.startDate);

      while (currentDate <= dateRange.endDate) {
        const dayKey = currentDate.toISOString().split('T')[0];
        const count = dailyRevenue.get(dayKey) || 0;

        result.push({
          date: dayKey,
          count, // Revenue amount (can be negative)
          label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      const totalRevenue = result.reduce((sum, item) => sum + item.count, 0);
      console.log(`📊 [Admin Analytics] Revenue result: ${result.length} days, $${totalRevenue.toFixed(2)} total revenue`);
      return result;

    } catch (error) {
      console.error('❌ [Admin Analytics] Error fetching subscription revenue:', error);
      return [];
    }
  }

  /**
   * Get all dashboard analytics in one call
   */
  static async getAllDashboardAnalytics(dateRange: DateRange) {
    console.log('🔍 [Admin Analytics] Getting all dashboard analytics...');

    try {
      const [accounts, pages, shares, contentChanges, subscriptions, revenue] = await Promise.all([
        this.getNewAccountsCreated(dateRange),
        this.getNewPagesCreated(dateRange),
        this.getAnalyticsEvents(dateRange, 'share_event'),
        this.getAnalyticsEvents(dateRange, 'content_change'),
        this.getSubscriptionsCreated(dateRange),
        this.getSubscriptionRevenue(dateRange)
      ]);

      return {
        newAccountsCreated: accounts,
        newPagesCreated: pages,
        sharesAnalytics: shares,
        editsAnalytics: contentChanges,
        contentChangesAnalytics: contentChanges,
        subscriptionsCreated: subscriptions,
        subscriptionRevenue: revenue,
        pwaInstallsAnalytics: [], // Not implemented yet
        liveVisitorsCount: 0 // Not implemented yet
      };

    } catch (error) {
      console.error('❌ [Admin Analytics] Error fetching all analytics:', error);
      throw error;
    }
  }
}
