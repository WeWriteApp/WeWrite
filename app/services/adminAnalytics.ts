/**
 * Admin Analytics Service - Uses Firebase Admin SDK for admin dashboard
 * This service bypasses Firestore security rules and is only for admin use
 *
 * DATA SOURCES:
 * - User/Page/Event data: Firebase (source of truth for content)
 * - Subscription/Revenue data: Stripe (source of truth for payments)
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionNameAsync } from '../utils/environmentConfig';
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
   * OPTIMIZED: Uses indexed date range query instead of fetching all docs
   */
  static async getNewAccountsCreated(dateRange: DateRange): Promise<ChartDataPoint[]> {
    try {
      const db = getAdminFirestore();
      const usersCollectionName = await getCollectionNameAsync('users');
      const usersRef = db.collection(usersCollectionName);

      // OPTIMIZED: Use indexed query with date range filter instead of fetching 1000 docs
      // CRITICAL FIX: Convert Date objects to ISO strings for consistent comparison
      // Users store createdAt as ISO strings (e.g., "2024-12-15T10:30:00.000Z")
      const startDateStr = dateRange.startDate.toISOString();
      const endDateStr = dateRange.endDate.toISOString();

      const snapshot = await usersRef
        .where('createdAt', '>=', startDateStr)
        .where('createdAt', '<=', endDateStr)
        .orderBy('createdAt', 'asc')
        .get();
      
      // Group by day
      const dailyCounts = new Map<string, number>();
      
      // OPTIMIZED: No need to filter by date - already filtered at query level
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

          const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
          dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
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

      return result;

    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
  }

  /**
   * Get new pages created within date range
   * OPTIMIZED: Uses indexed date range query instead of fetching all docs
   */
  static async getNewPagesCreated(dateRange: DateRange): Promise<PagesDataPoint[]> {
    try {
      const db = getAdminFirestore();
      const pagesCollectionName = await getCollectionNameAsync('pages');
      const pagesRef = db.collection(pagesCollectionName);

      // OPTIMIZED: Use indexed query with date range filter
      // Index exists: (deleted, createdAt) - we use it to filter non-deleted pages in date range
      // CRITICAL FIX: Convert Date objects to ISO strings for consistent comparison
      // Pages store createdAt as ISO strings (e.g., "2024-12-15T10:30:00.000Z")
      const startDateStr = dateRange.startDate.toISOString();
      const endDateStr = dateRange.endDate.toISOString();

      const snapshot = await pagesRef
        .where('deleted', '==', false)
        .where('createdAt', '>=', startDateStr)
        .where('createdAt', '<=', endDateStr)
        .orderBy('createdAt', 'asc')
        .get();
      
      // Group by day - OPTIMIZED: Already filtered at query level (deleted=false, date range)
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

          const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
          dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
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

      return result;

    } catch (error) {
      console.error('Error fetching pages:', error);
      return [];
    }
  }

  /**
   * Get analytics events (shares, content changes, etc.)
   * For content_change events, also aggregates character counts
   * OPTIMIZED: Uses indexed query (eventType, timestamp) instead of fetching all docs
   */
  static async getAnalyticsEvents(dateRange: DateRange, eventType?: string): Promise<ChartDataPoint[]> {
    try {
      const db = getAdminFirestore();
      const admin = getFirebaseAdmin();
      if (!admin) {
        throw new Error('Firebase Admin not initialized');
      }
      const eventsCollectionName = await getCollectionNameAsync('analytics_events');
      const eventsRef = db.collection(eventsCollectionName);

      // OPTIMIZED: Build query with index - uses (eventType, timestamp) index
      // FIX: Use Firestore Timestamp objects for proper comparison with stored Timestamp data
      const startTimestamp = admin.firestore.Timestamp.fromDate(dateRange.startDate);
      const endTimestamp = admin.firestore.Timestamp.fromDate(dateRange.endDate);

      let query = eventsRef
        .where('timestamp', '>=', startTimestamp)
        .where('timestamp', '<=', endTimestamp)
        .orderBy('timestamp', 'asc');

      // If event type is specified, add filter (uses eventType + timestamp index)
      if (eventType) {
        query = eventsRef
          .where('eventType', '==', eventType)
          .where('timestamp', '>=', startTimestamp)
          .where('timestamp', '<=', endTimestamp)
          .orderBy('timestamp', 'asc');
      }

      const snapshot = await query.get();

      // Group by day - track counts and character totals for content_change
      const dailyData = new Map<string, {
        count: number;
        charactersAdded: number;
        charactersDeleted: number;
      }>();

      // OPTIMIZED: Already filtered at query level
      snapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp;

        if (timestamp) {
          let date: Date;
          if (timestamp.toDate) {
            date = timestamp.toDate();
          } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
          } else {
            return; // Skip invalid dates
          }

          const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

          const existing = dailyData.get(dayKey) || { count: 0, charactersAdded: 0, charactersDeleted: 0 };
          existing.count += 1;

          // For content_change events, aggregate character data
          if (eventType === 'content_change') {
            existing.charactersAdded += (data.charactersAdded || 0);
            existing.charactersDeleted += (data.charactersDeleted || 0);
          }

          dailyData.set(dayKey, existing);
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

      return result;

    } catch (error) {
      console.error('Error fetching analytics events:', error);
      return [];
    }
  }

  /**
   * Get subscriptions created within date range
   * SOURCE OF TRUTH: Stripe API
   */
  static async getSubscriptionsCreated(dateRange: DateRange): Promise<ChartDataPoint[]> {
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

      return result;

    } catch (error) {
      console.error('Error fetching subscriptions from Stripe:', error);
      return [];
    }
  }

  /**
   * Get subscription revenue within date range (including refunds)
   * SOURCE OF TRUTH: Stripe Charges API
   */
  static async getSubscriptionRevenue(dateRange: DateRange): Promise<ChartDataPoint[]> {
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

      return result;

    } catch (error) {
      console.error('Error fetching subscription revenue from Stripe:', error);
      return [];
    }
  }

  /**
   * Get all dashboard analytics in one call
   */
  static async getAllDashboardAnalytics(dateRange: DateRange) {
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
      console.error('Error fetching all analytics:', error);
      throw error;
    }
  }

  /**
   * Get page views analytics within date range
   * OPTIMIZED: Uses date field query instead of fetching 5000 docs
   */
  static async getPageViewsAnalytics(dateRange: DateRange): Promise<any[]> {
    try {
      const db = getAdminFirestore();
      const pageViewsCollectionName = await getCollectionNameAsync('pageViews');
      const pageViewsRef = db.collection(pageViewsCollectionName);

      // Format dates as strings for comparison (YYYY-MM-DD format used in date field)
      const startDateStr = dateRange.startDate.toISOString().split('T')[0];
      const endDateStr = dateRange.endDate.toISOString().split('T')[0];

      // OPTIMIZED: Query by date field range instead of fetching 5000 docs
      // Uses index: (date, totalViews)
      const snapshot = await pageViewsRef
        .where('date', '>=', startDateStr)
        .where('date', '<=', endDateStr)
        .orderBy('date', 'asc')
        .get();

      if (snapshot.empty) {
        return [];
      }

      // Group page views by date - OPTIMIZED: Already filtered at query level
      const dailyViews = new Map<string, { totalViews: number; uniqueViews: number; pageIds: Set<string> }>();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const docId = doc.id;
        const dateStr = data.date || docId.split('_').pop(); // Use date field or extract from ID

        if (!dateStr) return;

        if (!dailyViews.has(dateStr)) {
          dailyViews.set(dateStr, {
            totalViews: 0,
            uniqueViews: 0,
            pageIds: new Set()
          });
        }

        const dayData = dailyViews.get(dateStr)!;
        dayData.totalViews += data.totalViews || 0;

        // Extract pageId from document ID or use pageId field
        const pageId = data.pageId || docId.substring(0, docId.lastIndexOf('_'));
        if (pageId) {
          dayData.pageIds.add(pageId);
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

      return result;

    } catch (error) {
      console.error('Error fetching page views analytics:', error);
      throw error;
    }
  }

  /**
   * Get replies analytics within date range
   * Groups replies by type (agree, disagree, neutral) for stacked bar chart
   */
  static async getRepliesAnalytics(dateRange: DateRange): Promise<{
    date: string;
    label: string;
    agree: number;
    disagree: number;
    neutral: number;
    total: number;
  }[]> {
    try {
      const db = getAdminFirestore();
      const pagesCollectionName = await getCollectionNameAsync('pages');
      const pagesRef = db.collection(pagesCollectionName);

      // Create a map to aggregate by date
      const dailyReplies = new Map<string, { agree: number; disagree: number; neutral: number }>();

      // Initialize all dates in range
      const currentDate = new Date(dateRange.startDate);
      while (currentDate <= dateRange.endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dailyReplies.set(dateStr, { agree: 0, disagree: 0, neutral: 0 });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Query pages that are replies (have replyTo field) within the date range
      const startDateStr = dateRange.startDate.toISOString();
      const endDateStr = dateRange.endDate.toISOString();

      // Get all reply pages in the date range
      const snapshot = await pagesRef
        .where('deleted', '==', false)
        .where('createdAt', '>=', startDateStr)
        .where('createdAt', '<=', endDateStr)
        .orderBy('createdAt', 'asc')
        .get();

      snapshot.docs.forEach(doc => {
        const data = doc.data();

        // Only count pages that have a replyTo field (are replies)
        if (!data.replyTo) return;

        const createdAt = data.createdAt;
        if (!createdAt) return;

        let dateStr: string;
        if (typeof createdAt === 'string') {
          dateStr = createdAt.split('T')[0];
        } else if (createdAt.toDate) {
          dateStr = createdAt.toDate().toISOString().split('T')[0];
        } else {
          return;
        }

        if (!dailyReplies.has(dateStr)) return;

        const dayData = dailyReplies.get(dateStr)!;

        // Normalize replyType - 'standard' and null map to 'neutral'
        const replyType = data.replyType;
        if (replyType === 'agree') {
          dayData.agree++;
        } else if (replyType === 'disagree') {
          dayData.disagree++;
        } else {
          // 'neutral', 'standard', null, undefined all count as neutral
          dayData.neutral++;
        }
      });

      // Convert to array format for stacked bar chart
      const result = Array.from(dailyReplies.entries()).map(([date, data]) => ({
        date,
        label: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        agree: data.agree,
        disagree: data.disagree,
        neutral: data.neutral,
        total: data.agree + data.disagree + data.neutral
      }));

      // Sort by date
      result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return result;

    } catch (error) {
      console.error('Error fetching replies analytics:', error);
      throw error;
    }
  }

  /**
   * Get notifications sent analytics within date range
   * Combines email logs and push notification data into stacked bar chart format
   */
  static async getNotificationsSentAnalytics(dateRange: DateRange): Promise<{
    date: string;
    label: string;
    emails: number;
    pushNotifications: number;
    total: number;
  }[]> {
    try {
      const db = getAdminFirestore();
      const admin = getFirebaseAdmin();
      if (!admin) {
        throw new Error('Firebase Admin not initialized');
      }

      // Create a map to aggregate by date
      const dailyNotifications = new Map<string, { emails: number; pushNotifications: number }>();

      // Initialize all dates in range
      const currentDate = new Date(dateRange.startDate);
      while (currentDate <= dateRange.endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dailyNotifications.set(dateStr, { emails: 0, pushNotifications: 0 });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Fetch email logs from emailLogs collection
      const emailLogsCollectionName = await getCollectionNameAsync('emailLogs');
      const emailLogsRef = db.collection(emailLogsCollectionName);

      // Query emails by sentAt field (ISO string format)
      const startDateStr = dateRange.startDate.toISOString();
      const endDateStr = dateRange.endDate.toISOString();

      try {
        const emailSnapshot = await emailLogsRef
          .where('sentAt', '>=', startDateStr)
          .where('sentAt', '<=', endDateStr)
          .get();

        emailSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const sentAt = data.sentAt;
          if (sentAt) {
            const dateStr = sentAt.split('T')[0];
            if (dailyNotifications.has(dateStr)) {
              const dayData = dailyNotifications.get(dateStr)!;
              dayData.emails++;
            }
          }
        });
      } catch (error) {
        console.error('Error fetching email logs:', error);
        // Continue with push notifications even if emails fail
      }

      // Fetch push notifications from analytics_events collection
      const eventsCollectionName = await getCollectionNameAsync('analytics_events');
      const eventsRef = db.collection(eventsCollectionName);

      // Use Firestore Timestamp objects for proper comparison
      const startTimestamp = admin.firestore.Timestamp.fromDate(dateRange.startDate);
      const endTimestamp = admin.firestore.Timestamp.fromDate(dateRange.endDate);

      try {
        const pushSnapshot = await eventsRef
          .where('eventType', '==', 'pwa_notification_sent')
          .where('timestamp', '>=', startTimestamp)
          .where('timestamp', '<=', endTimestamp)
          .get();

        pushSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const timestamp = data.timestamp;
          if (timestamp) {
            // Handle both Firestore Timestamp and ISO string
            let dateStr: string;
            if (timestamp.toDate) {
              dateStr = timestamp.toDate().toISOString().split('T')[0];
            } else if (typeof timestamp === 'string') {
              dateStr = timestamp.split('T')[0];
            } else {
              return;
            }
            if (dailyNotifications.has(dateStr)) {
              const dayData = dailyNotifications.get(dateStr)!;
              dayData.pushNotifications++;
            }
          }
        });
      } catch (error) {
        console.error('Error fetching push notifications:', error);
        // Continue even if push notifications fail
      }

      // Convert to array format for stacked bar chart
      const result = Array.from(dailyNotifications.entries()).map(([date, data]) => ({
        date,
        label: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        emails: data.emails,
        pushNotifications: data.pushNotifications,
        total: data.emails + data.pushNotifications
      }));

      // Sort by date
      result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return result;

    } catch (error) {
      console.error('Error fetching notifications sent analytics:', error);
      throw error;
    }
  }
}
