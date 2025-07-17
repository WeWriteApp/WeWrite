"use client";

/**
 * Cache invalidation utilities for WeWrite application
 *
 * This module provides centralized cache invalidation mechanisms
 * to ensure data consistency across the application when content changes.
 */

// Type definitions
type CacheInvalidatorFunction = (userId?: string) => void;
type CacheType = 'recentActivity' | 'userPages' | 'staticActivity';

interface CacheInvalidators {
  recentActivity: CacheInvalidatorFunction[];
  userPages: CacheInvalidatorFunction[];
  staticActivity: CacheInvalidatorFunction[];
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
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Import debug utilities only in development
  import('./cacheDebugUtils').catch(error => {
    console.warn('Failed to load cache debug utilities:', error);
  });
}