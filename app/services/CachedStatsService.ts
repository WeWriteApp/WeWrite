"use client";

import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { rtdb } from "../firebase/rtdb";
import { ref, get, onValue, off } from "firebase/database";
import { getCacheItem, setCacheItem, generateCacheKey } from "../utils/cacheUtils";

// Aggressive cache TTL for different types of stats
const STATS_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours (increased from 5 minutes)
const LIVE_STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for live stats (increased from 30s)
const USER_STATS_CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours for user stats (increased from 10m)

export interface PageStats {
  pageId: string;
  recentChanges: number;
  editorsCount: number;
  totalReaders: number;
  liveReaders: number;
  supportersStats?: {
    totalSupporters: number;
    totalAmount: number;
    recentSupporters: number;
  };
  viewsLast24h?: number;
  totalViews?: number;
  lastUpdated: number;
}

export interface UserStats {
  userId: string;
  pageCount: number;
  totalViews: number;
  followerCount: number;
  supporterCount?: number;
  lastActive?: string;
  lastUpdated: number;
}

export interface BatchStatsResult {
  pageStats: Record<string, PageStats>;
  userStats: Record<string, UserStats>;
  cached: string[];
  fetched: string[];
}

/**
 * Centralized stats service with intelligent caching
 * Replaces individual real-time listeners with efficient batch queries
 */
class CachedStatsService {
  private pageStatsCache = new Map<string, { data: PageStats; timestamp: number }>();
  private userStatsCache = new Map<string, { data: UserStats; timestamp: number }>();
  private activeListeners = new Map<string, () => void>();

  /**
   * Get page statistics with caching
   */
  async getPageStats(pageId: string, forceRefresh = false): Promise<PageStats> {
    const cacheKey = generateCacheKey('pageStats', pageId);
    
    // Check memory cache first
    if (!forceRefresh) {
      const memoryCache = this.pageStatsCache.get(pageId);
      if (memoryCache && Date.now() - memoryCache.timestamp < STATS_CACHE_TTL) {
        return memoryCache.data;
      }

      // Check localStorage cache
      const cachedStats = getCacheItem<PageStats>(cacheKey);
      if (cachedStats) {
        // Update memory cache
        this.pageStatsCache.set(pageId, {
          data: cachedStats,
          timestamp: Date.now()
        });
        return cachedStats;
      }
    }

    // Fetch fresh data
    const stats = await this.fetchPageStatsFromDB(pageId);
    
    // Cache the result
    setCacheItem(cacheKey, stats, STATS_CACHE_TTL);
    this.pageStatsCache.set(pageId, {
      data: stats,
      timestamp: Date.now()
    });

    return stats;
  }

  /**
   * Get user statistics with caching
   */
  async getUserStats(userId: string, forceRefresh = false): Promise<UserStats> {
    const cacheKey = generateCacheKey('userStats', userId);
    
    // Check memory cache first
    if (!forceRefresh) {
      const memoryCache = this.userStatsCache.get(userId);
      if (memoryCache && Date.now() - memoryCache.timestamp < USER_STATS_CACHE_TTL) {
        return memoryCache.data;
      }

      // Check localStorage cache
      const cachedStats = getCacheItem<UserStats>(cacheKey);
      if (cachedStats) {
        // Update memory cache
        this.userStatsCache.set(userId, {
          data: cachedStats,
          timestamp: Date.now()
        });
        return cachedStats;
      }
    }

    // Fetch fresh data
    const stats = await this.fetchUserStatsFromDB(userId);
    
    // Cache the result
    setCacheItem(cacheKey, stats, USER_STATS_CACHE_TTL);
    this.userStatsCache.set(userId, {
      data: stats,
      timestamp: Date.now()
    });

    return stats;
  }

