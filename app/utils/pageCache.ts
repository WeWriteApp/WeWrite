/**
 * Simple in-memory cache for page data to improve performance
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  etag?: string;
}

class PageCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 30 * 1000; // 30 seconds
  private readonly MAX_SIZE = 100; // Maximum cache entries

  private getCacheKey(pageId: string, userId?: string | null): string {
    return `${pageId}:${userId || 'anonymous'}`;
  }

  get(pageId: string, userId?: string | null): any | null {
    const key = this.getCacheKey(pageId, userId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(pageId: string, data: any, userId?: string | null, etag?: string): void {
    const key = this.getCacheKey(pageId, userId);

    // If cache is full, remove oldest entry
    if (this.cache.size >= this.MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag
    });
  }

  has(pageId: string, userId?: string | null): boolean {
    const key = this.getCacheKey(pageId, userId);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  getETag(pageId: string, userId?: string | null): string | undefined {
    const key = this.getCacheKey(pageId, userId);
    const entry = this.cache.get(key);

    if (!entry || Date.now() - entry.timestamp > this.TTL) {
      return undefined;
    }

    return entry.etag;
  }

  clear(): void {
    this.cache.clear();
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
  }

  size(): number {
    return this.cache.size;
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// Export singleton instance
export const pageCache = new PageCache();

// Cleanup expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    pageCache.cleanup();
  }, 5 * 60 * 1000);
}
