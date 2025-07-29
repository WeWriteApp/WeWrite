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
  constructor(maxSize = 1000, ttlMs = UNIFIED_CACHE_TTL.SEARCH_DATA) { // OPTIMIZATION: Increased cache size
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      hitRate: 0
    };

    // OPTIMIZATION: Add performance tracking
    this.performanceStats = {
      averageHitTime: 0,
      averageMissTime: 0,
      totalHitTime: 0,
      totalMissTime: 0
    };
  }

  /**
   * OPTIMIZATION: Enhanced cache key generation with better hashing
   */
  generateKey(userId, searchTerm, options = {}) {
    const { titleOnly = false, maxResults = 50, filterByUserId = null, context = 'main' } = options;
    const keyData = {
      userId: userId || 'anon',
      searchTerm: searchTerm.toLowerCase().trim(), // Normalize for better cache hits
      titleOnly,
      maxResults,
      filterByUserId: filterByUserId || '',
      context
    };
    return JSON.stringify(keyData);
  }

  /**
   * OPTIMIZATION: Enhanced cache retrieval with performance tracking
   */
  get(userId, searchTerm, options = {}) {
    const startTime = Date.now();
    const key = this.generateKey(userId, searchTerm, options);
    const cached = this.cache.get(key);

    this.stats.totalRequests++;

    if (!cached) {
      this.stats.misses++;
      const missTime = Date.now() - startTime;
      this.performanceStats.totalMissTime += missTime;
      this.performanceStats.averageMissTime = this.performanceStats.totalMissTime / this.stats.misses;
      this._updateHitRate();
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      const missTime = Date.now() - startTime;
      this.performanceStats.totalMissTime += missTime;
      this.performanceStats.averageMissTime = this.performanceStats.totalMissTime / this.stats.misses;
      this._updateHitRate();
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, cached);
    this.stats.hits++;

    const hitTime = Date.now() - startTime;
    this.performanceStats.totalHitTime += hitTime;
    this.performanceStats.averageHitTime = this.performanceStats.totalHitTime / this.stats.hits;
    this._updateHitRate();

    console.log(`🎯 Search cache HIT for "${searchTerm}" (${this.stats.hitRate}% hit rate, ${hitTime}ms)`);
    return cached.data;
  }

  /**
   * OPTIMIZATION: Update hit rate calculation
   */
  _updateHitRate() {
    this.stats.hitRate = this.stats.totalRequests > 0
      ? Math.round((this.stats.hits / this.stats.totalRequests) * 100)
      : 0;
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