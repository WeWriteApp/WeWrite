import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getCollectionName } from '../../../utils/environmentConfig';
import { createErrorResponse, createSuccessResponse } from '../../../utils/apiHelpers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

/**
 * POST /api/batch/operations
 *
 * Execute batch operations on Firestore with environment-aware collection naming.
 * Supports batch reads, writes, updates, and deletes.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    // Initialize Firebase Admin using standardized function
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    const db = admin.firestore();

    const body = await request.json();
    const { operations, options = {} } = body;

    if (!operations || !Array.isArray(operations)) {
      return createErrorResponse('BAD_REQUEST', 'Operations array is required');
    }

    if (operations.length === 0) {
      return createErrorResponse('BAD_REQUEST', 'At least one operation is required');
    }

    if (operations.length > 500) {
      return createErrorResponse('BAD_REQUEST', 'Maximum 500 operations per batch');
    }

    console.log('🔄 [BATCH OPERATIONS] Processing batch', {
      operationCount: operations.length,
      userId: currentUserId
    });

    const results = [];
    const batch = db.batch();
    let batchWriteCount = 0;

    for (const operation of operations) {
      const { type, collection, documentId, data, query } = operation;

      if (!type || !collection) {
        results.push({
          success: false,
          error: 'Operation type and collection are required',
          operation
        });
        continue;
      }

      // Use environment-aware collection naming
      const envCollectionName = getCollectionName(collection);

      try {
        switch (type) {
          case 'read':
            if (documentId) {
              // Single document read
              const docRef = db.collection(envCollectionName).doc(documentId);
              const docSnap = await docRef.get();
              
              results.push({
                success: true,
                type: 'read',
                collection: envCollectionName,
                documentId,
                data: docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null,
                exists: docSnap.exists
              });
            } else if (query) {
              // Query read
              let queryRef = db.collection(envCollectionName);
              
              // Apply query constraints
              if (query.where) {
                for (const whereClause of query.where) {
                  queryRef = queryRef.where(whereClause.field, whereClause.operator, whereClause.value);
                }
              }
              
              if (query.orderBy) {
                queryRef = queryRef.orderBy(query.orderBy.field, query.orderBy.direction || 'asc');
              }
              
              if (query.limit) {
                queryRef = queryRef.limit(query.limit);
              }

              const querySnap = await queryRef.get();
              const docs = querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              
              results.push({
                success: true,
                type: 'query',
                collection: envCollectionName,
                data: docs,
                count: docs.length
              });
            }
            break;

          case 'create':
            if (!data) {
              results.push({
                success: false,
                error: 'Data is required for create operation',
                operation
              });
              continue;
            }

            if (documentId) {
              // Create with specific ID
              const docRef = db.collection(envCollectionName).doc(documentId);
              batch.create(docRef, {
                ...data,
                createdAt: new Date().toISOString(),
                createdBy: currentUserId
              });
              batchWriteCount++;
              
              results.push({
                success: true,
                type: 'create',
                collection: envCollectionName,
                documentId,
                scheduled: true
              });
            } else {
              // Create with auto-generated ID
              const docRef = db.collection(envCollectionName).doc();
              batch.create(docRef, {
                ...data,
                createdAt: new Date().toISOString(),
                createdBy: currentUserId
              });
              batchWriteCount++;
              
              results.push({
                success: true,
                type: 'create',
                collection: envCollectionName,
                documentId: docRef.id,
                scheduled: true
              });
            }
            break;

          case 'update':
            if (!documentId || !data) {
              results.push({
                success: false,
                error: 'Document ID and data are required for update operation',
                operation
              });
              continue;
            }

            const updateRef = db.collection(envCollectionName).doc(documentId);
            batch.update(updateRef, {
              ...data,
              lastModified: new Date().toISOString(),
              lastModifiedBy: currentUserId
            });
            batchWriteCount++;
            
            results.push({
              success: true,
              type: 'update',
              collection: envCollectionName,
              documentId,
              scheduled: true
            });
            break;

          case 'delete':
            if (!documentId) {
              results.push({
                success: false,
                error: 'Document ID is required for delete operation',
                operation
              });
              continue;
            }

            const deleteRef = db.collection(envCollectionName).doc(documentId);
            
            if (options.softDelete) {
              // Soft delete
              batch.update(deleteRef, {
                deleted: true,
                deletedAt: new Date().toISOString(),
                deletedBy: currentUserId
              });
            } else {
              // Hard delete
              batch.delete(deleteRef);
            }
            batchWriteCount++;
            
            results.push({
              success: true,
              type: 'delete',
              collection: envCollectionName,
              documentId,
              softDelete: !!options.softDelete,
              scheduled: true
            });
            break;

          default:
            results.push({
              success: false,
              error: `Unknown operation type: ${type}`,
              operation
            });
        }
      } catch (error) {
        console.error(`❌ [BATCH OPERATIONS] Error processing operation:`, error);
        results.push({
          success: false,
          error: error.message,
          operation
        });
      }
    }

    // Commit batch writes if any
    if (batchWriteCount > 0) {
      await batch.commit();
      console.log(`✅ [BATCH OPERATIONS] Committed ${batchWriteCount} write operations`);
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log('✅ [BATCH OPERATIONS] Batch completed', {
      totalOperations: operations.length,
      successful: successCount,
      errors: errorCount,
      writeOperations: batchWriteCount
    });

    return createSuccessResponse({
      results,
      summary: {
        totalOperations: operations.length,
        successful: successCount,
        errors: errorCount,
        writeOperations: batchWriteCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [BATCH OPERATIONS] Error processing batch:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to process batch operations');
  }
}
