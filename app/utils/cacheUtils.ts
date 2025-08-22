"use client";

/**
 * Simple Cache Utilities
 * 
 * Provides basic localStorage caching with TTL support.
 * Simplified version focused on essential functionality.
 */

interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
}

/**
 * Generate a cache key from components
 */
export function generateCacheKey(...components: (string | number | undefined)[]): string {
  return components
    .filter(Boolean)
    .map(String)
    .join(':');
}

/**
 * Get item from cache
 */
export function getCacheItem(key: string): any | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const item = localStorage.getItem(`cache:${key}`);
    if (!item) return null;
    
    const cached: CacheItem = JSON.parse(item);
    const now = Date.now();
    
    // Check if expired
    if (now > cached.timestamp + cached.ttl) {
      localStorage.removeItem(`cache:${key}`);
      return null;
    }
    
    return cached.data;
  } catch (error) {
    console.warn('Cache get error:', error);
    return null;
  }
}

/**
 * Set item in cache
 */
export function setCacheItem(key: string, data: any, ttlMs: number = 300000): void {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheItem: CacheItem = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    };
    
    localStorage.setItem(`cache:${key}`, JSON.stringify(cacheItem));
  } catch (error) {
    console.warn('Cache set error:', error);
  }
}

/**
 * Initialize cache (no-op for compatibility)
 */
export function initializeCache(): void {
  // No-op for backward compatibility
}

/**
 * Clear expired cache items
 */
export function clearExpiredCache(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    
    keys.forEach(key => {
      if (key.startsWith('cache:')) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const cached: CacheItem = JSON.parse(item);
            if (now > cached.timestamp + cached.ttl) {
              localStorage.removeItem(key);
            }
          }
        } catch (error) {
          // Remove corrupted cache items
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.warn('Cache cleanup error:', error);
  }
}

// Auto-cleanup expired items periodically
if (typeof window !== 'undefined') {
  setInterval(clearExpiredCache, 600000); // Every 10 minutes
}
