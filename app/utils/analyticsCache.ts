/**
 * Enhanced Analytics Cache System
 * 
 * Comprehensive caching for analytics operations to reduce expensive aggregation queries
 * Supports different analytics types, time ranges, and pre-computed results
 */

interface AnalyticsCacheEntry {
  data: any;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  tier: 'hot' | 'warm' | 'cold';
  analyticsType: 'dashboard' | 'pages' | 'users' | 'events' | 'aggregated';
  dateRange?: string;
  computationCost: number; // Estimated database reads for this query
}

interface AnalyticsCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  costSavings: number;
  averageComputationCost: number;
}

class EnhancedAnalyticsCache {
  private cache = new Map<string, AnalyticsCacheEntry>();
  private stats: AnalyticsCacheStats = { 
    hits: 0, 
    misses: 0, 
    evictions: 0, 
    totalRequests: 0, 
    costSavings: 0,
    averageComputationCost: 0
  };
  
  // Extended TTLs for analytics since data changes less frequently
  private readonly HOT_TTL = 30 * 60 * 1000;    // 30 minutes for frequently accessed analytics
  private readonly WARM_TTL = 2 * 60 * 60 * 1000; // 2 hours for moderate analytics
  private readonly COLD_TTL = 8 * 60 * 60 * 1000; // 8 hours for rare analytics
  private readonly MAX_SIZE = 1000; // Large cache for analytics results
  private readonly HOT_THRESHOLD = 2; // Lower threshold since analytics accessed less frequently

  private getTierTTL(tier: 'hot' | 'warm' | 'cold'): number {
    switch (tier) {
      case 'hot': return this.HOT_TTL;
      case 'warm': return this.WARM_TTL;
      case 'cold': return this.COLD_TTL;
    }
  }

  private determineTier(accessCount: number): 'hot' | 'warm' | 'cold' {
    if (accessCount >= this.HOT_THRESHOLD) return 'hot';
    if (accessCount >= 1) return 'warm';
    return 'cold';
  }

  /**
   * Generate cache key from analytics parameters
   */
  private generateCacheKey(
    analyticsType: string,
    params: any = {}
  ): string {
    const keyData = {
      type: analyticsType,
      dateRange: params.dateRange,
      granularity: params.granularity,
      userId: params.userId,
      pageId: params.pageId,
      filters: params.filters || {},
      aggregationType: params.aggregationType
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64').substring(0, 50);
  }

  /**
   * Get cached analytics data
   */
  get(
    analyticsType: 'dashboard' | 'pages' | 'users' | 'events' | 'aggregated',
    params: any = {}
  ): any | null {
    this.stats.totalRequests++;
    
    const key = this.generateCacheKey(analyticsType, params);
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
    this.stats.costSavings += entry.computationCost * 0.00036 / 1000; // Firestore read cost saved

    console.log(`🚀 ANALYTICS CACHE: Hit for ${analyticsType} (tier: ${entry.tier}, cost saved: ${entry.computationCost} reads)`);
    return entry.data;
  }

  /**
   * Cache analytics data
   */
  set(
    analyticsType: 'dashboard' | 'pages' | 'users' | 'events' | 'aggregated',
    data: any,
    params: any = {},
    computationCost: number = 50 // Estimated database reads
  ): void {
    const key = this.generateCacheKey(analyticsType, params);
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
      data,
      timestamp: now,
      accessCount,
      lastAccessed: now,
      tier,
      analyticsType,
      dateRange: params.dateRange,
      computationCost
    });

    // Update average computation cost
    this.updateAverageComputationCost();

    console.log(`💾 ANALYTICS CACHE: Stored ${analyticsType} (tier: ${tier}, cost: ${computationCost} reads, size: ${this.cache.size})`);
  }

  /**
   * Smart eviction strategy for analytics cache
   */
  private evictLeastUseful(): void {
    let leastUsefulKey: string | null = null;
    let leastUsefulScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Score based on tier, recency, access count, and computation cost
      let score = entry.accessCount;
      
      // Tier multiplier
      if (entry.tier === 'cold') score *= 0.1;
      else if (entry.tier === 'warm') score *= 0.5;
      
      // Computation cost factor (more expensive queries are more valuable to cache)
      score *= Math.log(entry.computationCost + 1);
      
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
      console.log(`🗑️  ANALYTICS CACHE: Evicted analytics (score: ${leastUsefulScore.toFixed(3)})`);
    }
  }

  /**
   * Update average computation cost statistic
   */
  private updateAverageComputationCost(): void {
    if (this.cache.size === 0) {
      this.stats.averageComputationCost = 0;
      return;
    }

    const totalCost = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.computationCost, 0);
    this.stats.averageComputationCost = Math.round(totalCost / this.cache.size);
  }

  /**
   * Pre-compute and cache common analytics queries
   */
  async precomputeCommonAnalytics(): Promise<void> {
    console.log('🔄 ANALYTICS CACHE: Pre-computing common analytics...');
    
    const commonQueries = [
      { type: 'dashboard', params: { dateRange: '7d' } },
      { type: 'dashboard', params: { dateRange: '30d' } },
      { type: 'pages', params: { dateRange: '7d', granularity: 'daily' } },
      { type: 'users', params: { dateRange: '30d', granularity: 'daily' } },
      { type: 'aggregated', params: { type: 'global_counters' } }
    ];

    for (const query of commonQueries) {
      try {
        // Check if already cached
        if (!this.get(query.type as any, query.params)) {
          console.log(`🔄 Pre-computing ${query.type} analytics...`);
          // This would trigger the actual analytics computation
          // Implementation depends on your analytics service
        }
      } catch (error) {
        console.error(`❌ Failed to pre-compute ${query.type}:`, error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): AnalyticsCacheStats & { hitRate: number; size: number; tierBreakdown: any; typeBreakdown: any } {
    const hitRate = this.stats.totalRequests > 0 ? 
      (this.stats.hits / this.stats.totalRequests) * 100 : 0;

    // Calculate tier breakdown
    const tierBreakdown = { hot: 0, warm: 0, cold: 0 };
    const typeBreakdown = { dashboard: 0, pages: 0, users: 0, events: 0, aggregated: 0 };
    
    for (const entry of this.cache.values()) {
      tierBreakdown[entry.tier]++;
      typeBreakdown[entry.analyticsType]++;
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
   * Clear cache for specific analytics type
   */
  clearByType(analyticsType: 'dashboard' | 'pages' | 'users' | 'events' | 'aggregated'): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.analyticsType === analyticsType) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`🗑️  ANALYTICS CACHE: Cleared ${keysToDelete.length} ${analyticsType} entries`);
  }

  /**
   * Clear cache for specific date range (useful when data is updated)
   */
  clearByDateRange(dateRange: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.dateRange === dateRange) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`🗑️  ANALYTICS CACHE: Cleared ${keysToDelete.length} entries for date range ${dateRange}`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, totalRequests: 0, costSavings: 0, averageComputationCost: 0 };
    console.log('🧹 ANALYTICS CACHE: Cleared all entries');
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
      console.log(`🧹 ANALYTICS CACHE: Cleaned up ${keysToDelete.length} expired entries`);
      this.updateAverageComputationCost();
    }
  }
}

// Export singleton instance
export const analyticsCache = new EnhancedAnalyticsCache();

// Cleanup expired entries every 30 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    analyticsCache.cleanup();
  }, 30 * 60 * 1000);
}

// Pre-compute common analytics every hour
if (typeof window !== 'undefined') {
  setInterval(() => {
    analyticsCache.precomputeCommonAnalytics();
  }, 60 * 60 * 1000);
}
