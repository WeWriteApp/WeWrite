/**
 * Enhanced Search Results Cache System
 * 
 * Comprehensive caching for search operations to reduce expensive database queries
 * Supports different search types, user contexts, and intelligent cache management
 */

interface SearchCacheEntry {
  data: any[];
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  tier: 'hot' | 'warm' | 'cold';
  searchType: 'pages' | 'users' | 'unified' | 'trending';
  resultCount: number;
  queryHash: string;
}

interface SearchCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  costSavings: number;
  averageResultCount: number;
}

class EnhancedSearchCache {
  private cache = new Map<string, SearchCacheEntry>();
  private stats: SearchCacheStats = { 
    hits: 0, 
    misses: 0, 
    evictions: 0, 
    totalRequests: 0, 
    costSavings: 0,
    averageResultCount: 0
  };
  
  // Aggressive caching for search optimization
  private readonly HOT_TTL = 20 * 60 * 1000;    // 20 minutes for popular searches
  private readonly WARM_TTL = 60 * 60 * 1000;   // 1 hour for moderate searches
  private readonly COLD_TTL = 4 * 60 * 60 * 1000; // 4 hours for rare searches
  private readonly MAX_SIZE = 2000; // Large cache for search results
  private readonly HOT_THRESHOLD = 3; // Access count to be considered "hot"

  private getTierTTL(tier: 'hot' | 'warm' | 'cold'): number {
    switch (tier) {
      case 'hot': return this.HOT_TTL;
      case 'warm': return this.WARM_TTL;
      case 'cold': return this.COLD_TTL;
    }
  }

  private determineTier(accessCount: number): 'hot' | 'warm' | 'cold' {
    if (accessCount >= this.HOT_THRESHOLD) return 'hot';
    if (accessCount >= 2) return 'warm';
    return 'cold';
  }

  /**
   * Generate cache key from search parameters
   */
  private generateCacheKey(
    searchTerm: string, 
    userId: string | null, 
    searchType: string,
    options: any = {}
  ): string {
    const normalizedTerm = searchTerm.toLowerCase().trim();
    const keyData = {
      term: normalizedTerm,
      userId: userId || 'anonymous',
      type: searchType,
      context: options.context || 'main',
      filterByUserId: options.filterByUserId,
      titleOnly: options.titleOnly || false,
      includeContent: options.includeContent !== false,
      maxResults: options.maxResults || 20
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64').substring(0, 40);
  }

  /**
   * Get cached search results
   */
  get(
    searchTerm: string, 
    userId: string | null, 
    searchType: 'pages' | 'users' | 'unified' | 'trending' = 'pages',
    options: any = {}
  ): any[] | null {
    this.stats.totalRequests++;
    
    const key = this.generateCacheKey(searchTerm, userId, searchType, options);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    const ttl = this.getTierTTL(entry.tier);

    // Check if expired
    if (now - entry.timestamp > ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = now;
    entry.tier = this.determineTier(entry.accessCount);

    this.stats.hits++;
    this.stats.costSavings += this.calculateSearchCost(entry.resultCount);

    return entry.data;
  }

  /**
   * Cache search results
   */
  set(
    searchTerm: string, 
    userId: string | null, 
    data: any[], 
    searchType: 'pages' | 'users' | 'unified' | 'trending' = 'pages',
    options: any = {}
  ): void {
    const key = this.generateCacheKey(searchTerm, userId, searchType, options);
    const now = Date.now();

    // Smart eviction if cache is full
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictLeastUseful();
    }

    // Check if updating existing entry
    const existingEntry = this.cache.get(key);
    const accessCount = existingEntry ? existingEntry.accessCount : 1;
    const tier = this.determineTier(accessCount);

    this.cache.set(key, {
      data: [...data], // Clone to prevent mutations
      timestamp: now,
      accessCount,
      lastAccessed: now,
      tier,
      searchType,
      resultCount: data.length,
      queryHash: key
    });

    // Update average result count
    this.updateAverageResultCount();

  }

  /**
   * Calculate estimated cost of search operation
   */
  private calculateSearchCost(resultCount: number): number {
    // Estimate: search operations typically read multiple documents
    // Pages search might read 100-500 docs, users search 50-100 docs
    const estimatedReads = Math.max(resultCount * 2, 50); // Minimum 50 reads per search
    return (estimatedReads * 0.00036) / 1000; // Firestore read cost
  }

  /**
   * Smart eviction strategy for search cache
   */
  private evictLeastUseful(): void {
    let leastUsefulKey: string | null = null;
    let leastUsefulScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Score based on tier, recency, access count, and result quality
      let score = entry.accessCount;
      
      // Tier multiplier
      if (entry.tier === 'cold') score *= 0.1;
      else if (entry.tier === 'warm') score *= 0.5;
      
      // Result count factor (more results = more valuable)
      score *= Math.log(entry.resultCount + 1);
      
      // Recency factor
      const ageMinutes = (Date.now() - entry.lastAccessed) / (60 * 1000);
      score = score / (1 + ageMinutes);

      if (score < leastUsefulScore) {
        leastUsefulScore = score;
        leastUsefulKey = key;
      }
    }

    if (leastUsefulKey) {
      this.cache.delete(leastUsefulKey);
      this.stats.evictions++;
    }
  }

  /**
   * Update average result count statistic
   */
  private updateAverageResultCount(): void {
    if (this.cache.size === 0) {
      this.stats.averageResultCount = 0;
      return;
    }

    const totalResults = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.resultCount, 0);
    this.stats.averageResultCount = Math.round(totalResults / this.cache.size);
  }

  /**
   * Get cache statistics
   */
  getStats(): SearchCacheStats & { hitRate: number; size: number; tierBreakdown: any } {
    const hitRate = this.stats.totalRequests > 0 ? 
      (this.stats.hits / this.stats.totalRequests) * 100 : 0;

    // Calculate tier breakdown
    const tierBreakdown = { hot: 0, warm: 0, cold: 0 };
    const typeBreakdown = { pages: 0, users: 0, unified: 0, trending: 0 };
    
    for (const entry of this.cache.values()) {
      tierBreakdown[entry.tier]++;
      typeBreakdown[entry.searchType]++;
    }

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
      tierBreakdown,
      typeBreakdown
    };
  }

  /**
   * Clear cache for specific search type
   */
  clearByType(searchType: 'pages' | 'users' | 'unified' | 'trending'): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.searchType === searchType) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, totalRequests: 0, costSavings: 0, averageResultCount: 0 };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const ttl = this.getTierTTL(entry.tier);
      if (now - entry.timestamp > ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      this.updateAverageResultCount();
    }
  }

  /**
   * Get popular search terms
   */
  getPopularSearches(limit: number = 10): Array<{ term: string; accessCount: number; tier: string }> {
    const searches = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        term: key.substring(0, 20) + '...', // Truncated for privacy
        accessCount: entry.accessCount,
        tier: entry.tier,
        resultCount: entry.resultCount
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);

    return searches;
  }
}

// Export singleton instance
export const searchCache = new EnhancedSearchCache();

// Cleanup expired entries every 20 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    searchCache.cleanup();
  }, 20 * 60 * 1000);
}
