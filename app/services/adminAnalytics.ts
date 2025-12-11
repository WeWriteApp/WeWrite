/**
 * Admin Analytics Service - Uses Firebase Admin SDK for admin dashboard
 * This service bypasses Firestore security rules and is only for admin use
 *
 * DATA SOURCES:
 * - User/Page/Event data: Firebase (source of truth for content)
 * - Subscription/Revenue data: Stripe (source of truth for payments)
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName } from '../utils/environmentConfig';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';

// Initialize Stripe - lazy initialization to avoid issues during build
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(getStripeSecretKey() || '', {
      apiVersion: '2024-06-20'
    });
  }
  return stripeInstance;
}

// Helper function to get Firestore instance from Firebase Admin
function getAdminFirestore() {
  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new Error('Firebase Admin SDK not initialized');
  }
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
   * For content_change events, also aggregates character counts
   */
  static async getAnalyticsEvents(dateRange: DateRange, eventType?: string): Promise<ChartDataPoint[]> {
    console.log('🔍 [Admin Analytics] Getting analytics events...', { eventType });
    
    try {
      const db = getAdminFirestore();
      const eventsRef = db.collection(getCollectionName('analytics_events'));
      
      // Fetch all events and filter in memory (simple and reliable)
      const snapshot = await eventsRef.limit(1000).get();
      console.log(`✅ [Admin Analytics] Found ${snapshot.size} analytics events`);
      
      // Group by day - track counts and character totals for content_change
      const dailyData = new Map<string, { 
        count: number; 
        charactersAdded: number; 
        charactersDeleted: number; 
      }>();
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
            
            const existing = dailyData.get(dayKey) || { count: 0, charactersAdded: 0, charactersDeleted: 0 };
            existing.count += 1;
            
            // For content_change events, aggregate character data
            if (eventType === 'content_change') {
              existing.charactersAdded += (data.charactersAdded || 0);
              existing.charactersDeleted += (data.charactersDeleted || 0);
            }
            
            dailyData.set(dayKey, existing);
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
        const dayData = dailyData.get(dayKey) || { count: 0, charactersAdded: 0, charactersDeleted: 0 };
        
        // Base data point
        const dataPoint: any = {
          date: dayKey,
          count: dayData.count,
          label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        };
        
        // Add character data for content_change events
        if (eventType === 'content_change') {
          dataPoint.charactersAdded = dayData.charactersAdded;
          dataPoint.charactersDeleted = dayData.charactersDeleted;
          dataPoint.netChange = dayData.charactersAdded - dayData.charactersDeleted;
        }
        
        result.push(dataPoint);
        
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
   * SOURCE OF TRUTH: Stripe API
   */
  static async getSubscriptionsCreated(dateRange: DateRange): Promise<ChartDataPoint[]> {
    console.log('🔍 [Admin Analytics] Getting subscriptions created from Stripe (source of truth)...');

    try {
      const stripe = getStripe();

      // Convert dates to Unix timestamps for Stripe API
      const startTimestamp = Math.floor(dateRange.startDate.getTime() / 1000);
      const endTimestamp = Math.floor(dateRange.endDate.getTime() / 1000);

      // Fetch subscriptions from Stripe within date range
      // Use created filter to get subscriptions created in the date range
      const subscriptions: Stripe.Subscription[] = [];
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const params: Stripe.SubscriptionListParams = {
          limit: 100,
          created: {
            gte: startTimestamp,
            lte: endTimestamp
          }
        };
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const response = await stripe.subscriptions.list(params);
        subscriptions.push(...response.data);
        hasMore = response.has_more;
        if (response.data.length > 0) {
          startingAfter = response.data[response.data.length - 1].id;
        }
      }

      console.log(`✅ [Admin Analytics] Found ${subscriptions.length} subscriptions from Stripe`);

      // Group by day
      const dailyCounts = new Map<string, number>();

      for (const sub of subscriptions) {
        const date = new Date(sub.created * 1000);
        const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
      }

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
      console.error('❌ [Admin Analytics] Error fetching subscriptions from Stripe:', error);
      return [];
    }
  }

  /**
   * Get subscription revenue within date range (including refunds)
   * SOURCE OF TRUTH: Stripe Charges API
   */
  static async getSubscriptionRevenue(dateRange: DateRange): Promise<ChartDataPoint[]> {
    console.log('🔍 [Admin Analytics] Getting subscription revenue from Stripe (source of truth)...');

    try {
      const stripe = getStripe();

      // Convert dates to Unix timestamps for Stripe API
      const startTimestamp = Math.floor(dateRange.startDate.getTime() / 1000);
      const endTimestamp = Math.floor(dateRange.endDate.getTime() / 1000);

      // Group by day and calculate revenue
      const dailyRevenue = new Map<string, number>();

      // Fetch successful charges from Stripe within date range
      let hasMore = true;
      let startingAfter: string | undefined;
      let totalCharges = 0;

      while (hasMore) {
        const params: Stripe.ChargeListParams = {
          limit: 100,
          created: {
            gte: startTimestamp,
            lte: endTimestamp
          }
        };
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const response = await stripe.charges.list(params);

        for (const charge of response.data) {
          // Only count successful charges
          if (charge.status === 'succeeded' && charge.paid) {
            const date = new Date(charge.created * 1000);
            const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

            // Amount is in cents, convert to dollars
            let revenue = charge.amount / 100;

            // Subtract refunds
            if (charge.refunded) {
              revenue = -(charge.amount_refunded / 100);
            } else if (charge.amount_refunded > 0) {
              // Partial refund
              revenue = (charge.amount - charge.amount_refunded) / 100;
            }

            dailyRevenue.set(dayKey, (dailyRevenue.get(dayKey) || 0) + revenue);
            totalCharges++;
          }
        }

        hasMore = response.has_more;
        if (response.data.length > 0) {
          startingAfter = response.data[response.data.length - 1].id;
        }
      }

      console.log(`✅ [Admin Analytics] Found ${totalCharges} charges from Stripe`);

      // Convert to chart data
      const result: ChartDataPoint[] = [];
      const currentDate = new Date(dateRange.startDate);

      while (currentDate <= dateRange.endDate) {
        const dayKey = currentDate.toISOString().split('T')[0];
        const count = dailyRevenue.get(dayKey) || 0;

        result.push({
          date: dayKey,
          count, // Revenue amount in dollars (can be negative for refunds)
          label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      const totalRevenue = result.reduce((sum, item) => sum + item.count, 0);
      console.log(`📊 [Admin Analytics] Revenue result: ${result.length} days, $${totalRevenue.toFixed(2)} total revenue`);
      return result;

    } catch (error) {
      console.error('❌ [Admin Analytics] Error fetching subscription revenue from Stripe:', error);
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

  /**
   * Get page views analytics within date range
   */
  static async getPageViewsAnalytics(dateRange: DateRange): Promise<any[]> {
    console.log('🔍 [Admin Analytics] Getting page views analytics...');

    try {
      const db = getAdminFirestore();
      const pageViewsRef = db.collection(getCollectionName('pageViews'));

      // Get all page view documents within the date range
      const snapshot = await pageViewsRef.limit(5000).get();

      if (snapshot.empty) {
        console.log('📊 [Admin Analytics] No page views found');
        return [];
      }

      // Group page views by date
      const dailyViews = new Map<string, { totalViews: number; uniqueViews: number; pageIds: Set<string> }>();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const docId = doc.id;

        // Extract date from document ID (format: pageId_YYYY-MM-DD)
        const datePart = docId.split('_').pop();
        if (!datePart || !datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return; // Skip invalid document IDs
        }

        const docDate = new Date(datePart);

        // Check if date is within range
        if (docDate >= dateRange.startDate && docDate <= dateRange.endDate) {
          const dateStr = datePart;

          if (!dailyViews.has(dateStr)) {
            dailyViews.set(dateStr, {
              totalViews: 0,
              uniqueViews: 0,
              pageIds: new Set()
            });
          }

          const dayData = dailyViews.get(dateStr)!;
          dayData.totalViews += data.totalViews || 0;

          // Extract pageId from document ID
          const pageId = docId.substring(0, docId.lastIndexOf('_'));
          if (pageId) {
            dayData.pageIds.add(pageId);
          }
        }
      });

      // Convert to array and calculate unique views
      const result = Array.from(dailyViews.entries()).map(([date, data]) => ({
        date,
        totalViews: data.totalViews,
        uniqueViews: data.pageIds.size, // Number of unique pages that got views
        label: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      }));

      // Sort by date
      result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      console.log(`📊 [Admin Analytics] Found ${result.length} days of page view data`);
      return result;

    } catch (error) {
      console.error('❌ [Admin Analytics] Error fetching page views analytics:', error);
      throw error;
    }
  }
}
