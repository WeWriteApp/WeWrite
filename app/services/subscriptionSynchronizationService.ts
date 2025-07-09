/**
 * Subscription Synchronization Service
 * Prevents race conditions between Stripe webhooks and direct API calls
 * Ensures subscription state consistency between Stripe and Firestore
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { FinancialUtils, CorrelationId } from '../types/financial';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'});

export interface SubscriptionSyncRecord {
  userId: string;
  stripeSubscriptionId: string;
  lastSyncAt: Date;
  lastWebhookAt?: Date;
  lastApiCallAt?: Date;
  syncVersion: number;
  status: 'synced' | 'syncing' | 'conflict' | 'error';
  conflictDetails?: {
    stripeStatus: string;
    firestoreStatus: string;
    detectedAt: Date;
    resolvedAt?: Date;
  };
  lockExpiry?: Date;
  correlationId: CorrelationId;
}

export interface SyncOperation {
  type: 'webhook' | 'api_call';
  source: string;
  timestamp: Date;
  correlationId: CorrelationId;
  subscriptionData: any;
}

export class SubscriptionSynchronizationService {
  private static instance: SubscriptionSynchronizationService;
  private readonly LOCK_TIMEOUT_MS = 30000; // 30 seconds
  private readonly SYNC_CONFLICT_THRESHOLD_MS = 5000; // 5 seconds

  private constructor() {}

  public static getInstance(): SubscriptionSynchronizationService {
    if (!SubscriptionSynchronizationService.instance) {
      SubscriptionSynchronizationService.instance = new SubscriptionSynchronizationService();
    }
    return SubscriptionSynchronizationService.instance;
  }

  /**
   * Synchronize subscription data with conflict detection and resolution
   */
  public async synchronizeSubscription(
    userId: string,
    stripeSubscriptionId: string,
    operation: SyncOperation
  ): Promise<{
    success: boolean;
    conflict?: boolean;
    message: string;
    syncRecord?: SubscriptionSyncRecord;
  }> {
    const correlationId = operation.correlationId;
    
    try {
      // Use Firestore transaction to prevent race conditions
      const result = await runTransaction(db, async (transaction) => {
        const syncRecordRef = doc(db, 'subscriptionSync', `${userId}_${stripeSubscriptionId}`);
        const syncDoc = await transaction.get(syncRecordRef);
        
        let syncRecord: SubscriptionSyncRecord;
        
        if (syncDoc.exists()) {
          syncRecord = syncDoc.data() as SubscriptionSyncRecord;
          
          // Check if another operation is in progress
          if (syncRecord.status === 'syncing' && syncRecord.lockExpiry && new Date() < syncRecord.lockExpiry) {
            throw new Error(`Sync operation already in progress, lock expires at ${syncRecord.lockExpiry.toISOString()}`);
          }
          
          // Check for potential conflicts
          const conflict = this.detectConflict(syncRecord, operation);
          if (conflict) {
            return await this.handleSyncConflict(transaction, syncRecordRef, syncRecord, operation);
          }
        } else {
          // Create new sync record
          syncRecord = {
            userId,
            stripeSubscriptionId,
            lastSyncAt: new Date(),
            syncVersion: 1,
            status: 'syncing',
            lockExpiry: new Date(Date.now() + this.LOCK_TIMEOUT_MS),
            correlationId
          };
        }

        // Update sync record with lock
        const updatedSyncRecord = {
          ...syncRecord,
          status: 'syncing' as const,
          lockExpiry: new Date(Date.now() + this.LOCK_TIMEOUT_MS),
          syncVersion: syncRecord.syncVersion + 1,
          correlationId
        };

        if (operation.type === 'webhook') {
          updatedSyncRecord.lastWebhookAt = operation.timestamp;
        } else {
          updatedSyncRecord.lastApiCallAt = operation.timestamp;
        }

        transaction.set(syncRecordRef, {
          ...updatedSyncRecord,
          lastSyncAt: serverTimestamp(),
          lockExpiry: updatedSyncRecord.lockExpiry
        });

        return { syncRecord: updatedSyncRecord, conflict: false };
      });

      // Perform the actual subscription update outside the transaction
      const updateResult = await this.performSubscriptionUpdate(userId, operation);
      
      // Release lock and mark as synced
      await this.releaseSyncLock(userId, stripeSubscriptionId, updateResult.success);

      return {
        success: updateResult.success,
        conflict: result.conflict,
        message: updateResult.message,
        syncRecord: result.syncRecord
      };

    } catch (error: any) {
      console.error(`[SUBSCRIPTION SYNC] Error synchronizing subscription for user ${userId}:`, error);
      
      // Release lock on error
      await this.releaseSyncLock(userId, stripeSubscriptionId, false);
      
      return {
        success: false,
        message: `Synchronization failed: ${error.message}`
      };
    }
  }

  /**
   * Detect potential conflicts between operations
   */
  private detectConflict(syncRecord: SubscriptionSyncRecord, operation: SyncOperation): boolean {
    const now = operation.timestamp;
    
    // Check if there was a recent operation of different type
    if (operation.type === 'webhook' && syncRecord.lastApiCallAt) {
      const timeDiff = now.getTime() - syncRecord.lastApiCallAt.getTime();
      if (timeDiff < this.SYNC_CONFLICT_THRESHOLD_MS) {
        return true;
      }
    }
    
    if (operation.type === 'api_call' && syncRecord.lastWebhookAt) {
      const timeDiff = now.getTime() - syncRecord.lastWebhookAt.getTime();
      if (timeDiff < this.SYNC_CONFLICT_THRESHOLD_MS) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Handle synchronization conflicts
   */
  private async handleSyncConflict(
    transaction: any,
    syncRecordRef: any,
    syncRecord: SubscriptionSyncRecord,
    operation: SyncOperation
  ): Promise<{ syncRecord: SubscriptionSyncRecord; conflict: boolean }> {
    console.warn(`[SUBSCRIPTION SYNC] Conflict detected for subscription ${syncRecord.stripeSubscriptionId}`);
    
    // Get authoritative data from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(syncRecord.stripeSubscriptionId);
    
    // Get current Firestore data
    const firestoreRef = doc(db, 'users', syncRecord.userId, 'subscription', 'current');
    const firestoreDoc = await transaction.get(firestoreRef);
    const firestoreData = firestoreDoc.exists() ? firestoreDoc.data() : null;
    
    // Record conflict details
    const conflictDetails = {
      stripeStatus: stripeSubscription.status,
      firestoreStatus: firestoreData?.status || 'unknown',
      detectedAt: new Date()
    };
    
    // Update sync record with conflict information
    const updatedSyncRecord = {
      ...syncRecord,
      status: 'conflict' as const,
      conflictDetails,
      lastSyncAt: new Date(),
      correlationId: operation.correlationId
    };
    
    transaction.set(syncRecordRef, {
      ...updatedSyncRecord,
      lastSyncAt: serverTimestamp(),
      conflictDetails: {
        ...conflictDetails,
        detectedAt: conflictDetails.detectedAt
      }
    });
    
    // Log conflict for monitoring
    await this.logSyncConflict(syncRecord.userId, syncRecord.stripeSubscriptionId, conflictDetails, operation.correlationId);
    
    return { syncRecord: updatedSyncRecord, conflict: true };
  }

  /**
   * Perform the actual subscription update
   */
  private async performSubscriptionUpdate(
    userId: string,
    operation: SyncOperation
  ): Promise<{ success: boolean; message: string }> {
    try {
      const subscriptionRef = doc(db, 'users', userId, 'subscriptions', 'current');

      // Merge operation data with existing subscription data
      await updateDoc(subscriptionRef, {
        ...operation.subscriptionData,
        lastSyncAt: serverTimestamp(),
        syncSource: operation.type,
        syncCorrelationId: operation.correlationId
      });

      return {
        success: true,
        message: `Subscription updated successfully via ${operation.type}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to update subscription: ${error.message}`
      };
    }
  }

  /**
   * Release synchronization lock
   */
  private async releaseSyncLock(
    userId: string,
    stripeSubscriptionId: string,
    success: boolean
  ): Promise<void> {
    try {
      const syncRecordRef = doc(db, 'subscriptionSync', `${userId}_${stripeSubscriptionId}`);
      
      await updateDoc(syncRecordRef, {
        status: success ? 'synced' : 'error',
        lockExpiry: null,
        lastSyncAt: serverTimestamp()
      });
    } catch (error) {
      console.error(`[SUBSCRIPTION SYNC] Failed to release lock for ${userId}:`, error);
    }
  }

  /**
   * Log synchronization conflicts for monitoring
   */
  private async logSyncConflict(
    userId: string,
    stripeSubscriptionId: string,
    conflictDetails: any,
    correlationId: CorrelationId
  ): Promise<void> {
    try {
      const conflictLog = {
        type: 'SUBSCRIPTION_SYNC_CONFLICT',
        userId,
        stripeSubscriptionId,
        conflictDetails,
        correlationId,
        timestamp: serverTimestamp(),
        severity: 'medium',
        requiresAttention: true
      };
      
      await setDoc(doc(db, 'syncConflicts', `${userId}_${stripeSubscriptionId}_${Date.now()}`), conflictLog);
      
      console.warn(`[SUBSCRIPTION SYNC] Conflict logged for monitoring:`, {
        userId,
        stripeSubscriptionId,
        correlationId,
        conflictDetails
      });
    } catch (error) {
      console.error(`[SUBSCRIPTION SYNC] Failed to log conflict:`, error);
    }
  }

  /**
   * Resolve a synchronization conflict by using Stripe as source of truth
   */
  public async resolveConflict(
    userId: string,
    stripeSubscriptionId: string,
    correlationId?: CorrelationId
  ): Promise<{ success: boolean; message: string }> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    
    try {
      // Get authoritative data from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      
      // Create sync operation with Stripe data
      const syncOperation: SyncOperation = {
        type: 'api_call',
        source: 'conflict_resolution',
        timestamp: new Date(),
        correlationId: corrId,
        subscriptionData: {
          stripeSubscriptionId: stripeSubscription.id,
          status: stripeSubscription.status,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          resolvedConflictAt: new Date().toISOString()
        }
      };
      
      // Synchronize with conflict resolution flag
      const result = await this.synchronizeSubscription(userId, stripeSubscriptionId, syncOperation);
      
      if (result.success) {
        // Mark conflict as resolved
        const syncRecordRef = doc(db, 'subscriptionSync', `${userId}_${stripeSubscriptionId}`);
        await updateDoc(syncRecordRef, {
          status: 'synced',
          'conflictDetails.resolvedAt': serverTimestamp()
        });
      }
      
      return result;
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to resolve conflict: ${error.message}`
      };
    }
  }

  /**
   * Get synchronization status for a subscription
   */
  public async getSyncStatus(
    userId: string,
    stripeSubscriptionId: string
  ): Promise<SubscriptionSyncRecord | null> {
    try {
      const syncDoc = await getDoc(doc(db, 'subscriptionSync', `${userId}_${stripeSubscriptionId}`));
      
      if (syncDoc.exists()) {
        const data = syncDoc.data();
        return {
          ...data,
          lastSyncAt: data.lastSyncAt?.toDate(),
          lastWebhookAt: data.lastWebhookAt?.toDate(),
          lastApiCallAt: data.lastApiCallAt?.toDate(),
          lockExpiry: data.lockExpiry?.toDate(),
          conflictDetails: data.conflictDetails ? {
            ...data.conflictDetails,
            detectedAt: data.conflictDetails.detectedAt?.toDate(),
            resolvedAt: data.conflictDetails.resolvedAt?.toDate()
          } : undefined
        } as SubscriptionSyncRecord;
      }
      
      return null;
    } catch (error) {
      console.error(`[SUBSCRIPTION SYNC] Failed to get sync status:`, error);
      return null;
    }
  }
}