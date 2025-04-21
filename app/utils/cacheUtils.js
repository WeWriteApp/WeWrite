/**
 * Utility functions for client-side caching
 * These functions help reduce Firestore reads by caching frequently accessed data
 */

// Default TTL (time-to-live) in milliseconds (5 minutes)
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Set an item in localStorage with expiration
 *
 * @param {string} key - The cache key
 * @param {any} value - The value to cache
 * @param {number} ttl - Time to live in milliseconds
 */
export const setCacheItem = (key, value, ttl = DEFAULT_TTL) => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;

    const item = {
      value,
      expiry: Date.now() + ttl
    };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error('Error setting cache item:', error);
  }
};

/**
 * Get an item from localStorage, checking expiration
 *
 * @param {string} key - The cache key
 * @returns {any|null} - The cached value or null if expired/not found
 */
export const getCacheItem = (key) => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return null;

    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;

    const item = JSON.parse(itemStr);
    if (Date.now() > item.expiry) {
      // Item has expired, remove it
      localStorage.removeItem(key);
      return null;
    }

    return item.value;
  } catch (error) {
    console.error('Error getting cache item:', error);
    return null;
  }
};

/**
 * Clear all cached items or items with a specific prefix
 *
 * @param {string} prefix - Optional prefix to clear only specific items
 */
export const clearCache = (prefix = '') => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;

    if (!prefix) {
      // Clear all cache items
      localStorage.clear();
      return;
    }

    // Clear items with specific prefix
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

/**
 * Generate a cache key for a specific entity
 *
 * @param {string} type - Entity type (e.g., 'user', 'page')
 * @param {string} id - Entity ID
 * @param {string} subType - Optional sub-type (e.g., 'profile', 'stats')
 * @returns {string} - The cache key
 */
export const generateCacheKey = (type, id, subType = '') => {
  return `wewrite_${type}_${id}${subType ? `_${subType}` : ''}`;
};
