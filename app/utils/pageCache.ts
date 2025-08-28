/**
 * Enhanced multi-tier page cache for aggressive cost optimization
 *
 * Features:
 * - Multiple cache tiers with different TTLs
 * - Smart invalidation strategies
 * - Memory-efficient storage
 * - Read frequency tracking
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  etag?: string;
  accessCount: number;
  lastAccessed: number;
  tier: 'hot' | 'warm' | 'cold';
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalReads: number;
}

class EnhancedPageCache {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, totalReads: 0 };

  // CRITICAL: Short caching for immediate updates after saves
  private readonly HOT_TTL = 10 * 1000;         // 10 seconds for frequently accessed pages - IMMEDIATE UPDATES
  private readonly WARM_TTL = 30 * 1000;        // 30 seconds for moderately accessed pages - FAST UPDATES
  private readonly COLD_TTL = 60 * 1000;        // 1 minute for rarely accessed pages - QUICK UPDATES
  private readonly MAX_SIZE = 500; // Increased cache size
  private readonly HOT_THRESHOLD = 5; // Access count to be considered "hot"

  private getCacheKey(pageId: string, userId?: string | null): string {
    return `${pageId}:${userId || 'anonymous'}`;
  }

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

  get(pageId: string, userId?: string | null): any | null {
    this.stats.totalReads++;
    const key = this.getCacheKey(pageId, userId);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    const ttl = this.getTierTTL(entry.tier);

    // Check if entry is expired
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
    console.log(`🚀 PAGE CACHE: Hit for ${pageId} (tier: ${entry.tier}, access: ${entry.accessCount})`);

    return entry.data;
  }

  set(pageId: string, data: any, userId?: string | null, etag?: string): void {
    const key = this.getCacheKey(pageId, userId);
    const now = Date.now();

    // Smart eviction: remove least recently used cold entries first
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictLeastUseful();
    }

    // Check if we're updating an existing entry
    const existingEntry = this.cache.get(key);
    const accessCount = existingEntry ? existingEntry.accessCount : 1;
    const tier = this.determineTier(accessCount);

    this.cache.set(key, {
      data,
      timestamp: now,
      etag,
      accessCount,
      lastAccessed: now,
      tier
    });

    console.log(`💾 PAGE CACHE: Stored ${pageId} (tier: ${tier}, size: ${this.cache.size})`);
  }

  private evictLeastUseful(): void {
    // Find the least useful entry (cold tier, oldest, least accessed)
    let leastUsefulKey: string | null = null;
    let leastUsefulScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Score based on tier, recency, and access count (lower is worse)
      let score = entry.accessCount;
      if (entry.tier === 'cold') score *= 0.1;
      else if (entry.tier === 'warm') score *= 0.5;

      // Factor in recency
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
      console.log(`🗑️  PAGE CACHE: Evicted ${leastUsefulKey} (score: ${leastUsefulScore.toFixed(3)})`);
    }
  }

  has(pageId: string, userId?: string | null): boolean {
    const key = this.getCacheKey(pageId, userId);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    const ttl = this.getTierTTL(entry.tier);
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  getETag(pageId: string, userId?: string | null): string | undefined {
    const key = this.getCacheKey(pageId, userId);
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    const ttl = this.getTierTTL(entry.tier);
    if (Date.now() - entry.timestamp > ttl) {
      return undefined;
    }

    return entry.etag;
  }

  // Get cache statistics for monitoring
  getStats(): CacheStats & { hitRate: number; size: number } {
    const hitRate = this.stats.totalReads > 0 ?
      (this.stats.hits / this.stats.totalReads) * 100 : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size
    };
  }

  // Get cache breakdown by tier
  getTierBreakdown(): { hot: number; warm: number; cold: number } {
    const breakdown = { hot: 0, warm: 0, cold: 0 };

    for (const entry of this.cache.values()) {
      breakdown[entry.tier]++;
    }

    return breakdown;
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, totalReads: 0 };
    console.log('🧹 PAGE CACHE: Cleared all entries');
  }

  // Clear cache for a specific page (useful when page deleted status changes)
  clearPage(pageId: string, userId?: string | null): void {
    const key = this.getCacheKey(pageId, userId);
    if (this.cache.delete(key)) {
      console.log(`💾 PAGE CACHE: Cleared cache for ${pageId}`);
    }
  }

  invalidate(pageId: string): void {
    // Remove all entries for this page (different user contexts)
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${pageId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`🗑️  PAGE CACHE: Invalidated ${keysToDelete.length} entries for page ${pageId}`);
  }

  size(): number {
    return this.cache.size;
  }

  // Enhanced cleanup with tier-aware expiration
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
      console.log(`🧹 PAGE CACHE: Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  // Preload frequently accessed pages
  async preloadPage(pageId: string, userId?: string | null): Promise<void> {
    if (this.has(pageId, userId)) {
      return; // Already cached
    }

    try {
      // This would trigger a background fetch
      console.log(`🔄 PAGE CACHE: Preloading ${pageId} for ${userId || 'anonymous'}`);
      // Implementation would depend on your data fetching strategy
    } catch (error) {
      console.error(`❌ PAGE CACHE: Failed to preload ${pageId}:`, error);
    }
  }
}

// Export singleton instance with enhanced capabilities
export const pageCache = new EnhancedPageCache();

// Cleanup expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    pageCache.cleanup();
  }, 5 * 60 * 1000);
}
