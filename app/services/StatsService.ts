"use client";

import { doc, getDoc, collection, query, where, getDocs, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getDatabase, ref, get, onValue, off, Database } from "firebase/database";
import { db } from "../firebase/config";
import { rtdb } from "../firebase/rtdb";
import { getCacheItem, setCacheItem, generateCacheKey } from "../utils/cacheUtils";
import { getCollectionName } from "../utils/environmentConfig";
import { UNIFIED_CACHE_TTL } from "../utils/serverCache";

// Use unified cache TTLs for consistency
const STATS_CACHE_TTL = UNIFIED_CACHE_TTL.LIVE_STATS; // 2 minutes
const LIVE_STATS_CACHE_TTL = UNIFIED_CACHE_TTL.LIVE_STATS; // 2 minutes for live stats
const USER_STATS_CACHE_TTL = UNIFIED_CACHE_TTL.ANALYTICS_DATA; // 3 hours for user stats

export interface PageStats {
  pageId: string;

  // View statistics
  totalViews: number;
  viewsLast24h: number;
  viewData: number[]; // Hourly view data for sparklines

  // Activity statistics
  recentChanges: number;
  changeData: number[]; // Hourly change data for sparklines
  editorsCount: number;

  // Live statistics
  liveReaders: number;
  totalReaders: number;

  // Supporter/Pledge statistics
  supporterCount: number;
  totalPledgedTokens: number;
  supporterData: number[]; // Hourly supporter data for sparklines
  uniqueSponsors: string[];

  // Metadata
  lastUpdated: number;
  cached: boolean;
}

export interface UserStats {
  userId: string;
  pageCount: number;
  totalViews: number;
  followerCount: number;
  supporterCount: number;
  totalEarnings: number;
  lastActive: string;
  lastUpdated: number;
  cached: boolean;
}

export interface BatchStatsResult {
  pageStats: Record<string, PageStats>;
  userStats: Record<string, UserStats>;
  cached: string[];
  fetched: string[];
  loadTime: number;
}

/**
 * Statistics Service
 *
 * Consolidates:
 * - CachedStatsService.ts
 * - PageStatsService.ts
 * - pledgeStatsService.ts
 * - /api/tokens/page-stats functionality
 *
 * Features:
 * - Single source of truth for all statistics
 * - Unified caching strategy
 * - Real-time subscriptions
 * - Batch operations for performance
 * - Consistent error handling
 */
class StatsService {
  private pageStatsCache = new Map<string, { data: PageStats; timestamp: number }>();
  private userStatsCache = new Map<string, { data: UserStats; timestamp: number }>();
  private activeSubscriptions = new Map<string, () => void>();
  private rtdb: Database;

  constructor() {
    this.rtdb = getDatabase();
  }

  /**
   * Get comprehensive page statistics with caching
   */
  async getPageStats(pageId: string, forceRefresh = false): Promise<PageStats> {
    const cacheKey = generateCacheKey('pageStats', pageId);
    
    // Check memory cache first
    if (!forceRefresh) {
      const memoryCache = this.pageStatsCache.get(pageId);
      if (memoryCache && Date.now() - memoryCache.timestamp < STATS_CACHE_TTL) {
        return { ...memoryCache.data, cached: true };
      }

      // Check localStorage cache
      const cachedStats = getCacheItem<PageStats>(cacheKey);
      if (cachedStats) {
        // Update memory cache
        this.pageStatsCache.set(pageId, {
          data: cachedStats,
          timestamp: Date.now()
        });
        return { ...cachedStats, cached: true };
      }
    }

    // Fetch fresh data
    const stats = await this.fetchPageStatsFromSources(pageId);
    
    // Cache the result
    this.pageStatsCache.set(pageId, {
      data: stats,
      timestamp: Date.now()
    });
    setCacheItem(cacheKey, stats, STATS_CACHE_TTL);

    return { ...stats, cached: false };
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
        return { ...memoryCache.data, cached: true };
      }

