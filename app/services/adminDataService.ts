/**
 * Admin Data Service
 * 
 * Provides admin-specific data access that always uses production data,
 * regardless of the current environment. This ensures admin dashboards
 * show real production metrics and data.
 */

import { collection, query, limit, getDocs, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Get production collection name (no environment prefix)
 * Admin dashboards should always see production data
 */
export const getProductionCollectionName = (baseName: string): string => {
  // Always return base collection name for admin access (production data)
  return baseName;
};

/**
 * Admin-specific data access methods that always use production collections
 */
export class AdminDataService {
  
  /**
   * Get analytics events from production data
   */
  static async getAnalyticsEvents(limitCount: number = 100) {
    const eventsQuery = query(
      collection(db, getProductionCollectionName('analytics_events')),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    return await getDocs(eventsQuery);
  }

  /**
   * Get hourly aggregations from production data
   */
  static async getHourlyAggregations(limitCount: number = 24) {
    const hourlyQuery = query(
      collection(db, getProductionCollectionName('analytics_hourly')),
      orderBy('datetime', 'desc'),
      limit(limitCount)
    );
    
    return await getDocs(hourlyQuery);
  }

  /**
   * Get daily aggregations from production data
   */
  static async getDailyAggregations(limitCount: number = 30) {
    const dailyQuery = query(
      collection(db, getProductionCollectionName('analytics_daily')),
      orderBy('date', 'desc'),
      limit(limitCount)
    );
    
    return await getDocs(dailyQuery);
  }

  /**
   * Get global counters from production data
   */
  static async getGlobalCounters() {
    const globalCountersRef = doc(db, getProductionCollectionName('analytics_counters'), 'global');
    return await getDoc(globalCountersRef);
  }

  /**
   * Get token balances from production data
   */
  static async getTokenBalances(limitCount: number = 100) {
    const balancesQuery = query(
      collection(db, getProductionCollectionName('tokenBalances')),
      limit(limitCount)
    );
    
    return await getDocs(balancesQuery);
  }

  /**
   * Get token allocations from production data
   */
  static async getTokenAllocations(limitCount: number = 100) {
    const allocationsQuery = query(
      collection(db, getProductionCollectionName('tokenAllocations')),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    return await getDocs(allocationsQuery);
  }

  /**
   * Get recent token allocations from production data
   */
  static async getRecentTokenAllocations(daysBack: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const recentQuery = query(
      collection(db, getProductionCollectionName('tokenAllocations')),
      where('createdAt', '>=', cutoffDate),
      orderBy('createdAt', 'desc')
    );
    
    return await getDocs(recentQuery);
  }

  /**
   * Get subscription conversion funnel events from production data
   */
  static async getSubscriptionFunnelEvents() {
    const funnelActions = [
      'subscription_flow_started',
      'subscription_abandoned_before_payment',
      'subscription_abandoned_during_payment',
      'subscription_completed',
      'first_token_allocation',
      'ongoing_token_allocation'
    ];

    const results: Record<string, any> = {};

    for (const action of funnelActions) {
      const eventQuery = query(
        collection(db, getProductionCollectionName('analytics_events')),
        where('category', '==', 'subscription'),
        where('action', '==', action),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(eventQuery);
      results[action] = {
        count: snapshot.size,
        events: snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      };
    }

    return results;
  }

  /**
   * Get production users data
   */
  static async getUsers(limitCount: number = 100) {
    const usersQuery = query(
      collection(db, getProductionCollectionName('users')),
      limit(limitCount)
    );
    
    return await getDocs(usersQuery);
  }

  /**
   * Get production pages data
   */
  static async getPages(limitCount: number = 100) {
    const pagesQuery = query(
      collection(db, getProductionCollectionName('pages')),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    return await getDocs(pagesQuery);
  }

  /**
   * Get production subscriptions data
   */
  static async getSubscriptions(limitCount: number = 100) {
    const subscriptionsQuery = query(
      collection(db, getProductionCollectionName('subscriptions')),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    return await getDocs(subscriptionsQuery);
  }

  /**
   * Get comprehensive admin dashboard data
   */
  static async getDashboardData() {
    try {
      const [
        analyticsEvents,
        hourlyAggregations,
        dailyAggregations,
        globalCounters,
        tokenBalances,
        tokenAllocations,
        users,
        pages,
        subscriptions
      ] = await Promise.all([
        this.getAnalyticsEvents(50),
        this.getHourlyAggregations(24),
        this.getDailyAggregations(7),
        this.getGlobalCounters(),
        this.getTokenBalances(50),
        this.getTokenAllocations(50),
        this.getUsers(50),
        this.getPages(50),
        this.getSubscriptions(50)
      ]);

      return {
        analytics: {
          events: analyticsEvents.size,
          hourlyAggregations: hourlyAggregations.size,
          dailyAggregations: dailyAggregations.size,
          hasGlobalCounters: globalCounters.exists()
        },
        tokens: {
          balances: tokenBalances.size,
          allocations: tokenAllocations.size
        },
        content: {
          users: users.size,
          pages: pages.size
        },
        subscriptions: {
          total: subscriptions.size
        },
        collections: {
          analytics_events: getProductionCollectionName('analytics_events'),
          analytics_hourly: getProductionCollectionName('analytics_hourly'),
          analytics_daily: getProductionCollectionName('analytics_daily'),
          analytics_counters: getProductionCollectionName('analytics_counters'),
          tokenBalances: getProductionCollectionName('tokenBalances'),
          tokenAllocations: getProductionCollectionName('tokenAllocations'),
          users: getProductionCollectionName('users'),
          pages: getProductionCollectionName('pages'),
          subscriptions: getProductionCollectionName('subscriptions')
        }
      };
    } catch (error) {
      console.error('Error getting admin dashboard data:', error);
      throw error;
    }
  }
}

export default AdminDataService;
