"use client";

/**
 * Cache invalidation utilities for WeWrite application
 * 
 * This module provides centralized cache invalidation mechanisms
 * to ensure data consistency across the application when content changes.
 */

// Store references to cache invalidation functions
const cacheInvalidators = {
  recentActivity: [],
  userPages: [],
  staticActivity: []
};

/**
 * Register a cache invalidation function for recent activity
 * @param {Function} invalidator - Function to call when cache should be invalidated
 */
export const registerRecentActivityInvalidator = (invalidator) => {
  if (typeof invalidator === 'function') {
    cacheInvalidators.recentActivity.push(invalidator);
  }
};

/**
 * Register a cache invalidation function for user pages
 * @param {Function} invalidator - Function to call when cache should be invalidated
 */
export const registerUserPagesInvalidator = (invalidator) => {
  if (typeof invalidator === 'function') {
    cacheInvalidators.userPages.push(invalidator);
  }
};

/**
 * Register a cache invalidation function for static activity
 * @param {Function} invalidator - Function to call when cache should be invalidated
 */
export const registerStaticActivityInvalidator = (invalidator) => {
  if (typeof invalidator === 'function') {
    cacheInvalidators.staticActivity.push(invalidator);
  }
};

/**
 * Unregister a cache invalidation function
 * @param {string} type - Type of cache ('recentActivity', 'userPages', 'staticActivity')
 * @param {Function} invalidator - Function to remove
 */
export const unregisterCacheInvalidator = (type, invalidator) => {
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
export const invalidateRecentActivityCache = () => {
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
 * @param {string} userId - ID of the user whose pages changed
 */
export const invalidateUserPagesCache = (userId) => {
  console.log('Invalidating user pages cache for user:', userId);
  cacheInvalidators.userPages.forEach(invalidator => {
    try {
      invalidator(userId);
    } catch (error) {
      console.error('Error calling user pages cache invalidator:', error);
    }
  });

  // CRITICAL FIX: Also clear the new API cache
  if (typeof window !== 'undefined' && window.clearUserPagesCache) {
    window.clearUserPagesCache(userId);
  }

  // CRITICAL FIX: Clear localStorage caches that might be stale
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      // Clear all user pages related cache entries
      const keysToRemove = [];
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
export const invalidateStaticActivityCache = () => {
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
 * @param {string} userId - ID of the user who created the page
 */
export const invalidatePageCreationCaches = (userId) => {
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
export const clearAllCacheInvalidators = () => {
  console.log('Clearing all cache invalidators');
  cacheInvalidators.recentActivity = [];
  cacheInvalidators.userPages = [];
  cacheInvalidators.staticActivity = [];
};

/**
 * Add test and utility functions to the global window object for debugging
 */
if (typeof window !== 'undefined') {
  window.testCacheInvalidation = () => {
    console.log('🧪 Testing cache invalidation system...');
    console.log('Registered invalidators:', {
      recentActivity: cacheInvalidators.recentActivity.length,
      userPages: cacheInvalidators.userPages.length,
      staticActivity: cacheInvalidators.staticActivity.length
    });

    // Test invalidation
    invalidatePageCreationCaches('test-user-id');
  };

  // Add a function to manually refresh user pages
  window.refreshUserPages = (userId) => {
    console.log('🔄 Manually refreshing user pages for:', userId);
    invalidateUserPagesCache(userId);
  };

  // Add a function to force refresh all caches
  window.forceRefreshAllCaches = () => {
    console.log('🔄 Force refreshing all caches...');
    invalidateRecentActivityCache();
    invalidateStaticActivityCache();

    // Dispatch global events
    window.dispatchEvent(new CustomEvent('invalidate-recent-activity'));
    window.dispatchEvent(new CustomEvent('invalidate-static-activity'));

    console.log('✅ All caches refreshed');
  };

  // 🚨 CRITICAL FIX: Add function to test the enhanced API with database-level sorting
  window.testMyPagesAPI = async (userId, sortBy = 'lastModified', sortDirection = 'desc') => {
    try {
      console.log(`🧪 Testing /api/my-pages for user: ${userId} sorted by ${sortBy} ${sortDirection}`);
      const params = new URLSearchParams({
        userId,
        sortBy,
        sortDirection,
        limit: '10'
      });
      const response = await fetch(`/api/my-pages?${params}`);
      const data = await response.json();
      console.log('🧪 API Response:', data);
      console.log(`🧪 Found ${data.pages?.length || 0} pages sorted by ${data.sortBy} ${data.sortDirection}`);
      if (data.pages?.length > 0) {
        console.log('🧪 First few pages:', data.pages.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          lastModified: p.lastModified,
          createdAt: p.createdAt
        })));
      }
      return data;
    } catch (error) {
      console.error('🧪 API Test Error:', error);
      return { error: error.message };
    }
  };

  // 🚨 CRITICAL FIX: Add function to test all sort modes
  window.testAllSortModes = async (userId) => {
    console.log('🧪 Testing all sort modes for user:', userId);

    console.log('\n📅 Testing Recently Modified (desc):');
    await window.testMyPagesAPI(userId, 'lastModified', 'desc');

    console.log('\n🆕 Testing Recently Created (desc):');
    await window.testMyPagesAPI(userId, 'createdAt', 'desc');

    console.log('\n🔤 Testing Alphabetical (asc):');
    await window.testMyPagesAPI(userId, 'title', 'asc');

    console.log('\n✅ All sort mode tests completed');
  };

  // 🚨 QUERY OPTIMIZATION: Add function to clear API cache
  window.clearUserPagesCache = (userId) => {
    console.log('🗑️ Clearing user pages cache for:', userId);
    // This will be called by the hook's cache clearing mechanism
    // The actual cache is managed in the useSimplePages hook
  };

  // 🚨 DEBUG: Add function to test sort functionality directly
  window.testSortFunctionality = () => {
    console.log('🧪 Testing sort functionality...');

    // Find the sort dropdown and trigger changes
    const sortButtons = document.querySelectorAll('[data-sort-option]');
    console.log('Found sort buttons:', sortButtons.length);

    sortButtons.forEach((button, index) => {
      console.log(`Sort button ${index}:`, button.textContent, button.getAttribute('data-sort-option'));
    });

    // Test clicking the first sort option
    if (sortButtons.length > 0) {
      console.log('🧪 Clicking first sort option...');
      sortButtons[0].click();
    }
  };

  // 🚨 CRITICAL DEBUG: Check what sort is actually being used
  window.debugCurrentSort = () => {
    console.log('🔍 DEBUGGING CURRENT SORT STATE...');

    // Check localStorage
    const storedSortBy = localStorage.getItem('profile-pages-sort-by');
    const storedSortDirection = localStorage.getItem('profile-pages-sort-direction');
    console.log('📦 Stored sort:', { sortBy: storedSortBy, direction: storedSortDirection });

    // Check what the last API call was
    console.log('🌐 Last API calls should be visible above in console');

    // Check the current dropdown state
    const dropdown = document.querySelector('[data-testid="sort-dropdown"]');
    if (dropdown) {
      console.log('📋 Dropdown found:', dropdown.textContent);
    }

    return { storedSortBy, storedSortDirection };
  };
}