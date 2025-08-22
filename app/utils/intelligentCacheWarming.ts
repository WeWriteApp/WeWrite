'use client';

/**
 * Simple Cache Warming System
 * 
 * Provides basic cache warming functionality.
 * Simplified version focused on essential functionality.
 */

import { getCacheItem, setCacheItem, generateCacheKey } from './cacheUtils';

interface UserBehaviorPattern {
  userId: string;
  frequentPages: Map<string, number>;
  lastActivity: number;
}

/**
 * Simple cache warming based on user behavior
 */
export class IntelligentCacheWarming {
  private static instance: IntelligentCacheWarming;
  private userPatterns: Map<string, UserBehaviorPattern> = new Map();

  static getInstance(): IntelligentCacheWarming {
    if (!IntelligentCacheWarming.instance) {
      IntelligentCacheWarming.instance = new IntelligentCacheWarming();
    }
    return IntelligentCacheWarming.instance;
  }

  /**
   * Track user page visit
   */
  trackPageVisit(userId: string, pageId: string): void {
    if (!userId || !pageId) return;

    const pattern = this.userPatterns.get(userId) || {
      userId,
      frequentPages: new Map(),
      lastActivity: Date.now()
    };

    const currentCount = pattern.frequentPages.get(pageId) || 0;
    pattern.frequentPages.set(pageId, currentCount + 1);
    pattern.lastActivity = Date.now();

    this.userPatterns.set(userId, pattern);
  }

  /**
   * Get frequently visited pages for a user
   */
  getFrequentPages(userId: string, limit: number = 5): string[] {
    const pattern = this.userPatterns.get(userId);
    if (!pattern) return [];

    return Array.from(pattern.frequentPages.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([pageId]) => pageId);
  }

  /**
   * Warm cache for user's frequent pages
   */
  async warmUserCache(userId: string): Promise<void> {
    const frequentPages = this.getFrequentPages(userId);
    
    for (const pageId of frequentPages) {
      const cacheKey = generateCacheKey('page', pageId);
      const cached = getCacheItem(cacheKey);
      
      if (!cached) {
        // Cache is empty, could warm it here
        console.log(`Could warm cache for page: ${pageId}`);
      }
    }
  }

  /**
   * Initialize cache warming (no-op for compatibility)
   */
  initialize(): void {
    // No-op for backward compatibility
  }
}

// Export singleton instance
export const cacheWarming = IntelligentCacheWarming.getInstance();

// Export for backward compatibility
export default cacheWarming;
