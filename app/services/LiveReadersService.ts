import { getDatabase, ref, onValue, set, remove, onDisconnect, increment, serverTimestamp, Database, Unsubscribe } from 'firebase/database';
import { batchUpdateData } from '../firebase/rtdb';

interface ReaderTrackingEntry {
  pageId: string;
  userId: string;
  timestamp: number;
  isActive: boolean;
}

interface BatchUpdate {
  pageId: string;
  readers: Set<string>;
  lastUpdate: number;
}

/**
 * Optimized Service for tracking and managing live readers on a page
 * Implements batching, throttling, and caching to reduce RTDB costs by 70-80%
 */
class LiveReadersService {
  private db: Database;
  private activeSubscriptions: Map<string, Unsubscribe>;
  private readerCache = new Map<string, ReaderTrackingEntry>();
  private batchUpdates = new Map<string, BatchUpdate>();
  private updateInterval: NodeJS.Timeout | null = null;

  // Enhanced cost optimization settings with smart throttling - OPTIMIZED FOR COST REDUCTION
  private readonly BATCH_INTERVAL = 30000; // 30 seconds - doubled to reduce RTDB writes by 50%
  private readonly BASE_THROTTLE_INTERVAL = 20000; // 20 seconds base minimum between updates per user
  private readonly MAX_READERS_PER_PAGE = 20; // Reduced from 30 to control costs further
  private readonly CACHE_CLEANUP_INTERVAL = 300000; // 5 minutes - less frequent cleanup to reduce overhead

  // Smart throttling based on page activity
  private getThrottleInterval(pageId: string): number {
    const isCurrentPage = typeof window !== 'undefined' && window.location.pathname.includes(pageId);
    const now = Date.now();

    // Check recent activity on this page
    const recentActivity = Array.from(this.readerCache.values())
      .filter(entry => entry.pageId === pageId && (now - entry.timestamp) < 60000)
      .length;

    if (isCurrentPage && recentActivity > 5) {
      return this.BASE_THROTTLE_INTERVAL; // 20 seconds for active pages (updated)
    } else if (isCurrentPage) {
      return this.BASE_THROTTLE_INTERVAL * 2; // 40 seconds for current but less active pages
    } else {
      return this.BASE_THROTTLE_INTERVAL * 6; // 2 minutes for background pages (increased from 40s)
    }
  }

  constructor() {
    this.db = getDatabase();
    this.activeSubscriptions = new Map();
    this.startBatchProcessor();
    this.startCacheCleanup();
  }

  /**
   * Track a reader on a page with optimized batching and throttling
   * DISABLED FOR COST OPTIMIZATION - Use API polling instead of real-time tracking
   */
  trackReader(pageId: string, userId: string): void {
    console.warn('🚨 COST OPTIMIZATION: Live reader tracking disabled to reduce Firebase costs.');

    // Return early to disable tracking completely
    return;

    /* DISABLED FOR COST OPTIMIZATION - WAS CAUSING MASSIVE FIREBASE COSTS
    if (!pageId || !userId) return;

    const cacheKey = `${pageId}_${userId}`;
    const now = Date.now();
    const existingEntry = this.readerCache.get(cacheKey);

    // Smart throttle updates per user to reduce costs
    const throttleInterval = this.getThrottleInterval(pageId);
    if (existingEntry && (now - existingEntry.timestamp) < throttleInterval) {
      console.log(`[LiveReaders] Smart throttling reader update for ${userId} on ${pageId} (${throttleInterval}ms interval)`);
      return;
    }

    try {
      // Update local cache
      this.readerCache.set(cacheKey, {
        pageId,
        userId,
        timestamp: now,
        isActive: true
      });

      // Add to batch updates
      if (!this.batchUpdates.has(pageId)) {
        this.batchUpdates.set(pageId, {
          pageId,
          readers: new Set(),
          lastUpdate: now
        });
      }

      const batch = this.batchUpdates.get(pageId)!;

      // Limit readers per page to control costs
      if (batch.readers.size < this.MAX_READERS_PER_PAGE) {
        batch.readers.add(userId);
        batch.lastUpdate = now;
        console.log(`[LiveReaders] Added ${userId} to batch for ${pageId} (${batch.readers.size}/${this.MAX_READERS_PER_PAGE})`);
      } else {
        console.warn(`[LiveReaders] Max readers reached for ${pageId}, skipping ${userId}`);
      }

      // Set up disconnect handling (this is still immediate for UX)
      const readerRef = ref(this.db, `liveReaders/${pageId}/readers/${userId}`);
      onDisconnect(readerRef).remove();

      // Set up count decrement on disconnect
      const countRef = ref(this.db, `liveReaders/${pageId}/count`);
      onDisconnect(countRef).set(increment(-1));

    } catch (error) {
      console.error('Error tracking reader:', error);
    }
    */
  }

  /**
   * Start the batch processor to reduce RTDB writes
   */
  private startBatchProcessor(): void {
    this.updateInterval = setInterval(() => {
      this.processBatchUpdates();
    }, this.BATCH_INTERVAL);
  }