  /**
   * Batch fetch multiple page and user stats
   */
  async getBatchStats(pageIds: string[] = [], userIds: string[] = []): Promise<BatchStatsResult> {
    const result: BatchStatsResult = {
      pageStats: {},
      userStats: {},
      cached: [],
      fetched: []
    };

    // Process page stats
    const uncachedPageIds: string[] = [];
    
    for (const pageId of pageIds) {
      const cacheKey = generateCacheKey('pageStats', pageId);
      const cachedStats = getCacheItem<PageStats>(cacheKey);
      
      if (cachedStats) {
        result.pageStats[pageId] = cachedStats;
        result.cached.push(`page:${pageId}`);
      } else {
        uncachedPageIds.push(pageId);
      }
    }

    // Process user stats
    const uncachedUserIds: string[] = [];
    
    for (const userId of userIds) {
      const cacheKey = generateCacheKey('userStats', userId);
      const cachedStats = getCacheItem<UserStats>(cacheKey);
      
      if (cachedStats) {
        result.userStats[userId] = cachedStats;
        result.cached.push(`user:${userId}`);
      } else {
        uncachedUserIds.push(userId);
      }
    }

    // Batch fetch uncached data
    const [pageStatsResults, userStatsResults] = await Promise.all([
      this.batchFetchPageStats(uncachedPageIds),
      this.batchFetchUserStats(uncachedUserIds)
    ]);

    // Merge results
    Object.assign(result.pageStats, pageStatsResults);
    Object.assign(result.userStats, userStatsResults);
    
    result.fetched.push(
      ...uncachedPageIds.map(id => `page:${id}`),
      ...uncachedUserIds.map(id => `user:${id}`)
    );

    return result;
  }

  /**
   * Subscribe to live stats updates (sparingly used)
   */
  subscribeToLiveStats(pageId: string, callback: (stats: Partial<PageStats>) => void): () => void {
    const listenerId = `live-${pageId}`;
    
    // Remove existing listener if any
    this.unsubscribeFromLiveStats(pageId);

    // Set up real-time listener for critical live stats only
    const liveReadersRef = ref(rtdb, `liveReaders/${pageId}/count`);
    const recentChangesRef = ref(rtdb, `pageStats/${pageId}/recentChanges`);

    const liveReadersListener = onValue(liveReadersRef, (snapshot) => {
      const liveReaders = snapshot.exists() ? snapshot.val() : 0;
      callback({ liveReaders });
    });

    const recentChangesListener = onValue(recentChangesRef, (snapshot) => {
      const recentChanges = snapshot.exists() ? snapshot.val() : 0;
      callback({ recentChanges });
    });

    // Store cleanup function
    const cleanup = () => {
      off(liveReadersRef, 'value', liveReadersListener);
      off(recentChangesRef, 'value', recentChangesListener);
    };

    this.activeListeners.set(listenerId, cleanup);
    return cleanup;
  }

  /**
   * Unsubscribe from live stats
   */
  unsubscribeFromLiveStats(pageId: string): void {
    const listenerId = `live-${pageId}`;
    const cleanup = this.activeListeners.get(listenerId);
    
    if (cleanup) {
      cleanup();
      this.activeListeners.delete(listenerId);
    }
  }

