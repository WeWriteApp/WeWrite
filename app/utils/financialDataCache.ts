/**
 * Financial Data Cache
 *
 * Caches user financial data (USD balance, subscriptions, earnings).
 * Handles both memory and persistent cache with clear expiration logic.
 */

import { getCacheItem, setCacheItem, generateCacheKey } from './cacheUtils';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  userId: string;
}

interface CacheConfig {
  /** Cache duration in milliseconds */
  duration: number;
  /** Whether to use persistent cache (localStorage) */
  persistent: boolean;
  /** Key prefix for cache entries */
  keyPrefix: string;
}

/**
 * Financial data cache manager with memory and optional persistent storage
 */
export class FinancialDataCache<T> {
  private memoryCache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Get cached data for a user
   */
  get(userId: string): T | null {
    const now = Date.now();

    // Check memory cache first
    const memoryCached = this.memoryCache.get(userId);
    if (memoryCached && this.isValid(memoryCached, now)) {
      return memoryCached.data;
    }

    // Check persistent cache if enabled
    if (this.config.persistent) {
      const persistentKey = generateCacheKey(this.config.keyPrefix, userId);
      const persistentCached = getCacheItem<T>(persistentKey);
      
      if (persistentCached) {
        // Update memory cache
        this.memoryCache.set(userId, {
          data: persistentCached,
          timestamp: now,
          userId
        });
        
        return persistentCached;
      }
    }

    return null;
  }

  /**
   * Set cached data for a user
   */
  set(userId: string, data: T): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      userId
    };

    // Update memory cache
    this.memoryCache.set(userId, entry);

    // Update persistent cache if enabled
    if (this.config.persistent) {
      const persistentKey = generateCacheKey(this.config.keyPrefix, userId);
      setCacheItem(persistentKey, data, this.config.duration);
    }

  }

  /**
   * Clear cached data for a user
   */
  clear(userId: string): void {
    this.memoryCache.delete(userId);
    
    if (this.config.persistent) {
      const persistentKey = generateCacheKey(this.config.keyPrefix, userId);
      // Note: cacheUtils doesn't have a delete method, so we set with 0 duration
      setCacheItem(persistentKey, null, 0);
    }

  }

  /**
   * Clear all cached data
   */
  clearAll(): void {
    this.memoryCache.clear();
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry<T>, now: number): boolean {
    const age = now - entry.timestamp;
    return age < this.config.duration;
  }

  /**
   * Get cache age in seconds for debugging
   */
  getCacheAge(userId: string): number | null {
    const entry = this.memoryCache.get(userId);
    if (!entry) return null;
    
    return Math.round((Date.now() - entry.timestamp) / 1000);
  }
}

/**
 * Pre-configured cache instances for common use cases
 */

// Import types for proper typing
import type { UsdBalance, SubscriptionData, EarningsData } from '../services/usdDataService';

// USD Balance cache - 30 minutes duration with persistent storage
export const usdBalanceCache = new FinancialDataCache<UsdBalance>({
  duration: 30 * 60 * 1000, // 30 minutes
  persistent: true,
  keyPrefix: 'usd_balance'
});

// Subscription cache - 15 minutes duration with persistent storage
export const subscriptionCache = new FinancialDataCache<SubscriptionData>({
  duration: 15 * 60 * 1000, // 15 minutes
  persistent: true,
  keyPrefix: 'subscription'
});

// Earnings cache - 10 minutes duration with persistent storage
export const earningsCache = new FinancialDataCache<EarningsData>({
  duration: 10 * 60 * 1000, // 10 minutes
  persistent: true,
  keyPrefix: 'earnings'
});

/**
 * Utility function to create a financial data cache with custom config
 */
export function createFinancialDataCache<T>(config: CacheConfig): FinancialDataCache<T> {
  return new FinancialDataCache<T>(config);
}
