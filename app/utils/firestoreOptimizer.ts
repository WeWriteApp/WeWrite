/**
 * Firestore Optimization Utilities
 * 
 * Provides advanced caching, batching, and query optimization strategies
 * to minimize Firestore costs and improve performance.
 */

import { 
  writeBatch, 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  getDocs,
  getDoc,
  DocumentSnapshot,
  QuerySnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/database/core';
import { getCollectionName } from './environmentConfig';

// Cache configuration
interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of cached items
  strategy: 'LRU' | 'TTL' | 'HYBRID';
}

// Default cache configurations for different data types
const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // User data - rarely changes, cache aggressively
  users: { ttl: 15 * 60 * 1000, maxSize: 1000, strategy: 'HYBRID' }, // 15 minutes
  
  // Subscription data - changes monthly, cache heavily
  subscriptions: { ttl: 30 * 60 * 1000, maxSize: 500, strategy: 'TTL' }, // 30 minutes
  
  // Page metadata - changes occasionally, moderate caching
  pageMetadata: { ttl: 5 * 60 * 1000, maxSize: 2000, strategy: 'LRU' }, // 5 minutes
  
  // Page content - changes frequently, light caching
  pageContent: { ttl: 2 * 60 * 1000, maxSize: 500, strategy: 'LRU' }, // 2 minutes
  
  // Analytics data - append-only, cache heavily
  analytics: { ttl: 10 * 60 * 1000, maxSize: 1000, strategy: 'TTL' }, // 10 minutes
  
  // Search results - cache briefly for pagination
  searchResults: { ttl: 30 * 1000, maxSize: 100, strategy: 'LRU' }, // 30 seconds
};

/**
 * Advanced LRU Cache with TTL support
 */
class OptimizedCache<T> {
  private cache = new Map<string, { value: T; timestamp: number; accessCount: number }>();
  private accessOrder: string[] = [];
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check TTL
    if (Date.now() - item.timestamp > this.config.ttl) {
      this.delete(key);
      return null;
    }

    // Update access tracking for LRU
    if (this.config.strategy === 'LRU' || this.config.strategy === 'HYBRID') {
      item.accessCount++;
      this.moveToEnd(key);
    }

    return item.value;
  }

  set(key: string, value: T): void {
    const now = Date.now();
    
    // Remove existing item if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    this.cache.set(key, { value, timestamp: now, accessCount: 1 });
    this.accessOrder.push(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  private moveToEnd(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }

  private evict(): void {
    if (this.accessOrder.length === 0) return;

    let keyToEvict: string;

    if (this.config.strategy === 'LRU') {
      keyToEvict = this.accessOrder[0];
    } else if (this.config.strategy === 'TTL') {
      // Evict oldest by timestamp
      let oldestKey = this.accessOrder[0];
      let oldestTime = this.cache.get(oldestKey)?.timestamp || 0;
      
      for (const key of this.accessOrder) {
        const item = this.cache.get(key);
        if (item && item.timestamp < oldestTime) {
          oldestTime = item.timestamp;
          oldestKey = key;
        }
      }
      keyToEvict = oldestKey;
    } else { // HYBRID
      // Evict based on combination of age and access frequency
      let scoreToEvict = Infinity;
      keyToEvict = this.accessOrder[0];
      
      for (const key of this.accessOrder) {
        const item = this.cache.get(key);
        if (item) {
          const age = Date.now() - item.timestamp;
          const score = age / (item.accessCount + 1); // Lower score = keep longer
          if (score < scoreToEvict) {
            scoreToEvict = score;
            keyToEvict = key;
          }
        }
      }
    }

    this.delete(keyToEvict);
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      strategy: this.config.strategy,
      ttl: this.config.ttl
    };
  }
}

// Global cache instances
const caches = new Map<string, OptimizedCache<any>>();

function getCache<T>(cacheType: string): OptimizedCache<T> {
  if (!caches.has(cacheType)) {
    const config = CACHE_CONFIGS[cacheType] || CACHE_CONFIGS.pageContent;
    caches.set(cacheType, new OptimizedCache<T>(config));
  }
  return caches.get(cacheType)!;
}

