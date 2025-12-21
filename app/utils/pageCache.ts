/**
 * Page Cache - Backwards compatibility wrapper around serverCache
 *
 * This module now delegates to the unified serverCache for simplicity.
 * The complex tiered caching has been deprecated in favor of simpler TTL-based caching.
 *
 * @deprecated Use pageCache from serverCache.ts directly for new code
 */

import { pageCache as serverPageCache, CACHE_TTL } from './serverCache';

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalReads: number;
}

class PageCacheAdapter {
  private getCacheKey(pageId: string, userId?: string | null): string {
    return `${pageId}:${userId || 'anonymous'}`;
  }

  get(pageId: string, userId?: string | null): any | null {
    const key = this.getCacheKey(pageId, userId);
    return serverPageCache.get(key);
  }

  set(pageId: string, data: any, userId?: string | null, _etag?: string): void {
    const key = this.getCacheKey(pageId, userId);
    serverPageCache.set(key, data, CACHE_TTL.PAGE);
  }

  has(pageId: string, userId?: string | null): boolean {
    const key = this.getCacheKey(pageId, userId);
    return serverPageCache.get(key) !== null;
  }

  getETag(_pageId: string, _userId?: string | null): string | undefined {
    // ETags not supported in simplified cache
    return undefined;
  }

  getStats(): CacheStats & { hitRate: number; size: number } {
    const stats = serverPageCache.getStats();
    return {
      hits: stats.hits,
      misses: stats.misses,
      evictions: 0, // Not tracked in serverCache
      totalReads: stats.hits + stats.misses,
      hitRate: stats.hitRate,
      size: serverPageCache.size()
    };
  }

  getTierBreakdown(): { hot: number; warm: number; cold: number } {
    // Simplified - no tiers in serverCache
    return { hot: 0, warm: 0, cold: serverPageCache.size() };
  }

  clear(): void {
    serverPageCache.clear();
  }

  clearPage(pageId: string, userId?: string | null): void {
    const key = this.getCacheKey(pageId, userId);
    serverPageCache.invalidate(key);
  }

  invalidate(pageId: string): void {
    // Remove all entries for this page (different user contexts)
    serverPageCache.invalidate(new RegExp(`^${pageId}:`));
  }

  size(): number {
    return serverPageCache.size();
  }

  cleanup(): void {
    // Cleanup is handled by serverCache automatically
  }

  async preloadPage(_pageId: string, _userId?: string | null): Promise<void> {
    // Preloading disabled for simplicity
  }
}

// Export singleton instance for backwards compatibility
export const pageCache = new PageCacheAdapter();
