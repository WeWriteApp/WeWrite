/**
 * Query Batching System
 * 
 * Batches multiple related database queries into single operations
 * to reduce the total number of database reads and improve performance
 */

import { trackFirebaseRead } from './costMonitor';

interface BatchQuery {
  id: string;
  type: 'page' | 'user' | 'analytics';
  entityId: string;
  resolver: (result: any) => void;
  rejecter: (error: any) => void;
  timestamp: number;
  metadata?: any;
}

interface BatchResult {
  [entityId: string]: any;
}

class QueryBatcher {
  private pendingQueries = new Map<string, BatchQuery[]>();
  private batchTimeouts = new Map<string, NodeJS.Timeout>();
  
  // Configurable batch settings
  private readonly BATCH_DELAY = 50; // 50ms delay to collect queries
  private readonly MAX_BATCH_SIZE = 50; // Maximum queries per batch
  private readonly MAX_WAIT_TIME = 200; // Maximum wait time before forcing batch

  /**
   * Add a query to the batch
   */
  async batchQuery<T>(
    type: 'page' | 'user' | 'analytics',
    entityId: string,
    fetcher: (entityIds: string[]) => Promise<BatchResult>,
    metadata?: any
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queryId = `${type}-${Date.now()}-${Math.random()}`;
      const batchKey = type;
      
      const query: BatchQuery = {
        id: queryId,
        type,
        entityId,
        resolver: resolve,
        rejecter: reject,
        timestamp: Date.now(),
        metadata
      };

      // Add to pending queries
      if (!this.pendingQueries.has(batchKey)) {
        this.pendingQueries.set(batchKey, []);
      }
      
      const queries = this.pendingQueries.get(batchKey)!;
      queries.push(query);

      console.log(`📦 QUERY BATCHER: Added ${type} query for ${entityId} (batch size: ${queries.length})`);

      // Check if we should execute the batch immediately
      if (queries.length >= this.MAX_BATCH_SIZE) {
        this.executeBatch(batchKey, fetcher);
      } else {
        // Set or reset the batch timeout
        this.scheduleBatchExecution(batchKey, fetcher);
      }
    });
  }

  /**
   * Schedule batch execution with timeout
   */
  private scheduleBatchExecution(
    batchKey: string,
    fetcher: (entityIds: string[]) => Promise<BatchResult>
  ): void {
    // Clear existing timeout
    const existingTimeout = this.batchTimeouts.get(batchKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.executeBatch(batchKey, fetcher);
    }, this.BATCH_DELAY);

    this.batchTimeouts.set(batchKey, timeout);
  }

  /**
   * Execute a batch of queries
   */
  private async executeBatch(
    batchKey: string,
    fetcher: (entityIds: string[]) => Promise<BatchResult>
  ): Promise<void> {
    const queries = this.pendingQueries.get(batchKey);
    if (!queries || queries.length === 0) {
      return;
    }

    // Clear the batch
    this.pendingQueries.delete(batchKey);
    const timeout = this.batchTimeouts.get(batchKey);
    if (timeout) {
      clearTimeout(timeout);
      this.batchTimeouts.delete(batchKey);
    }

    console.log(`🚀 QUERY BATCHER: Executing batch for ${batchKey} (${queries.length} queries)`);

    try {
      // Extract unique entity IDs
      const entityIds = [...new Set(queries.map(q => q.entityId))];
      
      // Execute the batch fetch
      const startTime = Date.now();
      const results = await fetcher(entityIds);
      const executionTime = Date.now() - startTime;

      // Track the batch read for cost monitoring
      trackFirebaseRead(batchKey, 'batch', entityIds.length, 'query-batcher');

      console.log(`✅ QUERY BATCHER: Batch completed for ${batchKey} (${executionTime}ms, ${entityIds.length} entities)`);

      // Resolve individual queries
      for (const query of queries) {
        try {
          const result = results[query.entityId];
          if (result !== undefined) {
            query.resolver(result);
          } else {
            query.rejecter(new Error(`Entity ${query.entityId} not found in batch result`));
          }
        } catch (error) {
          query.rejecter(error);
        }
      }

    } catch (error) {
      console.error(`❌ QUERY BATCHER: Batch failed for ${batchKey}:`, error);
      
      // Reject all queries in the batch
      for (const query of queries) {
        query.rejecter(error);
      }
    }
  }

  /**
   * Batch page queries
   */
  async batchPageQuery(pageId: string): Promise<any> {
    return this.batchQuery('page', pageId, async (pageIds: string[]) => {
      // This would integrate with your existing page fetching logic
      console.log(`📄 Fetching batch of ${pageIds.length} pages`);
      
      // Placeholder - replace with actual batch page fetching
      const results: BatchResult = {};
      for (const id of pageIds) {
        // This would be replaced with actual Firestore batch query
        results[id] = { id, title: `Page ${id}`, cached: false };
      }
      return results;
    });
  }

  /**
   * Batch user queries
   */
  async batchUserQuery(userId: string): Promise<any> {
    return this.batchQuery('user', userId, async (userIds: string[]) => {
      console.log(`👥 Fetching batch of ${userIds.length} users`);
      
      // This would integrate with your existing user fetching logic
      const results: BatchResult = {};
      for (const id of userIds) {
        results[id] = { id, username: `User ${id}`, cached: false };
      }
      return results;
    });
  }

  /**
   * Batch analytics queries
   */
  async batchAnalyticsQuery(queryKey: string, metadata?: any): Promise<any> {
    return this.batchQuery('analytics', queryKey, async (queryKeys: string[]) => {
      console.log(`📊 Fetching batch of ${queryKeys.length} analytics queries`);
      
      // This would integrate with your analytics system
      const results: BatchResult = {};
      for (const key of queryKeys) {
        results[key] = { key, data: [], cached: false };
      }
      return results;
    }, metadata);
  }

  /**
   * Force execution of all pending batches
   */
  async flushAllBatches(): Promise<void> {
    console.log('🔄 QUERY BATCHER: Flushing all pending batches');
    
    const batchKeys = Array.from(this.pendingQueries.keys());
    const flushPromises: Promise<void>[] = [];

    for (const batchKey of batchKeys) {
      // Create a dummy fetcher for flushing
      const flushPromise = this.executeBatch(batchKey, async () => ({}));
      flushPromises.push(flushPromise);
    }

    await Promise.all(flushPromises);
    console.log('✅ QUERY BATCHER: All batches flushed');
  }

  /**
   * Get batching statistics
   */
  getBatchingStats(): any {
    const pendingCounts = Object.fromEntries(
      Array.from(this.pendingQueries.entries()).map(([key, queries]) => [key, queries.length])
    );

    return {
      pendingBatches: this.pendingQueries.size,
      pendingQueries: pendingCounts,
      activeBatchTimeouts: this.batchTimeouts.size,
      configuration: {
        batchDelay: this.BATCH_DELAY,
        maxBatchSize: this.MAX_BATCH_SIZE,
        maxWaitTime: this.MAX_WAIT_TIME
      }
    };
  }

  /**
   * Clear all pending queries (useful for cleanup)
   */
  clearAllPending(): void {
    console.log('🧹 QUERY BATCHER: Clearing all pending queries');
    
    // Clear timeouts
    for (const timeout of this.batchTimeouts.values()) {
      clearTimeout(timeout);
    }
    
    // Reject all pending queries
    for (const queries of this.pendingQueries.values()) {
      for (const query of queries) {
        query.rejecter(new Error('Query batch cleared'));
      }
    }
    
    this.pendingQueries.clear();
    this.batchTimeouts.clear();
  }
}

// Export singleton instance
export const queryBatcher = new QueryBatcher();

// Export convenience functions
export const {
  batchPageQuery,
  batchUserQuery,
  batchAnalyticsQuery,
  flushAllBatches,
  getBatchingStats,
  clearAllPending
} = queryBatcher;

// Cleanup on page unload (browser only)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    queryBatcher.flushAllBatches().catch(console.error);
  });
}
