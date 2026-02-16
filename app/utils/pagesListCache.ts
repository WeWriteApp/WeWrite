/**
 * Enhanced Pages List Cache
 * 
 * Aggressive caching for pages list queries to reduce database reads
 * Supports different query patterns and user contexts
 */

interface CacheEntry {
  data: any[];
  timestamp: number;
  queryHash: string;
  userId: string;
  totalCount?: number;
  etag?: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  totalQueries: number;
  costSavings: number;
}

class PagesListCache {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = { hits: 0, misses: 0, totalQueries: 0, costSavings: 0 };
  
  // Aggressive TTL for cost optimization
  private readonly TTL = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_SIZE = 200; // Support more cached queries
  
  /**
   * Generate cache key from query parameters
   */
  private generateCacheKey(userId: string, queryParams: any): string {
    // Create a stable hash of query parameters
    const queryString = JSON.stringify({
      userId,
      includeDeleted: queryParams.includeDeleted || false,
      limit: queryParams.limit || 50,
      orderBy: queryParams.orderBy || 'lastModified',
      orderDirection: queryParams.orderDirection || 'desc',
      // Don't include startAfter in cache key for pagination
    });
    
    return Buffer.from(queryString).toString('base64').substring(0, 32);
  }
  
  /**
   * Get cached pages list
   */
  get(userId: string, queryParams: any): any[] | null {
    this.stats.totalQueries++;
    
    const cacheKey = this.generateCacheKey(userId, queryParams);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(cacheKey);
      this.stats.misses++;
      return null;
    }
    
    // Handle pagination - if startAfter is specified, slice the cached results
    let results = entry.data;
    if (queryParams.startAfter && results.length > 0) {
      const startIndex = results.findIndex(page => page.id === queryParams.startAfter);
      if (startIndex >= 0) {
        results = results.slice(startIndex + 1);
      }
    }
    
    // Apply limit
    const limit = queryParams.limit || 50;
    results = results.slice(0, limit);
    
    this.stats.hits++;
    this.stats.costSavings += 0.00036 / 1000; // Firestore read cost saved
    
    return results;
  }
  
  /**
   * Cache pages list results
   */
  set(userId: string, queryParams: any, data: any[], totalCount?: number): void {
    const cacheKey = this.generateCacheKey(userId, queryParams);
    
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    // Store with extended data for pagination support
    this.cache.set(cacheKey, {
      data: [...data], // Clone to prevent mutations
      timestamp: Date.now(),
      queryHash: cacheKey,
      userId,
      totalCount,
      etag: `"pages-${userId}-${Date.now()}"`
    });
    
  }
  
  /**
   * Invalidate cache for a specific user
   */
  invalidateUser(userId: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.userId === userId) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
  
  /**
   * Invalidate all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, totalQueries: 0, costSavings: 0 };
  }
  
  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number; size: number; projectedMonthlySavings: number } {
    const hitRate = this.stats.totalQueries > 0 ? 
      (this.stats.hits / this.stats.totalQueries) * 100 : 0;
    
    const projectedMonthlySavings = this.stats.costSavings * 30 * 24; // Extrapolate to monthly
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
      projectedMonthlySavings: Math.round(projectedMonthlySavings * 100) / 100
    };
  }
  
  /**
   * Check if cache has entry for query
   */
  has(userId: string, queryParams: any): boolean {
    const cacheKey = this.generateCacheKey(userId, queryParams);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) return false;
    
    return Date.now() - entry.timestamp <= this.TTL;
  }
  
  /**
   * Get ETag for conditional requests
   */
  getETag(userId: string, queryParams: any): string | undefined {
    const cacheKey = this.generateCacheKey(userId, queryParams);
    const entry = this.cache.get(cacheKey);
    
    if (!entry || Date.now() - entry.timestamp > this.TTL) {
      return undefined;
    }
    
    return entry.etag;
  }
}

// Export singleton instance
export const pagesListCache = new PagesListCache();

// Cleanup expired entries every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    pagesListCache.cleanup();
  }, 10 * 60 * 1000);
}
