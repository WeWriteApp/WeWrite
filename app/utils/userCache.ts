/**
 * Enhanced User Data Cache System
 * 
 * Comprehensive caching for all user-related data to reduce database reads
 * Supports profiles, stats, subscription data, and batch operations
 */

interface UserCacheEntry {
  data: any;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  tier: 'hot' | 'warm' | 'cold';
  dataType: 'profile' | 'stats' | 'subscription' | 'batch';
}

interface UserCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  costSavings: number;
}

class EnhancedUserCache {
  private cache = new Map<string, UserCacheEntry>();
  private stats: UserCacheStats = { hits: 0, misses: 0, evictions: 0, totalRequests: 0, costSavings: 0 };
  
  // Aggressive caching configuration for cost optimization
  private readonly HOT_TTL = 15 * 60 * 1000;    // 15 minutes for frequently accessed users
  private readonly WARM_TTL = 60 * 60 * 1000;   // 1 hour for moderately accessed users
  private readonly COLD_TTL = 4 * 60 * 60 * 1000; // 4 hours for rarely accessed users
  private readonly MAX_SIZE = 1000; // Large cache for user data
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
   * Get cached user data
   */
  get(userId: string, dataType: 'profile' | 'stats' | 'subscription' | 'batch' = 'profile'): any | null {
    this.stats.totalRequests++;
    const key = `${dataType}:${userId}`;
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
    this.stats.costSavings += 0.00036 / 1000; // Firestore read cost saved

    console.log(`🚀 USER CACHE: Hit for ${userId} ${dataType} (tier: ${entry.tier}, access: ${entry.accessCount})`);
    return entry.data;
  }

  /**
   * Cache user data
   */
  set(userId: string, data: any, dataType: 'profile' | 'stats' | 'subscription' | 'batch' = 'profile'): void {
    const key = `${dataType}:${userId}`;
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
      dataType
    });

    console.log(`💾 USER CACHE: Stored ${userId} ${dataType} (tier: ${tier}, size: ${this.cache.size})`);
  }

  /**
   * Get user profile with automatic fallback to API
   */
  async getProfile(userId: string): Promise<any | null> {
    // Check cache first
    const cached = this.get(userId, 'profile');
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from API
    try {
      console.log(`💸 USER CACHE: Profile cache miss for ${userId} - fetching from API`);
      
      const response = await fetch(`/api/users/profile?id=${encodeURIComponent(userId)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success || result.data) {
        const profileData = result.data || result;
        this.set(userId, profileData, 'profile');
        return profileData;
      }
    } catch (error) {
      console.error(`❌ USER CACHE: Failed to fetch profile for ${userId}:`, error);
    }

    return null;
  }

  /**
   * Batch get multiple user profiles
   */
  async getBatchProfiles(userIds: string[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const uncachedIds: string[] = [];

    // Check cache for each user
    for (const userId of userIds) {
      const cached = this.get(userId, 'profile');
      if (cached) {
        results[userId] = cached;
      } else {
        uncachedIds.push(userId);
      }
    }

    console.log(`🔍 USER CACHE: Batch request - ${Object.keys(results).length} cached, ${uncachedIds.length} need fetching`);

    // Fetch uncached users
    if (uncachedIds.length > 0) {
      try {
        // Use existing batch user data function
        const { getBatchUserDataOptimized } = await import('../api/home/route');
        const freshData = await getBatchUserDataOptimized(uncachedIds);

        // Cache the fresh data
        for (const [userId, userData] of Object.entries(freshData)) {
          this.set(userId, userData, 'profile');
          results[userId] = userData;
        }
      } catch (error) {
        console.error('❌ USER CACHE: Batch fetch failed:', error);
      }
    }

    return results;
  }

  /**
   * Smart eviction strategy
   */
  private evictLeastUseful(): void {
    let leastUsefulKey: string | null = null;
    let leastUsefulScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Score based on tier, recency, and access count
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
      console.log(`🗑️  USER CACHE: Evicted ${leastUsefulKey} (score: ${leastUsefulScore.toFixed(3)})`);
    }
  }

  /**
   * Invalidate user data when updated
   */
  invalidateUser(userId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(`:${userId}`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`🗑️  USER CACHE: Invalidated ${keysToDelete.length} entries for user ${userId}`);
  }

  /**
   * Get cache statistics
   */
  getStats(): UserCacheStats & { hitRate: number; size: number; tierBreakdown: any } {
    const hitRate = this.stats.totalRequests > 0 ? 
      (this.stats.hits / this.stats.totalRequests) * 100 : 0;

    // Calculate tier breakdown
    const tierBreakdown = { hot: 0, warm: 0, cold: 0 };
    for (const entry of this.cache.values()) {
      tierBreakdown[entry.tier]++;
    }

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
      tierBreakdown
    };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, totalRequests: 0, costSavings: 0 };
    console.log('🧹 USER CACHE: Cleared all entries');
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
      console.log(`🧹 USER CACHE: Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Preload frequently accessed users
   */
  async preloadUsers(userIds: string[]): Promise<void> {
    const uncachedIds = userIds.filter(id => !this.get(id, 'profile'));
    
    if (uncachedIds.length > 0) {
      console.log(`🔄 USER CACHE: Preloading ${uncachedIds.length} users`);
      await this.getBatchProfiles(uncachedIds);
    }
  }
}

// Export singleton instance
export const userCache = new EnhancedUserCache();

// Cleanup expired entries every 15 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    userCache.cleanup();
  }, 15 * 60 * 1000);
}