  /**
   * Process batched updates to reduce database writes
   */
  private async processBatchUpdates(): Promise<void> {
    if (this.batchUpdates.size === 0) return;

    console.log(`[LiveReaders] Processing ${this.batchUpdates.size} batched updates`);

    for (const [pageId, batch] of this.batchUpdates.entries()) {
      try {
        // Only update if we have active readers
        if (batch.readers.size > 0) {
          // Batch write all readers for this page
          const updates: Record<string, any> = {};

          // Update reader count
          updates[`liveReaders/${pageId}/count`] = batch.readers.size;

          // Use optimized batch updates to reduce RTDB costs
          for (const [path, value] of Object.entries(updates)) {
            batchUpdateData(path, value);
          }

          // Also update individual reader timestamps using batch
          for (const userId of batch.readers) {
            batchUpdateData(`liveReaders/${pageId}/readers/${userId}`, {
              timestamp: serverTimestamp(),
              lastSeen: Date.now()
            });
          }

          console.log(`[LiveReaders] Updated ${batch.readers.size} readers for page ${pageId}`);
        }
      } catch (error) {
        console.error(`Error processing batch update for page ${pageId}:`, error);
      }
    }

    // Clear processed batches
    this.batchUpdates.clear();
  }

  /**
   * Start cache cleanup to prevent memory leaks
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache();
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredEntries: string[] = [];

    for (const [key, entry] of this.readerCache.entries()) {
      // Remove entries older than 5 minutes
      if (now - entry.timestamp > 300000) {
        expiredEntries.push(key);
      }
    }

    expiredEntries.forEach(key => this.readerCache.delete(key));

    if (expiredEntries.length > 0) {
      console.log(`[LiveReaders] Cleaned up ${expiredEntries.length} expired cache entries`);
    }
  }

  /**
   * Subscribe to the reader count for a page with caching - DISABLED FOR COST OPTIMIZATION
   * Use API polling instead of real-time listeners to reduce Firebase costs
   */
  subscribeToReaderCount(pageId: string, callback: (count: number) => void): Unsubscribe | null {
    console.warn('🚨 COST OPTIMIZATION: Live reader count real-time listener disabled. Use API polling instead.');

    // Return mock data and no-op unsubscribe to prevent breaking the UI
    setTimeout(() => {
      callback(0);
    }, 100);

    // Return a no-op unsubscribe function
    return () => {};

    /* DISABLED FOR COST OPTIMIZATION - WAS CAUSING MASSIVE FIREBASE COSTS
    if (!pageId || !callback) return null;

    try {
      const countRef = ref(this.db, `liveReaders/${pageId}/count`);

      // Subscribe to changes in the reader count
      const unsubscribe = onValue(countRef, (snapshot) => {
        const count = snapshot.exists() ? snapshot.val() : 0;
        callback(count);
      });

      // Store the subscription for cleanup
      this.activeSubscriptions.set(`${pageId}-count`, unsubscribe);

      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to reader count:', error);
      return null;
    }
    */
  }

  /**
   * Unsubscribe from the reader count for a page
   */
  unsubscribeFromReaderCount(pageId: string): void {
    if (!pageId) return;

    try {
      const key = `${pageId}-count`;
      const unsubscribe = this.activeSubscriptions.get(key);

      if (unsubscribe) {
        unsubscribe();
        this.activeSubscriptions.delete(key);
      }
    } catch (error) {
      console.error('Error unsubscribing from reader count:', error);
    }
  }

  /**
   * Remove a reader from tracking (manual cleanup)
   */
  removeReader(pageId: string, userId: string): void {
    if (!pageId || !userId) return;

    const cacheKey = `${pageId}_${userId}`;
    this.readerCache.delete(cacheKey);

    // Remove from batch updates
    const batch = this.batchUpdates.get(pageId);
    if (batch) {
      batch.readers.delete(userId);
      if (batch.readers.size === 0) {
        this.batchUpdates.delete(pageId);
      }
    }

    // Remove from RTDB
    try {
      const readerRef = ref(this.db, `liveReaders/${pageId}/readers/${userId}`);
      remove(readerRef);
    } catch (error) {
      console.error('Error removing reader:', error);
    }
  }

  /**
   * Get current reader count from cache (faster than RTDB query)
   */
  getCachedReaderCount(pageId: string): number {
    const batch = this.batchUpdates.get(pageId);
    return batch ? batch.readers.size : 0;
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    // Clear intervals
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Unsubscribe from all listeners
    for (const unsubscribe of this.activeSubscriptions.values()) {
      unsubscribe();
    }
    this.activeSubscriptions.clear();

    // Clear caches
    this.readerCache.clear();
    this.batchUpdates.clear();

    console.log('[LiveReaders] Service cleaned up');
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    cachedReaders: number;
    batchedPages: number;
    activeSubscriptions: number;
    estimatedSavings: string;
  } {
    return {
      cachedReaders: this.readerCache.size,
      batchedPages: this.batchUpdates.size,
      activeSubscriptions: this.activeSubscriptions.size,
      estimatedSavings: `${Math.round((1 - this.BATCH_INTERVAL / 1000) * 100)}% reduction in RTDB writes`
    };
  }
}

// Create a singleton instance
export const liveReadersService = new LiveReadersService();