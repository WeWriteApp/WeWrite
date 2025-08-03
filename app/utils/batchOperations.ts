/**
 * Utility functions for batch operations in Firestore
 * These functions help optimize write operations by batching them together
 */

// REMOVED: Direct Firebase imports - now using API endpoints for cost optimization
import { batchApi } from './apiClient';
import { trackQueryPerformance } from './queryMonitor';

// Types
interface BatchOperation {
  collection: string;
  docId: string;
  data?: Record<string, any>;
  operation: 'set' | 'update' | 'delete';
  merge?: boolean;
}

interface BatchResult {
  success: boolean;
  error?: any;
}

interface UserUpdate {
  userId: string;
  data: Record<string, any>;
}

interface PageUpdate {
  pageId: string;
  data: Record<string, any>;
}

interface DeleteOperation {
  collection: string;
  docId: string;
}

/**
 * Perform batch updates on multiple documents
 */
export const performBatchOperations = async (operations: BatchOperation[]): Promise<BatchResult> => {
  return await trackQueryPerformance('performBatchOperations', async () => {
    try {
      // Firestore has a limit of 500 operations per batch
      const BATCH_LIMIT = 500;
      
      // Split operations into chunks of BATCH_LIMIT
      for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = operations.slice(i, i + BATCH_LIMIT);
        
        // Add each operation to the batch
        chunk.forEach(op => {
          const docRef = doc(db, op.collection, op.docId);
          
          switch (op.operation) {
            case 'set':
              batch.set(docRef, op.data, { merge: op.merge !== false });
              break;
            case 'update':
              batch.update(docRef, op.data);
              break;
            case 'delete':
              batch.delete(docRef);
              break;
            default:
              console.error(`Unknown operation type: ${op.operation}`);
          }
        });
        
        // Commit the batch
        await batch.commit();
        console.log(`Batch committed: ${chunk.length} operations`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error performing batch operations:', error);
      return { success: false, error };
    }
  }, { operationCount: operations.length });
};

/**
 * Update multiple user documents in a batch
 */
export const batchUpdateUsers = async (userUpdates: UserUpdate[]): Promise<BatchResult> => {
  const operations: BatchOperation[] = userUpdates.map(update => ({
    collection: 'users',
    docId: update.userId,
    data: update.data,
    operation: 'update' as const
  }));

  return await performBatchOperations(operations);
};

/**
 * Update multiple page documents in a batch
 */
export const batchUpdatePages = async (pageUpdates: PageUpdate[]): Promise<BatchResult> => {
  const operations: BatchOperation[] = pageUpdates.map(update => ({
    collection: 'pages',
    docId: update.pageId,
    data: update.data,
    operation: 'update' as const
  }));

  return await performBatchOperations(operations);
};

/**
 * Delete multiple documents in a batch
 */
export const batchDeleteDocuments = async (deleteOperations: DeleteOperation[]): Promise<BatchResult> => {
  const operations: BatchOperation[] = deleteOperations.map(op => ({
    collection: op.collection,
    docId: op.docId,
    operation: 'delete' as const
  }));

  return await performBatchOperations(operations);
};