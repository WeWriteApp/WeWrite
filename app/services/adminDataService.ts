/**
 * Admin Data Service
 *
 * Provides admin-specific data access that always uses production data,
 * regardless of the current environment. This ensures admin dashboards
 * show real production metrics and data.
 *
 * Updated to use API endpoints instead of direct Firebase calls.
 */

/**
 * Admin-specific data access methods that use API endpoints
 */
export class AdminDataService {

  /**
   * Get analytics events via API
   */
  static async getAnalyticsEvents(limitCount: number = 100) {
    try {
      const response = await fetch(`/api/admin/analytics-data?type=events&limit=${limitCount}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return {
        docs: result.data || [],
        size: result.data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching analytics events:', error);
      throw error;
    }
  }

  /**
   * Get hourly aggregations via API
   */
  static async getHourlyAggregations(limitCount: number = 24) {
    try {
      const response = await fetch(`/api/admin/analytics-data?type=hourly&limit=${limitCount}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return {
        docs: result.data || [],
        size: result.data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching hourly aggregations:', error);
      throw error;
    }
  }

  /**
   * Get daily aggregations via API
   */
  static async getDailyAggregations(limitCount: number = 30) {
    try {
      const response = await fetch(`/api/admin/analytics-data?type=daily&limit=${limitCount}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return {
        docs: result.data || [],
        size: result.data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching daily aggregations:', error);
      throw error;
    }
  }

  /**
   * Get global counters via API
   */
  static async getGlobalCounters() {
    try {
      const response = await fetch('/api/admin/analytics-data?type=global-counters');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return {
        exists: () => !!result.data,
        data: () => result.data
      };
    } catch (error) {
      console.error('Error fetching global counters:', error);
      throw error;
    }
  }

  /**
   * Get token balances via API
   */
  static async getTokenBalances(limitCount: number = 100) {
    try {
      const response = await fetch(`/api/admin/analytics-data?type=token-balances&limit=${limitCount}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return {
        docs: result.data || [],
        size: result.data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching token balances:', error);
      throw error;
    }
  }

  /**
   * Get token allocations via API
   */
  static async getTokenAllocations(limitCount: number = 100) {
    try {
      const response = await fetch(`/api/admin/analytics-data?type=token-allocations&limit=${limitCount}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return {
        docs: result.data || [],
        size: result.data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching token allocations:', error);
      throw error;
    }
  }

  /**
   * Get recent token allocations via API
   */
  static async getRecentTokenAllocations(daysBack: number = 30) {
    try {
      const response = await fetch(`/api/admin/analytics-data?type=recent-token-allocations&days=${daysBack}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return {
        docs: result.data || [],
        size: result.data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching recent token allocations:', error);
      throw error;
    }
  }

  /**
   * Get subscription conversion funnel events via API
   */
  static async getSubscriptionFunnelEvents() {
    try {
      const response = await fetch('/api/admin/analytics-data?type=subscription-funnel');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return result.data || {};
    } catch (error) {
      console.error('Error fetching subscription funnel:', error);
      throw error;
    }
  }

  /**
   * Get users data via API
   */
  static async getUsers(limitCount: number = 100) {
    try {
      const response = await fetch(`/api/admin/analytics-data?type=users&limit=${limitCount}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return {
        docs: result.data || [],
        size: result.data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  /**
   * Get pages data via API
   */
  static async getPages(limitCount: number = 100) {
    try {
      const response = await fetch(`/api/admin/analytics-data?type=pages&limit=${limitCount}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return {
        docs: result.data || [],
        size: result.data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching pages:', error);
      throw error;
    }
  }

  /**
   * Get subscriptions data via API
   */
  static async getSubscriptions(limitCount: number = 100) {
    try {
      const response = await fetch(`/api/admin/analytics-data?type=subscriptions&limit=${limitCount}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return {
        docs: result.data || [],
        size: result.data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }
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
          analytics_events: 'analytics_events',
          analytics_hourly: 'analytics_hourly',
          analytics_daily: 'analytics_daily',
          analytics_counters: 'analytics_counters',
          tokenBalances: 'tokenBalances',
          tokenAllocations: 'tokenAllocations',
          users: 'users',
          pages: 'pages',
          subscriptions: 'subscriptions'
        }
      };
    } catch (error) {
      console.error('Error getting admin dashboard data:', error);
      throw error;
    }
  }
}

export default AdminDataService;