  /**
   * Clear cache for specific items
   */
  clearCache(type: 'page' | 'user' | 'all', id?: string): void {
    if (type === 'all') {
      this.pageStatsCache.clear();
      this.userStatsCache.clear();
      // Clear localStorage cache
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('wewrite_pageStats_') || key.startsWith('wewrite_userStats_')) {
          localStorage.removeItem(key);
        }
      });
    } else if (type === 'page' && id) {
      this.pageStatsCache.delete(id);
      const cacheKey = generateCacheKey('pageStats', id);
      localStorage.removeItem(cacheKey);
    } else if (type === 'user' && id) {
      this.userStatsCache.delete(id);
      const cacheKey = generateCacheKey('userStats', id);
      localStorage.removeItem(cacheKey);
    }
  }

  /**
   * Preload stats for better performance
   */
  async preloadStats(pageIds: string[] = [], userIds: string[] = []): Promise<void> {
    // Fire and forget - don't wait for the result
    this.getBatchStats(pageIds, userIds).catch(error => {
      console.warn('Error preloading stats:', error);
    });
  }

  /**
   * Private method to fetch page stats from database
   */
  private async fetchPageStatsFromDB(pageId: string): Promise<PageStats> {
    try {
      // Fetch from RTDB in parallel
      const [
        recentChangesSnapshot,
        editorsSnapshot,
        totalReadersSnapshot,
        liveReadersSnapshot
      ] = await Promise.all([
        get(ref(rtdb, `pageStats/${pageId}/recentChanges`)),
        get(ref(rtdb, `pageStats/${pageId}/editors`)),
        get(ref(rtdb, `pageStats/${pageId}/totalReaders`)),
        get(ref(rtdb, `liveReaders/${pageId}/count`))
      ]);

      return {
        pageId,
        recentChanges: recentChangesSnapshot.exists() ? recentChangesSnapshot.val() : 0,
        editorsCount: editorsSnapshot.exists() ? editorsSnapshot.val() : 0,
        totalReaders: totalReadersSnapshot.exists() ? totalReadersSnapshot.val() : 0,
        liveReaders: liveReadersSnapshot.exists() ? liveReadersSnapshot.val() : 0,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error(`Error fetching page stats for ${pageId}:`, error);
      return {
        pageId,
        recentChanges: 0,
        editorsCount: 0,
        totalReaders: 0,
        liveReaders: 0,
        lastUpdated: Date.now()
      };
    }
  }

  /**
   * Private method to fetch user stats from database
   */
  private async fetchUserStatsFromDB(userId: string): Promise<UserStats> {
    try {
      // Fetch user data from RTDB
      const userSnapshot = await get(ref(rtdb, `users/${userId}`));
      const userData = userSnapshot.exists() ? userSnapshot.val() : {};

      return {
        userId,
        pageCount: userData.pageCount || 0,
        totalViews: userData.totalViews || 0,
        followerCount: userData.followerCount || 0,
        lastActive: userData.lastActive,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error(`Error fetching user stats for ${userId}:`, error);
      return {
        userId,
        pageCount: 0,
        totalViews: 0,
        followerCount: 0,
        lastUpdated: Date.now()
      };
    }
  }

  /**
   * Private method to batch fetch page stats
   */
  private async batchFetchPageStats(pageIds: string[]): Promise<Record<string, PageStats>> {
    const results: Record<string, PageStats> = {};
    
    // Process in batches to avoid overwhelming the database
    const batchSize = 10;
    
    for (let i = 0; i < pageIds.length; i += batchSize) {
      const batch = pageIds.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(pageId => this.fetchPageStatsFromDB(pageId))
      );
      
      batchResults.forEach(stats => {
        results[stats.pageId] = stats;
        
        // Cache the result
        const cacheKey = generateCacheKey('pageStats', stats.pageId);
        setCacheItem(cacheKey, stats, STATS_CACHE_TTL);
      });
    }
    
    return results;
  }

  /**
   * Private method to batch fetch user stats
   */
  private async batchFetchUserStats(userIds: string[]): Promise<Record<string, UserStats>> {
    const results: Record<string, UserStats> = {};
    
    // Process in batches
    const batchSize = 10;
    
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(userId => this.fetchUserStatsFromDB(userId))
      );
      
      batchResults.forEach(stats => {
        results[stats.userId] = stats;
        
        // Cache the result
        const cacheKey = generateCacheKey('userStats', stats.userId);
        setCacheItem(cacheKey, stats, USER_STATS_CACHE_TTL);
      });
    }
    
    return results;
  }

  /**
   * Cleanup all listeners and caches
   */
  cleanup(): void {
    // Clean up all active listeners
    this.activeListeners.forEach(cleanup => cleanup());
    this.activeListeners.clear();
    
    // Clear memory caches
    this.pageStatsCache.clear();
    this.userStatsCache.clear();
  }
}

// Create a singleton instance
export const cachedStatsService = new CachedStatsService();