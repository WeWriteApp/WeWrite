/**
 * Utility to clear all caches related to deleted page detection
 * This ensures that deleted page status appears immediately
 */

import { pageCache } from './serverCache';

export const clearDeletedPageCaches = (pageId?: string) => {
  // Clear page cache
  if (pageId) {
    pageCache.invalidate(pageId);
  } else {
    pageCache.clear();
  }

  // Clear API deduplication cache if it exists
  if (typeof window !== 'undefined') {
    try {
      // Clear any cached API responses
      const cacheKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('page:') || key.includes('api-cache'))) {
          cacheKeys.push(key);
        }
      }
      cacheKeys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear localStorage cache:', error);
    }
  }
};

// Auto-clear caches on page load to ensure fresh data
if (typeof window !== 'undefined') {
  // Clear caches when the page loads to ensure we get fresh deleted status
  window.addEventListener('load', () => {
    clearDeletedPageCaches();
  });
}
