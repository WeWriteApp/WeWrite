/**
 * Simple in-memory cache for search results to improve performance
 * 
 * Features:
 * - TTL (Time To Live) based expiration
 * - LRU (Least Recently Used) eviction
 * - Memory usage monitoring
 * - Cache hit/miss statistics
 */

// Import unified cache configuration
import { UNIFIED_CACHE_TTL } from './unifiedCache.js';

class SearchCache {
  constructor(maxSize = 500, ttlMs = UNIFIED_CACHE_TTL.SEARCH_DATA) { // Use unified search cache TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Generate cache key from search parameters
   */
  generateKey(userId, searchTerm, options = {}) {
    const { titleOnly = false, maxResults = 50, filterByUserId = null } = options;
    return `${userId || 'anon'}:${searchTerm}:${titleOnly}:${maxResults}:${filterByUserId || ''}`;
  }

  /**
   * Get cached search results
   */
  get(userId, searchTerm, options = {}) {
    const key = this.generateKey(userId, searchTerm, options);
    const cached = this.cache.get(key);

    if (!cached) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, cached);
    this.stats.hits++;

    console.log(`🎯 Search cache HIT for "${searchTerm}" (${this.stats.hits}/${this.stats.hits + this.stats.misses} hit rate)`);
    return cached.data;
  }

  /**
   * Store search results in cache
   */
  set(userId, searchTerm, data, options = {}) {
    const key = this.generateKey(userId, searchTerm, options);
    
    // Evict oldest entries if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }

    const cached = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs
    };

    this.cache.set(key, cached);
    console.log(`💾 Search cached for "${searchTerm}" (cache size: ${this.cache.size}/${this.maxSize})`);
  }

  /**
   * Clear cache (useful for testing or manual invalidation)
   */
  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    console.log('🗑️ Search cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(1) + '%' : '0%',
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }

  /**
   * Invalidate cache entries for a specific user (useful when user creates/deletes pages)
   */
  invalidateUser(userId) {
    let invalidated = 0;
    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    if (invalidated > 0) {
      console.log(`🗑️ Invalidated ${invalidated} cache entries for user ${userId}`);
    }
  }

  /**
   * Clean up expired entries (can be called periodically)
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
    }
    
    return cleaned;
  }
}

// Create singleton instance
const searchCache = new SearchCache();

// Cleanup expired entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    searchCache.cleanup();
  }, 10 * 60 * 1000);
}

export default searchCache;

/**
 * Wrapper function to use cache with search functions
 */
export async function cachedSearch(searchFunction, userId, searchTerm, options = {}) {
  // Check cache first
  const cached = searchCache.get(userId, searchTerm, options);
  if (cached) {
    return cached;
  }

  // Execute search function
  const results = await searchFunction(userId, searchTerm, options);
  
  // Cache the results
  if (results && Array.isArray(results)) {
    searchCache.set(userId, searchTerm, results, options);
  }

  return results;
}

/**
 * Helper to invalidate cache when pages are modified
 */
export function invalidateSearchCache(userId) {
  searchCache.invalidateUser(userId);
}

/**
 * Get cache statistics for monitoring
 */
export function getSearchCacheStats() {
  return searchCache.getStats();
}