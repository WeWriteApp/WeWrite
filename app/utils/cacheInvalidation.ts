"use client";

/**
 * Enhanced Cache Invalidation System for WeWrite
 *
 * Comprehensive cache invalidation that maintains data consistency
 * across all cache systems while preserving cache efficiency
 */

// Import our cache systems (conditionally for server-side compatibility)
let pageCache: any, pagesListCache: any, userCache: any, searchCache: any, analyticsCache: any;

if (typeof window === 'undefined') {
  // Server-side imports
  try {
    pageCache = require('./pageCache').pageCache;
    pagesListCache = require('./pagesListCache').pagesListCache;
    userCache = require('./userCache').userCache;
    searchCache = require('./searchCache').searchCache;
    analyticsCache = require('./analyticsCache').analyticsCache;
  } catch (error) {
    console.warn('Cache systems not available:', error.message);
  }
}

// Legacy type definitions (maintained for backward compatibility)
type CacheInvalidatorFunction = (userId?: string) => void;
type CacheType = 'recentActivity' | 'userPages' | 'staticActivity';

interface CacheInvalidators {
  recentActivity: CacheInvalidatorFunction[];
  userPages: CacheInvalidatorFunction[];
  staticActivity: CacheInvalidatorFunction[];
}

// Enhanced invalidation types
interface InvalidationEvent {
  type: 'page' | 'user' | 'search' | 'analytics' | 'global';
  action: 'create' | 'update' | 'delete' | 'bulk_update';
  entityId?: string;
  relatedIds?: string[];
  metadata?: any;
  timestamp: number;
}



// Store references to cache invalidation functions
const cacheInvalidators: CacheInvalidators = {
  recentActivity: [],
  userPages: [],
  staticActivity: []
};

/**
 * Register a cache invalidation function for recent activity
 */
export const registerRecentActivityInvalidator = (invalidator: CacheInvalidatorFunction): void => {
  if (typeof invalidator === 'function') {
    cacheInvalidators.recentActivity.push(invalidator);
  }
};

/**
 * Register a cache invalidation function for user pages
 */
export const registerUserPagesInvalidator = (invalidator: CacheInvalidatorFunction): void => {
  if (typeof invalidator === 'function') {
    cacheInvalidators.userPages.push(invalidator);
  }
};

/**
 * Register a cache invalidation function for static activity
 */
export const registerStaticActivityInvalidator = (invalidator: CacheInvalidatorFunction): void => {
  if (typeof invalidator === 'function') {
    cacheInvalidators.staticActivity.push(invalidator);
  }
};

/**
 * Unregister a cache invalidation function
 */
export const unregisterCacheInvalidator = (type: CacheType, invalidator: CacheInvalidatorFunction): void => {
  if (cacheInvalidators[type]) {
    const index = cacheInvalidators[type].indexOf(invalidator);
    if (index > -1) {
      cacheInvalidators[type].splice(index, 1);
    }
  }
};

/**
 * Invalidate recent activity caches
 * Called when a new page is created or activity changes
 */
export const invalidateRecentActivityCache = (): void => {
  console.log('Invalidating recent activity cache');
  cacheInvalidators.recentActivity.forEach(invalidator => {
    try {
      invalidator();
    } catch (error) {
      console.error('Error calling recent activity cache invalidator:', error);
    }
  });
};

/**
 * Invalidate user pages caches
 * Called when a user's pages change (create, update, delete)
 */
export const invalidateUserPagesCache = (userId: string): void => {
  console.log('Invalidating user pages cache for user:', userId);
  cacheInvalidators.userPages.forEach(invalidator => {
    try {
      invalidator(userId);
    } catch (error) {
      console.error('Error calling user pages cache invalidator:', error);
    }
  });

  // Clear the new API cache
  if (typeof window !== 'undefined' && (window as any).clearUserPagesCache) {
    (window as any).clearUserPagesCache(userId);
  }

  // Clear localStorage caches that might be stale
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      // Clear all user pages related cache entries
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes(`user_pages_${userId}`) || key.includes(`wewrite_pages_${userId}`))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('🗑️ Cleared localStorage cache:', key);
      });
    } catch (error) {
      console.error('Error clearing localStorage caches:', error);
    }
  }
};

