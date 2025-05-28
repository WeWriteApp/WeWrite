/**
 * Utility functions for batch operations in Firestore
 * These functions help optimize write operations by batching them together
 */

import { writeBatch, doc } from 'firebase/firestore';
import { db } from "../../firebase/database";
import { trackQueryPerformance } from './queryMonitor';

/**
 * Perform batch updates on multiple documents
 * 
 * @param {Array} operations - Array of operations to perform
 * @param {string} operations[].collection - Collection name
 * @param {string} operations[].docId - Document ID
 * @param {Object} operations[].data - Data to update
 * @param {string} operations[].operation - Operation type: 'set', 'update', or 'delete'
 * @returns {Promise<void>}
 */
export const performBatchOperations = async (operations) => {
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
 * 
 * @param {Array} userUpdates - Array of user updates
 * @param {string} userUpdates[].userId - User ID
 * @param {Object} userUpdates[].data - Data to update
 * @returns {Promise<Object>}
 */
export const batchUpdateUsers = async (userUpdates) => {
  const operations = userUpdates.map(update => ({
    collection: 'users',
    docId: update.userId,
    data: update.data,
    operation: 'update'
  }));
  
  return await performBatchOperations(operations);
};

/**
 * Update multiple page documents in a batch
 * 
 * @param {Array} pageUpdates - Array of page updates
 * @param {string} pageUpdates[].pageId - Page ID
 * @param {Object} pageUpdates[].data - Data to update
 * @returns {Promise<Object>}
 */
export const batchUpdatePages = async (pageUpdates) => {
  const operations = pageUpdates.map(update => ({
    collection: 'pages',
    docId: update.pageId,
    data: update.data,
    operation: 'update'
  }));
  
  return await performBatchOperations(operations);
};

/**
 * Delete multiple documents in a batch
 * 
 * @param {Array} deleteOperations - Array of delete operations
 * @param {string} deleteOperations[].collection - Collection name
 * @param {string} deleteOperations[].docId - Document ID
 * @returns {Promise<Object>}
 */
export const batchDeleteDocuments = async (deleteOperations) => {
  const operations = deleteOperations.map(op => ({
    collection: op.collection,
    docId: op.docId,
    operation: 'delete'
  }));
  
  return await performBatchOperations(operations);
};