      // Check localStorage cache
      const cachedStats = getCacheItem<UserStats>(cacheKey);
      if (cachedStats) {
        // Update memory cache
        this.userStatsCache.set(userId, {
          data: cachedStats,
          timestamp: Date.now()
        });
        return { ...cachedStats, cached: true };
      }
    }

    // Fetch fresh data
    const stats = await this.fetchUserStatsFromSources(userId);
    
    // Cache the result
    this.userStatsCache.set(userId, {
      data: stats,
      timestamp: Date.now()
    });
    setCacheItem(cacheKey, stats, USER_STATS_CACHE_TTL);

    return { ...stats, cached: false };
  }

  /**
   * Batch fetch multiple page and user stats for performance
   */
  async getBatchStats(pageIds: string[] = [], userIds: string[] = []): Promise<BatchStatsResult> {
    const startTime = performance.now();
    
    const result: BatchStatsResult = {
      pageStats: {},
      userStats: {},
      cached: [],
      fetched: [],
      loadTime: 0
    };

    // Process page stats in parallel
    const pageStatsPromises = pageIds.map(async (pageId) => {
      const stats = await this.getPageStats(pageId);
      result.pageStats[pageId] = stats;
      if (stats.cached) {
        result.cached.push(`page:${pageId}`);
      } else {
        result.fetched.push(`page:${pageId}`);
      }
    });

    // Process user stats in parallel
    const userStatsPromises = userIds.map(async (userId) => {
      const stats = await this.getUserStats(userId);
      result.userStats[userId] = stats;
      if (stats.cached) {
        result.cached.push(`user:${userId}`);
      } else {
        result.fetched.push(`user:${userId}`);
      }
    });

    // Wait for all to complete
    await Promise.all([...pageStatsPromises, ...userStatsPromises]);

    result.loadTime = performance.now() - startTime;

    return result;
  }

  /**
   * Subscribe to real-time page statistics updates
   * DISABLED: Real-time listeners disabled to reduce Firebase costs - use API polling instead
   */
  subscribeToPageStats(pageId: string, callback: (stats: PageStats) => void): () => void {
    // Return a no-op unsubscriber to prevent breaking the UI
    return () => {};
  }

  /**
   * Subscribe to real-time user statistics updates
   */
  subscribeToUserStats(userId: string, callback: (stats: UserStats) => void): () => void {
    const subscriptionKey = `userStats:${userId}`;
    
    // Clean up existing subscription
    this.unsubscribe(subscriptionKey);

    // Set up user stats listener (simplified for now)
    const unsubscriber = () => {
      this.activeSubscriptions.delete(subscriptionKey);
    };

    // Periodic refresh for user stats (less frequent than page stats)
    const interval = setInterval(async () => {
      try {
        const stats = await this.getUserStats(userId, true);
        callback(stats);
      } catch (error) {
        console.error('Error refreshing user stats:', error);
      }
    }, 60000); // 1 minute

    const combinedUnsubscriber = () => {
      clearInterval(interval);
      this.activeSubscriptions.delete(subscriptionKey);
    };

    this.activeSubscriptions.set(subscriptionKey, combinedUnsubscriber);
    return combinedUnsubscriber;
  }

  /**
   * Unsubscribe from specific stats
   */
  unsubscribe(subscriptionKey: string): void {
    const unsubscriber = this.activeSubscriptions.get(subscriptionKey);
    if (unsubscriber) {
      unsubscriber();
    }
  }

  /**
   * Unsubscribe from all active subscriptions
   */
  unsubscribeAll(): void {
    this.activeSubscriptions.forEach(unsubscriber => {
      try {
        unsubscriber();
      } catch (error) {
        console.error('Error unsubscribing:', error);
      }
    });
    this.activeSubscriptions.clear();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.pageStatsCache.clear();
    this.userStatsCache.clear();

    // Clear localStorage cache
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('pageStats') || key.includes('userStats')) {
          localStorage.removeItem(key);
        }
      });
    }
  }

  /**
   * Handle stats update from real-time listeners
   */
  private async handleStatsUpdate(pageId: string, callback: (stats: PageStats) => void): Promise<void> {
    try {
      // Invalidate cache and fetch fresh data
      this.pageStatsCache.delete(pageId);
      const stats = await this.getPageStats(pageId, true);
      callback(stats);
    } catch (error) {
      console.error('Error handling stats update:', error);
    }
  }

  /**
   * Fetch page stats from all sources (RTDB + Firestore)
   */
  private async fetchPageStatsFromSources(pageId: string): Promise<PageStats> {
    try {
      // Fetch from multiple sources in parallel
      const [
        rtdbStats,
        pledgeStats,
        viewStats
      ] = await Promise.all([
        this.fetchRTDBPageStats(pageId),
        this.fetchPledgeStats(pageId),
        this.fetchViewStats(pageId)
      ]);

      return {
        pageId,

        // View statistics
        totalViews: viewStats.totalViews,
        viewsLast24h: viewStats.viewsLast24h,
        viewData: viewStats.viewData,

        // Activity statistics
        recentChanges: rtdbStats.recentChanges,
        changeData: rtdbStats.changeData,
        editorsCount: rtdbStats.editorsCount,

        // Live statistics
        liveReaders: rtdbStats.liveReaders,
        totalReaders: rtdbStats.totalReaders,

        // Supporter/Pledge statistics
        supporterCount: pledgeStats.sponsorCount,
        totalPledgedTokens: pledgeStats.totalPledgedTokens,
        supporterData: pledgeStats.supporterData,
        uniqueSponsors: pledgeStats.uniqueSponsors,

        // Metadata
        lastUpdated: Date.now(),
        cached: false
      };
    } catch (error) {
      console.error('Error fetching page stats:', error);
      return this.getEmptyPageStats(pageId);
    }
  }

  /**
   * Fetch user stats from all sources
   */
  private async fetchUserStatsFromSources(userId: string): Promise<UserStats> {
    try {
      // Fetch user stats from Firestore
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();

      // Get user's pages count
      const pagesQuery = query(
        collection(db, getCollectionName('pages')),
        where('userId', '==', userId),
        where('deleted', '!=', true)
      );
      const pagesSnapshot = await getDocs(pagesQuery);

      // Calculate total views across all user's pages
      let totalViews = 0;
      pagesSnapshot.docs.forEach(doc => {
        const pageData = doc.data();
        totalViews += pageData.viewCount || pageData.views || 0;
      });

      return {
        userId,
        pageCount: pagesSnapshot.size,
        totalViews,
        followerCount: userData?.followerCount || 0,
        supporterCount: userData?.supporterCount || 0,
        totalEarnings: userData?.totalEarnings || 0,
        lastActive: userData?.lastActive || new Date().toISOString(),
        lastUpdated: Date.now(),
        cached: false
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return this.getEmptyUserStats(userId);
    }
  }

  /**
   * Fetch page activity stats using unified version system
   */
  private async fetchRTDBPageStats(pageId: string): Promise<{
    recentChanges: number;
    changeData: number[];
    editorsCount: number;
    liveReaders: number;
    totalReaders: number;
  }> {
    try {
      // Use unified version system for recent changes data
      const recentChangesData = await this.fetchRecentChangesFromVersions(pageId);

      // Still fetch live reader data from RTDB if available
      let liveReaders = 0;
      let totalReaders = 0;

      if (this.rtdb) {
        try {
          const [
            totalReadersSnapshot,
            liveReadersSnapshot
          ] = await Promise.all([
            get(ref(this.rtdb, `pageStats/${pageId}/totalReaders`)),
            get(ref(this.rtdb, `liveReaders/${pageId}/count`))
          ]);

          liveReaders = liveReadersSnapshot.exists() ? liveReadersSnapshot.val() : 0;
          totalReaders = totalReadersSnapshot.exists() ? totalReadersSnapshot.val() : 0;
        } catch (rtdbError) {
          console.warn('🟡 RTDB not available for live reader stats, using fallback');
        }
      }

      return {
        recentChanges: recentChangesData.recentChanges,
        changeData: recentChangesData.changeData,
        editorsCount: recentChangesData.editorsCount,
        liveReaders,
        totalReaders
      };
    } catch (error) {
      console.error('🔴 Error fetching page activity stats:', error);
      return this.getFallbackRTDBStats();
    }
  }

  /**
   * Fetch recent changes data from unified version system
   */
  private async fetchRecentChangesFromVersions(pageId: string): Promise<{
    recentChanges: number;
    changeData: number[];
    editorsCount: number;
  }> {
    try {
      // Fetch recent edits for this specific page using the same API as homepage/user profile
      const response = await fetch(`/api/recent-edits/global?limit=50&includeOwn=true&followingOnly=false`);

      if (!response.ok) {
        throw new Error(`Recent edits API failed: ${response.status}`);
      }

      const data = await response.json();
      const edits = data.edits || [];

      // Filter edits for this specific page
      const pageEdits = edits.filter(edit => edit.id === pageId);

      // Count recent changes (last 24 hours)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

      const recentEdits = pageEdits.filter(edit => {
        const editDate = new Date(edit.lastModified);
        return editDate >= twentyFourHoursAgo;
      });

      // Generate hourly data for sparkline (last 24 hours)
      const changeData = Array(24).fill(0);
      recentEdits.forEach(edit => {
        const editDate = new Date(edit.lastModified);
        const hoursAgo = Math.floor((now.getTime() - editDate.getTime()) / (1000 * 60 * 60));
        if (hoursAgo >= 0 && hoursAgo < 24) {
          changeData[23 - hoursAgo]++; // Most recent hour at the end
        }
      });

      // Count unique editors
      const uniqueEditors = new Set(pageEdits.map(edit => edit.userId));

      return {
        recentChanges: recentEdits.length,
        changeData,
        editorsCount: uniqueEditors.size
      };
    } catch (error) {
      console.error('Error fetching recent changes from versions:', error);
      return {
        recentChanges: 0,
        changeData: Array(24).fill(0),
        editorsCount: 0
      };
    }
  }

  /**
   * Fallback RTDB stats for when RTDB is unavailable or permission denied
   */
  private getFallbackRTDBStats() {
    return {
      recentChanges: 0,
      changeData: Array(24).fill(0),
      editorsCount: 0,
      liveReaders: 0,
      totalReaders: 0
    };
  }

  /**
   * Fetch pledge/supporter stats
   */
  private async fetchPledgeStats(pageId: string): Promise<{
    sponsorCount: number;
    totalPledgedTokens: number;
    supporterData: number[];
    uniqueSponsors: string[];
  }> {
    try {
      // Try global pledges collection first
      const pledgesQuery = query(
        collection(db, getCollectionName('pledges')),
        where('pageId', '==', pageId),
        where('status', 'in', ['active', 'completed'])
      );

      const pledgesSnapshot = await getDocs(pledgesQuery);

      if (!pledgesSnapshot.empty) {
        const uniqueSponsors = new Set<string>();
        let totalPledgedTokens = 0;

        pledgesSnapshot.forEach(doc => {
          const pledgeData = doc.data();
          if (pledgeData.userId) {
            uniqueSponsors.add(pledgeData.userId);
          }
          totalPledgedTokens += pledgeData.amount || 0;
        });

        // Generate mock hourly data for sparklines
        const supporterData = Array.from({ length: 24 }, () => Math.floor(Math.random() * 3));

        return {
          sponsorCount: uniqueSponsors.size,
          totalPledgedTokens,
          supporterData,
          uniqueSponsors: Array.from(uniqueSponsors)
        };
      }

      // Fallback to API
      const response = await fetch(`/api/tokens/page-stats?pageId=${pageId}`);
      if (response.ok) {
        const data = await response.json();
        return {
          sponsorCount: data.data?.sponsorCount || 0,
          totalPledgedTokens: data.data?.totalPledgedTokens || 0,
          supporterData: Array(24).fill(0),
          uniqueSponsors: data.data?.uniqueSponsors || []
        };
      }

      throw new Error('No pledge data available');
    } catch (error) {
      console.error('Error fetching pledge stats:', error);
      return {
        sponsorCount: 0,
        totalPledgedTokens: 0,
        supporterData: Array(24).fill(0),
        uniqueSponsors: []
      };
    }
  }

  /**
   * Fetch view stats using real database data
   */
  private async fetchViewStats(pageId: string): Promise<{
    totalViews: number;
    viewsLast24h: number;
    viewData: number[];
  }> {
    try {
      // Import the real view tracking functions
      const { getPageViewsLast24Hours, getPageTotalViews } = await import('../firebase/pageViews');

      // Get real view data from database
      const [totalViews, viewsData] = await Promise.all([
        getPageTotalViews(pageId),
        getPageViewsLast24Hours(pageId)
      ]);

      return {
        totalViews: totalViews || 0,
        viewsLast24h: viewsData.total || 0,
        viewData: viewsData.hourly || Array(24).fill(0)
      };
    } catch (error) {
      console.error('Error fetching view stats:', error);
      return {
        totalViews: 0,
        viewsLast24h: 0,
        viewData: Array(24).fill(0)
      };
    }
  }

  /**
   * Get empty page stats structure
   */
  private getEmptyPageStats(pageId: string): PageStats {
    return {
      pageId,
      totalViews: 0,
      viewsLast24h: 0,
      viewData: Array(24).fill(0),
      recentChanges: 0,
      changeData: Array(24).fill(0),
      editorsCount: 0,
      liveReaders: 0,
      totalReaders: 0,
      supporterCount: 0,
      totalPledgedTokens: 0,
      supporterData: Array(24).fill(0),
      uniqueSponsors: [],
      lastUpdated: Date.now(),
      cached: false
    };
  }

  /**
   * Get empty user stats structure
   */
  private getEmptyUserStats(userId: string): UserStats {
    return {
      userId,
      pageCount: 0,
      totalViews: 0,
      followerCount: 0,
      supporterCount: 0,
      totalEarnings: 0,
      lastActive: new Date().toISOString(),
      lastUpdated: Date.now(),
      cached: false
    };
  }
}

// Create singleton instance
export const statsService = new StatsService();

// Export convenience functions for backward compatibility
export const getPageStats = (pageId: string, forceRefresh = false) =>
  statsService.getPageStats(pageId, forceRefresh);

export const getUserStats = (userId: string, forceRefresh = false) =>
  statsService.getUserStats(userId, forceRefresh);

export const getBatchStats = (pageIds: string[] = [], userIds: string[] = []) =>
  statsService.getBatchStats(pageIds, userIds);

export const subscribeToPageStats = (pageId: string, callback: (stats: PageStats) => void) =>
  statsService.subscribeToPageStats(pageId, callback);

export const subscribeToUserStats = (userId: string, callback: (stats: UserStats) => void) =>
  statsService.subscribeToUserStats(userId, callback);

// Backward compatibility exports
export const unifiedStatsService = statsService;
export type UnifiedPageStats = PageStats;
export type UnifiedUserStats = UserStats;