/**
 * Invalidate static activity caches
 * Called when activity data needs to be refreshed
 */
export const invalidateStaticActivityCache = (): void => {
  console.log('Invalidating static activity cache');
  cacheInvalidators.staticActivity.forEach(invalidator => {
    try {
      invalidator();
    } catch (error) {
      console.error('Error calling static activity cache invalidator:', error);
    }
  });
};

/**
 * Invalidate all caches related to page creation
 * This is the main function to call when a new page is created
 */
export const invalidatePageCreationCaches = (userId: string): void => {
  console.log('Invalidating all page creation related caches for user:', userId);
  console.log('Registered invalidators:', {
    recentActivity: cacheInvalidators.recentActivity.length,
    userPages: cacheInvalidators.userPages.length,
    staticActivity: cacheInvalidators.staticActivity.length
  });

  // Invalidate recent activity caches
  invalidateRecentActivityCache();

  // Invalidate static activity caches
  invalidateStaticActivityCache();

  // Invalidate user pages caches
  invalidateUserPagesCache(userId);

  // Also trigger global cache invalidation system
  try {
    const { invalidateUserPages, invalidateRecentActivity } = require('./globalCacheInvalidation');
    console.log('Triggering global cache invalidation system');
    invalidateUserPages(userId);
    invalidateRecentActivity();
  } catch (error) {
    console.error('Error triggering global cache invalidation:', error);
  }

  // Also dispatch global events for components that might not be registered
  if (typeof window !== 'undefined') {
    console.log('Dispatching global cache invalidation events');
    window.dispatchEvent(new CustomEvent('invalidate-recent-activity'));
    window.dispatchEvent(new CustomEvent('invalidate-user-pages', { detail: { userId } }));
    window.dispatchEvent(new CustomEvent('invalidate-static-activity'));
  }

  console.log('Cache invalidation completed');
};

/**
 * Clear all registered cache invalidators
 * Useful for cleanup during component unmounting
 */
export const clearAllCacheInvalidators = (): void => {
  console.log('Clearing all cache invalidators');
  cacheInvalidators.recentActivity = [];
  cacheInvalidators.userPages = [];
  cacheInvalidators.staticActivity = [];
};

// Initialize debug utilities in development
/**
 * Enhanced Cache Invalidation System
 *
 * Smart invalidation that works across all our cache systems
 */
class EnhancedCacheInvalidation {
  /**
   * Invalidate page-related caches
   */
  static async invalidatePageUpdate(pageId: string, userId?: string): Promise<void> {
    console.log(`🗑️  ENHANCED INVALIDATION: Page update ${pageId}`);

    try {
      // Invalidate specific page cache
      if (typeof pageCache !== 'undefined') {
        pageCache.invalidate(pageId);
      }

      // Invalidate pages list cache for the user
      if (typeof pagesListCache !== 'undefined' && userId) {
        pagesListCache.invalidateUser(userId);
      }

      // Clear search results that might contain this page
      if (typeof searchCache !== 'undefined') {
        searchCache.clearByType('pages');
      }

      // Legacy invalidation for backward compatibility
      invalidateAllCaches(userId);

      console.log(`✅ Enhanced page invalidation completed for ${pageId}`);
    } catch (error) {
      console.error('❌ Error in enhanced page invalidation:', error);
    }
  }