/**
 * Batch operation manager for efficient writes
 */
class BatchManager {
  private batches: Map<string, any[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly BATCH_SIZE = 500; // Firestore limit
  private readonly BATCH_DELAY = 100; // ms to wait before committing

  addOperation(batchKey: string, operation: any): void {
    if (!this.batches.has(batchKey)) {
      this.batches.set(batchKey, []);
    }

    const batch = this.batches.get(batchKey)!;
    batch.push(operation);

    // Auto-commit if batch is full
    if (batch.length >= this.BATCH_SIZE) {
      this.commitBatch(batchKey);
      return;
    }

    // Set timer for delayed commit
    if (this.batchTimers.has(batchKey)) {
      clearTimeout(this.batchTimers.get(batchKey)!);
    }

    const timer = setTimeout(() => {
      this.commitBatch(batchKey);
    }, this.BATCH_DELAY);

    this.batchTimers.set(batchKey, timer);
  }

  private async commitBatch(batchKey: string): Promise<void> {
    const operations = this.batches.get(batchKey);
    if (!operations || operations.length === 0) return;

    try {
      const batch = writeBatch(db);
      
      for (const operation of operations) {
        switch (operation.type) {
          case 'set':
            batch.set(operation.ref, operation.data);
            break;
          case 'update':
            batch.update(operation.ref, operation.data);
            break;
          case 'delete':
            batch.delete(operation.ref);
            break;
        }
      }

      await batch.commit();
      console.log(`✅ Committed batch ${batchKey} with ${operations.length} operations`);
      
    } catch (error) {
      console.error(`❌ Failed to commit batch ${batchKey}:`, error);
      throw error;
    } finally {
      this.batches.delete(batchKey);
      if (this.batchTimers.has(batchKey)) {
        clearTimeout(this.batchTimers.get(batchKey)!);
        this.batchTimers.delete(batchKey);
      }
    }
  }

  async flushAll(): Promise<void> {
    const promises = Array.from(this.batches.keys()).map(key => this.commitBatch(key));
    await Promise.all(promises);
  }
}

const batchManager = new BatchManager();

/**
 * Optimized document getter with caching
 */
export async function getDocumentOptimized<T>(
  collectionName: string,
  docId: string,
  cacheType: string = 'pageContent'
): Promise<T | null> {
  const cacheKey = `${collectionName}:${docId}`;
  const cache = getCache<T>(cacheType);
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Fetch from Firestore
  try {
    const docRef = doc(db, getCollectionName(collectionName), docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() } as T;
      cache.set(cacheKey, data);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching document ${collectionName}/${docId}:`, error);
    return null;
  }
}

/**
 * Optimized query with caching and pagination
 */
export async function queryOptimized<T>(
  collectionName: string,
  constraints: any[],
  options: {
    cacheType?: string;
    cacheKey?: string;
    useCache?: boolean;
    pageSize?: number;
  } = {}
): Promise<T[]> {
  const {
    cacheType = 'searchResults',
    cacheKey,
    useCache = true,
    pageSize = 20
  } = options;

  // Generate cache key if not provided
  const finalCacheKey = cacheKey || `query:${collectionName}:${JSON.stringify(constraints)}`;
  
  if (useCache) {
    const cache = getCache<T[]>(cacheType);
    const cached = cache.get(finalCacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  try {
    const q = query(
      collection(db, getCollectionName(collectionName)),
      ...constraints,
      limit(pageSize)
    );
    
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as T[];

    if (useCache) {
      const cache = getCache<T[]>(cacheType);
      cache.set(finalCacheKey, results);
    }

    return results;
  } catch (error) {
    console.error(`Error executing query on ${collectionName}:`, error);
    return [];
  }
}

/**
 * Batch write operations
 */
export function batchWrite(
  collectionName: string,
  docId: string,
  data: any,
  operation: 'set' | 'update' | 'delete' = 'set'
): void {
  const docRef = doc(db, getCollectionName(collectionName), docId);
  
  batchManager.addOperation(`${collectionName}_batch`, {
    type: operation,
    ref: docRef,
    data
  });
}

/**
 * Invalidate cache for specific keys or patterns
 */
export function invalidateCache(pattern: string): void {
  for (const [cacheType, cache] of caches.entries()) {
    if (cacheType.includes(pattern)) {
      cache.clear();
    }
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): Record<string, any> {
  const stats: Record<string, any> = {};
  
  for (const [cacheType, cache] of caches.entries()) {
    stats[cacheType] = cache.getStats();
  }
  
  return stats;
}

/**
 * Flush all pending batch operations
 */
export async function flushBatches(): Promise<void> {
  await batchManager.flushAll();
}

/**
 * Preload frequently accessed data
 */
export async function preloadCriticalData(userId?: string): Promise<void> {
  const preloadPromises: Promise<any>[] = [];

  if (userId) {
    // Preload user data
    preloadPromises.push(
      getDocumentOptimized('users', userId, 'users')
    );
    
    // Preload user subscription
    preloadPromises.push(
      getDocumentOptimized(`users/${userId}/subscriptions`, 'current', 'subscriptions')
    );
  }

  // Preload recent public pages
  preloadPromises.push(
    queryOptimized('pages', [
      where('isPublic', '==', true),
      where('lastModified', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      orderBy('lastModified', 'desc')
    ], {
      cacheType: 'pageMetadata',
      cacheKey: 'recent_public_pages',
      pageSize: 10
    })
  );

  await Promise.all(preloadPromises);
  console.log('✅ Critical data preloaded');
}

/**
 * Query cost monitoring and alerting
 */
class QueryCostMonitor {
  private dailyReadCount = 0;
  private dailyWriteCount = 0;
  private lastResetDate = new Date().toDateString();
  private readonly DAILY_READ_LIMIT = 50000; // Alert threshold
  private readonly DAILY_WRITE_LIMIT = 20000; // Alert threshold

  trackRead(count: number = 1): void {
    this.resetIfNewDay();
    this.dailyReadCount += count;

    if (this.dailyReadCount > this.DAILY_READ_LIMIT) {
      this.sendAlert('READ', this.dailyReadCount);
    }
  }

  trackWrite(count: number = 1): void {
    this.resetIfNewDay();
    this.dailyWriteCount += count;

    if (this.dailyWriteCount > this.DAILY_WRITE_LIMIT) {
      this.sendAlert('write', this.dailyWriteCount);
    }
  }

  private resetIfNewDay(): void {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyReadCount = 0;
      this.dailyWriteCount = 0;
      this.lastResetDate = today;
    }
  }

  private sendAlert(type: 'read' | 'write', count: number): void {
    console.warn(`🚨 FIRESTORE COST ALERT: Daily ${type} operations exceeded threshold: ${count}`);

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send to your monitoring service (e.g., Sentry, DataDog, etc.)
      fetch('/api/alerts/firestore-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, count, timestamp: new Date().toISOString() })
      }).catch(console.error);
    }
  }

  getStats() {
    return {
      dailyReads: this.dailyReadCount,
      dailyWrites: this.dailyWriteCount,
      date: this.lastResetDate,
      readThreshold: this.DAILY_READ_LIMIT,
      writeThreshold: this.DAILY_WRITE_LIMIT
    };
  }
}

const costMonitor = new QueryCostMonitor();

/**
 * Wrapper for Firestore operations with cost tracking
 */
export function trackFirestoreRead(count: number = 1): void {
  costMonitor.trackRead(count);
}

export function trackFirestoreWrite(count: number = 1): void {
  costMonitor.trackWrite(count);
}

export function getFirestoreCostStats() {
  return costMonitor.getStats();
}

// Export the optimization utilities
export {
  OptimizedCache,
  BatchManager,
  CACHE_CONFIGS,
  QueryCostMonitor
};
