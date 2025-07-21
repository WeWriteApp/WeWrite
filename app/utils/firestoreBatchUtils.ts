/**
 * Firestore Batch Operations Utility
 * 
 * Provides intelligent batching for Firestore operations to reduce costs
 * by combining multiple operations into single batch writes.
 */

import { 
  writeBatch, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc,
  type DocumentReference,
  type UpdateData,
  type SetOptions
} from 'firebase/firestore';
import { db } from '../firebase/config';

interface BatchOperation {
  type: 'set' | 'update' | 'delete';
  ref: DocumentReference;
  data?: any;
  options?: SetOptions;
}

interface BatchStats {
  totalOperations: number;
  batchesSent: number;
  operationsSaved: number;
  costReduction: number;
}

class FirestoreBatchManager {
  private static instance: FirestoreBatchManager;
  private pendingOperations: BatchOperation[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private stats: BatchStats = {
    totalOperations: 0,
    batchesSent: 0,
    operationsSaved: 0,
    costReduction: 0
  };

  // Configuration for cost optimization
  private readonly MAX_BATCH_SIZE = 500; // Firestore limit
  private readonly BATCH_DELAY = 1000; // 1 second delay to collect operations
  private readonly AUTO_FLUSH_THRESHOLD = 100; // Auto-flush when we have 100 operations

  static getInstance(): FirestoreBatchManager {
    if (!FirestoreBatchManager.instance) {
      FirestoreBatchManager.instance = new FirestoreBatchManager();
    }
    return FirestoreBatchManager.instance;
  }

  /**
   * Add a set operation to the batch
   */
  batchSet(ref: DocumentReference, data: any, options?: SetOptions): void {
    this.addOperation({
      type: 'set',
      ref,
      data,
      options
    });
  }

  /**
   * Add an update operation to the batch
   */
  batchUpdate(ref: DocumentReference, data: UpdateData): void {
    this.addOperation({
      type: 'update',
      ref,
      data
    });
  }

  /**
   * Add a delete operation to the batch
   */
  batchDelete(ref: DocumentReference): void {
    this.addOperation({
      type: 'delete',
      ref
    });
  }

  /**
   * Add operation to pending batch
   */
  private addOperation(operation: BatchOperation): void {
    this.pendingOperations.push(operation);
    this.stats.totalOperations++;

    // Auto-flush if we hit the threshold
    if (this.pendingOperations.length >= this.AUTO_FLUSH_THRESHOLD) {
      this.flushBatch();
      return;
    }

    // Set up delayed flush
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
    }, this.BATCH_DELAY);
  }

  /**
   * Flush all pending operations
   */
  async flushBatch(): Promise<void> {
    if (this.pendingOperations.length === 0) return;

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    try {
      // Split into chunks if needed
      const chunks = this.chunkOperations(this.pendingOperations);
      
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        
        for (const operation of chunk) {
          switch (operation.type) {
            case 'set':
              batch.set(operation.ref, operation.data, operation.options || {});
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
        this.stats.batchesSent++;
      }

      // Calculate cost savings
      const operationsInBatch = this.pendingOperations.length;
      const batchesSent = chunks.length;
      const operationsSaved = operationsInBatch - batchesSent;
      
      this.stats.operationsSaved += operationsSaved;
      this.stats.costReduction = (this.stats.operationsSaved / this.stats.totalOperations) * 100;

      console.log(`[FirestoreBatch] Flushed ${operationsInBatch} operations in ${batchesSent} batches. Saved ${operationsSaved} operations (${this.stats.costReduction.toFixed(1)}% cost reduction)`);

      // Clear pending operations
      this.pendingOperations = [];

    } catch (error) {
      console.error('[FirestoreBatch] Error flushing batch:', error);
      // Don't clear operations on error - they'll be retried
    }
  }

  /**
   * Split operations into chunks that fit Firestore batch limits
   */
  private chunkOperations(operations: BatchOperation[]): BatchOperation[][] {
    const chunks: BatchOperation[][] = [];
    
    for (let i = 0; i < operations.length; i += this.MAX_BATCH_SIZE) {
      chunks.push(operations.slice(i, i + this.MAX_BATCH_SIZE));
    }
    
    return chunks;
  }

  /**
   * Force flush all pending operations immediately
   */
  async forceFlush(): Promise<void> {
    await this.flushBatch();
  }

  /**
   * Get batch operation statistics
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalOperations: 0,
      batchesSent: 0,
      operationsSaved: 0,
      costReduction: 0
    };
  }
}

// Export singleton instance
const batchManager = FirestoreBatchManager.getInstance();

// Convenience functions for batch operations
export const batchSet = (ref: DocumentReference, data: any, options?: SetOptions) => {
  batchManager.batchSet(ref, data, options);
};

export const batchUpdate = (ref: DocumentReference, data: UpdateData) => {
  batchManager.batchUpdate(ref, data);
};

export const batchDelete = (ref: DocumentReference) => {
  batchManager.batchDelete(ref);
};

export const flushFirestoreBatch = () => {
  return batchManager.forceFlush();
};

export const getFirestoreBatchStats = () => {
  return batchManager.getStats();
};

export const resetFirestoreBatchStats = () => {
  batchManager.resetStats();
};

// Auto-flush on page unload to ensure operations are saved
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    batchManager.forceFlush();
  });
}