  static async invalidatePageDelete(pageId: string, userId?: string): Promise<void> {
    console.log(`🗑️  ENHANCED INVALIDATION: Page delete ${pageId}`);

    try {
      // More aggressive invalidation for deletions
      if (typeof pageCache !== 'undefined') {
        pageCache.invalidate(pageId);
      }

      if (typeof pagesListCache !== 'undefined' && userId) {
        pagesListCache.invalidateUser(userId);
      }

      if (typeof searchCache !== 'undefined') {
        searchCache.clearByType('pages');
      }

      if (typeof analyticsCache !== 'undefined') {
        analyticsCache.clearByType('pages');
      }

      // Legacy invalidation
      invalidateAllCaches(userId);

      console.log(`✅ Enhanced page deletion invalidation completed for ${pageId}`);
    } catch (error) {
      console.error('❌ Error in enhanced page deletion invalidation:', error);
    }
  }

  static async invalidateUserUpdate(userId: string): Promise<void> {
    console.log(`🗑️  ENHANCED INVALIDATION: User update ${userId}`);

    try {
      // Invalidate user-specific caches
      if (typeof userCache !== 'undefined') {
        userCache.invalidateUser(userId);
      }

      if (typeof pagesListCache !== 'undefined') {
        pagesListCache.invalidateUser(userId);
      }

      if (typeof searchCache !== 'undefined') {
        searchCache.clearByType('users');
      }

      // Legacy invalidation
      invalidateAllCaches(userId);

      console.log(`✅ Enhanced user invalidation completed for ${userId}`);
    } catch (error) {
      console.error('❌ Error in enhanced user invalidation:', error);
    }
  }

  static async invalidateSearchResults(): Promise<void> {
    console.log(`🗑️  ENHANCED INVALIDATION: Search results`);

    try {
      if (typeof searchCache !== 'undefined') {
        searchCache.clear();
      }

      console.log(`✅ Enhanced search invalidation completed`);
    } catch (error) {
      console.error('❌ Error in enhanced search invalidation:', error);
    }
  }

  static async invalidateAnalytics(dateRange?: string): Promise<void> {
    console.log(`🗑️  ENHANCED INVALIDATION: Analytics ${dateRange || 'all'}`);

    try {
      if (typeof analyticsCache !== 'undefined') {
        if (dateRange) {
          analyticsCache.clearByDateRange(dateRange);
        } else {
          analyticsCache.clearByType('dashboard');
        }
      }

      console.log(`✅ Enhanced analytics invalidation completed`);
    } catch (error) {
      console.error('❌ Error in enhanced analytics invalidation:', error);
    }
  }

  static async invalidateAll(): Promise<void> {
    console.log(`🗑️  ENHANCED INVALIDATION: All caches`);

    try {
      // Clear all enhanced caches
      if (typeof pageCache !== 'undefined') pageCache.clear();
      if (typeof pagesListCache !== 'undefined') pagesListCache.clear();
      if (typeof userCache !== 'undefined') userCache.clear();
      if (typeof searchCache !== 'undefined') searchCache.clear();
      if (typeof analyticsCache !== 'undefined') analyticsCache.clear();

      // Legacy invalidation
      invalidateAllCaches();

      console.log(`✅ Enhanced full invalidation completed`);
    } catch (error) {
      console.error('❌ Error in enhanced full invalidation:', error);
    }
  }
}

/**
 * Force refresh subscription data from frontend
 * Call this after subscription changes to ensure UI shows latest data
 */
