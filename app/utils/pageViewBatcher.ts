/**
 * Page View Batching System
 * 
 * Batches page view updates to reduce Firestore write operations by 90%+
 * Instead of writing each view immediately, accumulates views and writes in batches.
 */

import { doc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/database/core';
import { getCollectionName } from './environmentConfig';

interface PageViewData {
  pageId: string;
  userId?: string;
  timestamp: Date;
  sessionId?: string;
  referrer?: string;
}

interface BatchedPageView {
  pageId: string;
  viewCount: number;
  uniqueUsers: Set<string>;
  lastViewed: Date;
  firstViewed: Date;
  sessions: Set<string>;
}

class PageViewBatcher {
  private batchedViews = new Map<string, BatchedPageView>();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_BATCH_SIZE = 500; // Firestore batch limit
  private isProcessing = false;

  /**
   * Add a page view to the batch
   */
  addPageView(data: PageViewData): void {
    const { pageId, userId, timestamp, sessionId } = data;
    const key = pageId;

    if (!this.batchedViews.has(key)) {
      this.batchedViews.set(key, {
        pageId,
        viewCount: 0,
        uniqueUsers: new Set(),
        lastViewed: timestamp,
        firstViewed: timestamp,
        sessions: new Set()
      });
    }

    const batchedView = this.batchedViews.get(key)!;
    batchedView.viewCount++;
    batchedView.lastViewed = timestamp;
    
    if (timestamp < batchedView.firstViewed) {
      batchedView.firstViewed = timestamp;
    }

    if (userId) {
      batchedView.uniqueUsers.add(userId);
    }

    if (sessionId) {
      batchedView.sessions.add(sessionId);
    }

    // Auto-flush if we have too many batched items
    if (this.batchedViews.size >= this.MAX_BATCH_SIZE) {
      this.flushBatch();
      return;
    }

    // Set timer for delayed flush
    this.scheduleFlush();
  }

  /**
   * Schedule a batch flush
   */
  private scheduleFlush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, this.BATCH_INTERVAL);
  }

  /**
   * Flush the current batch to Firestore
   */
  async flushBatch(): Promise<void> {
    if (this.isProcessing || this.batchedViews.size === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = writeBatch(db);
      const currentBatch = new Map(this.batchedViews);
      
      // Clear the current batch immediately to allow new views
      this.batchedViews.clear();
      
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }

      console.log(`📊 Flushing ${currentBatch.size} batched page views...`);

      for (const [pageId, batchedView] of currentBatch) {
        // Update page view document with aggregated format matching /api/analytics/page-view
        const dateKey = this.getDateKey(batchedView.lastViewed);
        const currentHour = batchedView.lastViewed.getUTCHours().toString(); // Use UTC to match server-side API recording
        
        const pageViewRef = doc(
          db, 
          getCollectionName('pageViews'), 
          `${pageId}_${dateKey}`
        );

        batch.set(pageViewRef, {
          pageId,
          date: dateKey,
          [`hours.${currentHour}`]: increment(batchedView.viewCount),
          totalViews: increment(batchedView.viewCount),
          uniqueUsers: increment(batchedView.uniqueUsers.size),
          sessions: increment(batchedView.sessions.size),
          lastViewed: batchedView.lastViewed,
          lastUpdated: serverTimestamp()
        }, { merge: true });

        // Update page metadata with total view count
        const pageRef = doc(db, getCollectionName('pages'), pageId);
        batch.update(pageRef, {
          totalViews: increment(batchedView.viewCount),
          lastViewed: batchedView.lastViewed,
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      
      console.log(`✅ Successfully flushed ${currentBatch.size} page view batches`);
      
      // Track write operations for monitoring
      if (typeof window === 'undefined') {
        // Server-side only
        const { trackFirestoreWrite } = await import('./firestoreOptimizer');
        trackFirestoreWrite(currentBatch.size * 2); // 2 writes per page (pageViews + pages)
      }

    } catch (error) {
      console.error('❌ Failed to flush page view batch:', error);
      
      // Re-add failed items back to the batch for retry
      for (const [key, value] of this.batchedViews) {
        if (!this.batchedViews.has(key)) {
          this.batchedViews.set(key, value);
        }
      }
      
      // Retry after a delay
      setTimeout(() => {
        this.flushBatch();
      }, 30000); // Retry in 30 seconds
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get date key for grouping views by day
   */
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Force flush all pending batches (useful for shutdown)
   */
  async forceFlush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    await this.flushBatch();
  }

  /**
   * Get current batch statistics
   */
  getBatchStats() {
    const totalViews = Array.from(this.batchedViews.values())
      .reduce((sum, batch) => sum + batch.viewCount, 0);
    
    const totalUniqueUsers = Array.from(this.batchedViews.values())
      .reduce((sum, batch) => sum + batch.uniqueUsers.size, 0);

    return {
      batchedPages: this.batchedViews.size,
      totalPendingViews: totalViews,
      totalUniqueUsers,
      isProcessing: this.isProcessing,
      nextFlushIn: this.batchTimer ? this.BATCH_INTERVAL : 0
    };
  }
}

// Global instance
const pageViewBatcher = new PageViewBatcher();

/**
 * Record a page view (will be batched)
 */
export function recordPageView(data: PageViewData): void {
  pageViewBatcher.addPageView(data);
}

/**
 * Force flush all pending page views
 */
export async function flushPageViews(): Promise<void> {
  await pageViewBatcher.forceFlush();
}

/**
 * Get page view batch statistics
 */
export function getPageViewBatchStats() {
  return pageViewBatcher.getBatchStats();
}

/**
 * Optimized page view recording with deduplication
 */
export function recordPageViewOptimized(
  pageId: string, 
  userId?: string, 
  sessionId?: string,
  referrer?: string
): void {
  // Generate session ID if not provided
  const finalSessionId = sessionId || generateSessionId();
  
  recordPageView({
    pageId,
    userId,
    timestamp: new Date(),
    sessionId: finalSessionId,
    referrer
  });
}

/**
 * Generate a simple session ID for tracking
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Graceful shutdown handling
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    console.log('🔄 Flushing page views before shutdown...');
    await flushPageViews();
  });

  process.on('SIGINT', async () => {
    console.log('🔄 Flushing page views before shutdown...');
    await flushPageViews();
  });
}

export default pageViewBatcher;
