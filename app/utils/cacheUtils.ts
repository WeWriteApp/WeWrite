"use client";

// Cache utilities for WeWrite application
// Provides localStorage-based caching with TTL support

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Generate a consistent cache key
 */
export const generateCacheKey = (prefix: string, identifier: string): string => {
  return `wewrite_${prefix}_${identifier}`;
};

/**
 * Set an item in cache with TTL
 */
export const setCacheItem = <T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void => {
  try {
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };
    
    localStorage.setItem(key, JSON.stringify(cacheItem));
  } catch (error) {
    console.warn('Error setting cache item:', error);
    // Handle localStorage quota exceeded or other errors
  }
};

/**
 * Get an item from cache, checking TTL
 */
export const getCacheItem = <T>(key: string): T | null => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const cacheItem: CacheItem<T> = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache item has expired
    if (now - cacheItem.timestamp > cacheItem.ttl) {
      localStorage.removeItem(key);
      return null;
    }
    
    return cacheItem.data;
  } catch (error) {
    console.warn('Error getting cache item:', error);
    // Remove corrupted cache item
    try {
      localStorage.removeItem(key);
    } catch (removeError) {
      console.warn('Error removing corrupted cache item:', removeError);
    }
    return null;
  }
};

/**
 * Remove an item from cache
 */
export const removeCacheItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Error removing cache item:', error);
  }
};

/**
 * Clear all cache items with a specific prefix
 */
export const clearCacheByPrefix = (prefix: string): void => {
  try {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`wewrite_${prefix}_`)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Error clearing cache by prefix:', error);
  }
};

/**
 * Clear expired cache items
 */
export const clearExpiredCache = (): void => {
  try {
    const keysToRemove: string[] = [];
    const now = Date.now();
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('wewrite_')) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const cacheItem: CacheItem = JSON.parse(cached);
            if (now - cacheItem.timestamp > cacheItem.ttl) {
              keysToRemove.push(key);
            }
          }
        } catch (parseError) {
          // Remove corrupted items
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    if (keysToRemove.length > 0) {
      console.log(`Cleared ${keysToRemove.length} expired cache items`);
    }
  } catch (error) {
    console.warn('Error clearing expired cache:', error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = (): {
  totalItems: number;
  totalSize: number;
  itemsByPrefix: Record<string, number>;
} => {
  const stats = {
    totalItems: 0,
    totalSize: 0,
    itemsByPrefix: {} as Record<string, number>
  };
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('wewrite_')) {
        const value = localStorage.getItem(key);
        if (value) {
          stats.totalItems++;
          stats.totalSize += value.length;
          
          // Extract prefix
          const parts = key.split('_');
          if (parts.length >= 2) {
            const prefix = parts[1];
            stats.itemsByPrefix[prefix] = (stats.itemsByPrefix[prefix] || 0) + 1;
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error getting cache stats:', error);
  }
  
  return stats;
};

/**
 * Initialize cache management
 * Call this on app startup to clean expired items
 */
export const initializeCache = (): void => {
  // Clear expired items on startup
  clearExpiredCache();
  
  // Set up periodic cleanup (every 10 minutes)
  if (typeof window !== 'undefined') {
    setInterval(clearExpiredCache, 10 * 60 * 1000);
  }
};

/**
 * Cache with automatic batching for multiple keys
 */
export class BatchCache<T> {
  private prefix: string;
  private defaultTTL: number;
  
  constructor(prefix: string, defaultTTL: number = 5 * 60 * 1000) {
    this.prefix = prefix;
    this.defaultTTL = defaultTTL;
  }
  
  /**
   * Get multiple items from cache
   */
  getMultiple(keys: string[]): Record<string, T | null> {
    const results: Record<string, T | null> = {};
    
    keys.forEach(key => {
      const cacheKey = generateCacheKey(this.prefix, key);
      results[key] = getCacheItem<T>(cacheKey);
    });
    
    return results;
  }
  
  /**
   * Set multiple items in cache
   */
  setMultiple(items: Record<string, T>, ttl?: number): void {
    const actualTTL = ttl || this.defaultTTL;
    
    Object.entries(items).forEach(([key, value]) => {
      const cacheKey = generateCacheKey(this.prefix, key);
      setCacheItem(cacheKey, value, actualTTL);
    });
  }
  
  /**
   * Get items that are not in cache
   */
  getMissingKeys(keys: string[]): string[] {
    return keys.filter(key => {
      const cacheKey = generateCacheKey(this.prefix, key);
      return getCacheItem<T>(cacheKey) === null;
    });
  }
  
  /**
   * Clear all items for this cache
   */
  clear(): void {
    clearCacheByPrefix(this.prefix);
  }
}
