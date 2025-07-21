"use client";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PageConnectionsData {
  incoming: any[];
  outgoing: any[];
  secondHop?: any[];
}

interface RelatedPagesData {
  relatedPages: any[];
}

interface UserPagesData {
  pages: any[];
}

/**
 * GraphDataCache - Optimized caching for graph data
 * 
 * Reduces API calls by caching:
 * - Page connections (5 minute cache)
 * - Related pages (10 minute cache) 
 * - User pages (2 minute cache)
 * - Second hop connections (5 minute cache)
 */
class GraphDataCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 2 * 60 * 60 * 1000; // 2 hours (increased from 5m for cost optimization)
  private readonly RELATED_PAGES_TTL = 4 * 60 * 60 * 1000; // 4 hours (increased from 10m)
  private readonly USER_PAGES_TTL = 1 * 60 * 60 * 1000; // 1 hour (increased from 2m)

  /**
   * Get cached data if valid, otherwise return null
   */
  private get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set data in cache with TTL
   */
  private set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    };
    this.cache.set(key, entry);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get page connections with caching
   */
  async getPageConnections(pageId: string, includeSecondHop: boolean = false): Promise<PageConnectionsData> {
    const cacheKey = `connections:${pageId}:${includeSecondHop}`;
    const cached = this.get<PageConnectionsData>(cacheKey);
    
    if (cached) {
      console.log('🚀 [CACHE] Hit for page connections:', pageId);
      return cached;
    }

    console.log('📡 [CACHE] Miss for page connections, fetching:', pageId);
    
    try {
      const response = await fetch(`/api/page-connections?pageId=${pageId}&includeSecondHop=${includeSecondHop}&limit=50`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const connectionsData: PageConnectionsData = {
        incoming: data.incoming || [],
        outgoing: data.outgoing || [],
        secondHop: data.secondHop || []
      };

      this.set(cacheKey, connectionsData);
      return connectionsData;
      
    } catch (error) {
      console.error('Error fetching page connections:', error);
      return { incoming: [], outgoing: [], secondHop: [] };
    }
  }

  /**
   * Get related pages with caching
   */
  async getRelatedPages(pageId: string, pageTitle?: string, pageContent?: string, excludeUsername?: string): Promise<RelatedPagesData> {
    const cacheKey = `related:${pageId}:${pageTitle?.substring(0, 20) || ''}:${excludeUsername || ''}`;
    const cached = this.get<RelatedPagesData>(cacheKey);

    if (cached) {
      console.log('🚀 [CACHE] Hit for related pages:', pageId);
      return cached;
    }

    console.log('📡 [CACHE] Miss for related pages, fetching:', pageId);

    try {
      const params = new URLSearchParams({
        pageId,
        limit: '10'
      });

      if (pageTitle) {
        params.append('pageTitle', pageTitle);
      }

      if (pageContent) {
        params.append('pageContent', pageContent.substring(0, 1000));
      }

      if (excludeUsername) {
        params.append('excludeUsername', excludeUsername);
      }

      const response = await fetch(`/api/related-pages?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const relatedData: RelatedPagesData = {
        relatedPages: data.relatedPages || []
      };

      this.set(cacheKey, relatedData, this.RELATED_PAGES_TTL);
      return relatedData;
      
    } catch (error) {
      console.error('Error fetching related pages:', error);
      return { relatedPages: [] };
    }
  }

  /**
   * Get user pages with caching
   */
  async getUserPages(userId: string, limit: number = 100): Promise<UserPagesData> {
    const cacheKey = `user-pages:${userId}:${limit}`;
    const cached = this.get<UserPagesData>(cacheKey);
    
    if (cached) {
      console.log('🚀 [CACHE] Hit for user pages:', userId);
      return cached;
    }

    console.log('📡 [CACHE] Miss for user pages, fetching:', userId);
    
    try {
      const response = await fetch(`/api/my-pages?userId=${userId}&limit=${limit}&sortBy=lastModified`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const userPagesData: UserPagesData = {
        pages: data.pages || []
      };

      this.set(cacheKey, userPagesData, this.USER_PAGES_TTL);
      return userPagesData;
      
    } catch (error) {
      console.error('Error fetching user pages:', error);
      return { pages: [] };
    }
  }

  /**
   * Batch fetch connections for multiple pages (optimized for UserGraphTab)
   */
  async getBatchPageConnections(pageIds: string[]): Promise<Map<string, PageConnectionsData>> {
    const results = new Map<string, PageConnectionsData>();
    const uncachedIds: string[] = [];

    // Check cache first
    for (const pageId of pageIds) {
      const cacheKey = `connections:${pageId}:false`;
      const cached = this.get<PageConnectionsData>(cacheKey);
      
      if (cached) {
        results.set(pageId, cached);
      } else {
        uncachedIds.push(pageId);
      }
    }

    if (uncachedIds.length > 0) {
      console.log('📡 [CACHE] Batch fetching connections for', uncachedIds.length, 'pages');
      
      // Fetch uncached data in parallel (limited concurrency)
      const batchSize = 5; // Limit concurrent requests
      for (let i = 0; i < uncachedIds.length; i += batchSize) {
        const batch = uncachedIds.slice(i, i + batchSize);
        
        const promises = batch.map(async (pageId) => {
          const data = await this.getPageConnections(pageId, false);
          results.set(pageId, data);
        });

        await Promise.all(promises);
      }
    }

    return results;
  }

  /**
   * Invalidate cache for a specific page (when page is updated)
   */
  invalidatePage(pageId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(pageId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log('🗑️ [CACHE] Invalidated', keysToDelete.length, 'entries for page:', pageId);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Would need to track hits/misses for accurate rate
    };
  }
}

// Global cache instance
export const graphDataCache = new GraphDataCache();

// Cleanup expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    graphDataCache.cleanup();
  }, 5 * 60 * 1000);
}