export const forceRefreshSubscriptionData = async (userId?: string): Promise<void> => {
  console.log(`🔄 FORCE REFRESH: Starting subscription data refresh for user ${userId || 'current'}`);

  try {
    // Give webhooks a moment to process (2 seconds)
    console.log('⏳ Waiting 2 seconds for webhooks to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    // 1. Invalidate server-side cache
    if (userId) {
      const response = await fetch('/api/account-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalidate-cache', userId })
      });

      if (response.ok) {
        console.log(`✅ Server cache invalidated for user ${userId}`);
      } else {
        console.warn(`⚠️ Failed to invalidate server cache for user ${userId}`);
      }
    }

    // 2. Dispatch frontend cache invalidation events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('invalidate-subscription-cache', {
        detail: { userId, forceRefresh: true }
      }));
      window.dispatchEvent(new CustomEvent('invalidate-earnings-cache', {
        detail: { userId, forceRefresh: true }
      }));
      window.dispatchEvent(new CustomEvent('invalidate-usd-balance-cache', {
        detail: { userId, forceRefresh: true }
      }));
      console.log(`✅ Frontend cache invalidation events dispatched`);
    }

    console.log(`🎉 FORCE REFRESH: Completed subscription data refresh`);
  } catch (error) {
    console.error(`❌ FORCE REFRESH: Error refreshing subscription data:`, error);
  }
};

/**
 * Invalidate subscription-related caches
 * Call this after subscription updates, upgrades, cancellations, etc.
 */
export const invalidateSubscriptionCaches = async (userId: string): Promise<void> => {
  console.log(`🔄 SUBSCRIPTION CACHE INVALIDATION: Starting for user ${userId}`);

  try {
    // 1. Clear server-side subscription cache
    if (typeof window === 'undefined') {
      // Server-side: Import and clear subscription cache
      try {
        const { subscriptionCache } = await import('../api/account-subscription/route');
        const cacheKey = `subscription:${userId}`;
        subscriptionCache.delete(cacheKey);
        console.log(`✅ Cleared server subscription cache for ${userId}`);
      } catch (error) {
        console.warn('Could not clear server subscription cache:', error);
      }

      // Clear earnings cache (contains subscription data)
      try {
        const { earningsCache } = await import('../api/earnings/user/route');
        const earningsCacheKey = `unified_earnings:${userId}:v1`;
        earningsCache.delete(earningsCacheKey);
        console.log(`✅ Cleared server earnings cache for ${userId}`);
      } catch (error) {
        console.warn('Could not clear server earnings cache:', error);
      }

      // Clear allocation bar cache (contains subscription data)
      try {
        const { allocationBarDataCache } = await import('../api/usd/pledge-bar-data/route');
        const allocationCacheKey = `allocation_bar:${userId}`;
        allocationBarDataCache.delete(allocationCacheKey);
        console.log(`✅ Cleared server allocation bar cache for ${userId}`);
      } catch (error) {
        console.warn('Could not clear server allocation bar cache:', error);
      }
    }

    // 2. Clear client-side caches
    if (typeof window !== 'undefined') {
      // Dispatch events to invalidate frontend caches
      window.dispatchEvent(new CustomEvent('invalidate-subscription-cache', {
        detail: { userId }
      }));
      window.dispatchEvent(new CustomEvent('invalidate-earnings-cache', {
        detail: { userId }
      }));
      window.dispatchEvent(new CustomEvent('invalidate-usd-balance-cache', {
        detail: { userId }
      }));
      console.log(`✅ Dispatched client-side subscription cache invalidation events`);
    }

    // 3. Clear any user-related caches that might contain subscription data
    if (typeof userCache !== 'undefined') {
      userCache.invalidate(userId);
      console.log(`✅ Cleared user cache for ${userId}`);
    }

    console.log(`🎉 SUBSCRIPTION CACHE INVALIDATION: Completed for user ${userId}`);
  } catch (error) {
    console.error(`❌ SUBSCRIPTION CACHE INVALIDATION: Error for user ${userId}:`, error);
  }
};

// Export enhanced invalidation functions
export const {
  invalidatePageUpdate,
  invalidatePageDelete,
  invalidateUserUpdate,
  invalidateSearchResults,
  invalidateAnalytics,
  invalidateAll
} = EnhancedCacheInvalidation;

// Export the class for advanced usage
export { EnhancedCacheInvalidation };

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Import debug utilities only in development
  import('./cacheDebugUtils').catch(error => {
    console.warn('Failed to load cache debug utilities:', error);
  });
}