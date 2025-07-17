/**
 * Automated Payout Processing Service
 * 
 * Handles automated processing of writer payouts with comprehensive
 * error handling, retry logic, and monitoring capabilities.
 */

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';

import { stripePayoutService } from './stripePayoutService';
import { TransactionTrackingService } from './transactionTrackingService';
import { FinancialOperationsService } from './financialOperationsService';
import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';

import { getCollectionName } from "../utils/environmentConfig";
import type {
  Payout,
  PayoutRecipient,
  PayoutApiResponse,
  PayoutProcessingResult,
  PayoutBatchResult
} from '../types/payout';

/**
 * Configuration for automated payout processing
 */
export interface AutomatedPayoutConfig {
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  processingTimeoutMs: number;
  minimumThreshold: number;
  maxConcurrentProcessing: number;
  enableFailsafe: boolean;
}

/**
 * Payout processing queue item
 */
export interface PayoutQueueItem {
  payoutId: string;
  priority: 'high' | 'normal' | 'low';
  scheduledAt: Date;
  retryCount: number;
  lastAttemptAt?: Date;
  correlationId: CorrelationId;
}

/**
 * Payout processing status
 */
export interface PayoutProcessingStatus {
  isProcessing: boolean;
  currentBatch?: string;
  totalInQueue: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  lastProcessedAt?: Date;
  errors: Array<{
    payoutId: string;
    error: string;
    timestamp: Date;
  }>;
}

const DEFAULT_CONFIG: AutomatedPayoutConfig = {
  batchSize: 10,
  maxRetries: 3,
  retryDelayMs: 30000, // 30 seconds
  processingTimeoutMs: 300000, // 5 minutes
  minimumThreshold: 25, // $25 USD
  maxConcurrentProcessing: 5,
  enableFailsafe: true
};

export class AutomatedPayoutService {
  private static instance: AutomatedPayoutService;
  private config: AutomatedPayoutConfig;
  private processingStatus: PayoutProcessingStatus;
  private processingQueue: PayoutQueueItem[] = [];
  private isProcessing = false;

  private constructor(config: Partial<AutomatedPayoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.processingStatus = {
      isProcessing: false,
      totalInQueue: 0,
      totalProcessing: 0,
      totalCompleted: 0,
      totalFailed: 0,
      errors: []
    };
  }

  static getInstance(config?: Partial<AutomatedPayoutConfig>): AutomatedPayoutService {
    if (!AutomatedPayoutService.instance) {
      AutomatedPayoutService.instance = new AutomatedPayoutService(config);
    }
    return AutomatedPayoutService.instance;
  }

  /**
   * Process all pending payouts automatically
   */
  async processAllPendingPayouts(
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<PayoutBatchResult>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    
    try {
      FinancialLogger.logOperation('AUTOMATED_PAYOUT_START', {
        correlationId: corrId,
        config: this.config
      });

      if (this.isProcessing) {
        return {
          success: false,
          error: FinancialUtils.createError(FinancialErrorCode.OPERATION_IN_PROGRESS, 'Automated payout processing already in progress', corrId , false),
          correlationId: corrId
        };
      }

      this.isProcessing = true;
      this.processingStatus.isProcessing = true;
      this.processingStatus.currentBatch = FinancialUtils.generateId();

      // Get all pending payouts
      const pendingPayouts = await this.getPendingPayouts(corrId);
      
      if (!pendingPayouts.success || !pendingPayouts.data) {
        this.isProcessing = false;
        this.processingStatus.isProcessing = false;
        return pendingPayouts as FinancialOperationResult<PayoutBatchResult>;
      }

      const payouts = pendingPayouts.data;
      this.processingStatus.totalInQueue = payouts.length;

      FinancialLogger.logOperation('AUTOMATED_PAYOUT_QUEUE', {
        correlationId: corrId,
        totalPayouts: payouts.length,
        totalAmount: payouts.reduce((sum, p) => sum + p.amount, 0)
      });

      // Process payouts in batches
      const batchResult = await this.processBatches(payouts, corrId);

      this.isProcessing = false;
      this.processingStatus.isProcessing = false;
      this.processingStatus.lastProcessedAt = new Date();

      FinancialLogger.logOperation('AUTOMATED_PAYOUT_COMPLETE', {
        correlationId: corrId,
        result: batchResult
      });

      return {
        success: true,
        data: batchResult,
        correlationId: corrId
      };

    } catch (error: any) {
      this.isProcessing = false;
      this.processingStatus.isProcessing = false;
      
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Automated payout processing failed: ${error.message}`, corrId, true, {  originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Get current processing status
   */
  getProcessingStatus(): PayoutProcessingStatus {
    return { ...this.processingStatus };
  }

  /**
   * Schedule a payout for automated processing
   */
  async schedulePayoutProcessing(
    payoutId: string,
    priority: 'high' | 'normal' | 'low' = 'normal',
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      const queueItem: PayoutQueueItem = {
        payoutId,
        priority,
        scheduledAt: new Date(),
        retryCount: 0,
        correlationId: corrId
      };

      this.processingQueue.push(queueItem);
      this.processingQueue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      FinancialLogger.logOperation('PAYOUT_SCHEDULED', {
        correlationId: corrId,
        payoutId,
        priority,
        queueLength: this.processingQueue.length
      });

      return {
        success: true,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to schedule payout processing: ${error.message}`, corrId, true, {  payoutId, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Process queued payouts
   */
  async processQueue(correlationId?: CorrelationId): Promise<FinancialOperationResult<PayoutBatchResult>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    if (this.processingQueue.length === 0) {
      return {
        success: true,
        data: {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          errors: []
        },
        correlationId: corrId
      };
    }

    const queuedPayouts = [...this.processingQueue];
    this.processingQueue = [];

    // Convert queue items to payout objects
    const payouts: Payout[] = [];
    for (const item of queuedPayouts) {
      const payoutDoc = await getDoc(doc(db, getCollectionName("payouts"), item.payoutId));
      if (payoutDoc.exists()) {
        payouts.push({ id: payoutDoc.id, ...payoutDoc.data() } as Payout);
      }
    }

    return this.processBatches(payouts, corrId);
  }

  /**
   * Get all pending payouts that are eligible for processing
   */
  private async getPendingPayouts(
    correlationId: CorrelationId
  ): Promise<FinancialOperationResult<Payout[]>> {
    try {
      const payoutsQuery = query(
        collection(db, getCollectionName('payouts')),
        where('status', '==', 'pending'),
        where('amount', '>=', this.config.minimumThreshold),
        orderBy('scheduledAt', 'asc'),
        limit(100) // Process max 100 at a time
      );

      const payoutsSnapshot = await getDocs(payoutsQuery);
      const payouts: Payout[] = payoutsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Payout));

      // Filter out payouts that have exceeded max retries
      const eligiblePayouts = payouts.filter(payout =>
        (payout.retryCount || 0) < this.config.maxRetries
      );

      FinancialLogger.logOperation('PENDING_PAYOUTS_RETRIEVED', {
        correlationId,
        totalFound: payouts.length,
        eligible: eligiblePayouts.length,
        filtered: payouts.length - eligiblePayouts.length
      });

      return {
        success: true,
        data: eligiblePayouts,
        correlationId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.DATABASE_ERROR, `Failed to retrieve pending payouts: ${error.message}`, { correlationId, originalError: error }, true);

      FinancialLogger.logError(financialError, correlationId);

      return {
        success: false,
        error: financialError,
        correlationId
      };
    }
  }

  /**
   * Process payouts in batches with concurrency control
   */
  private async processBatches(
    payouts: Payout[],
    correlationId: CorrelationId
  ): Promise<PayoutBatchResult> {
    const result: PayoutBatchResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Split payouts into batches
    const batches: Payout[][] = [];
    for (let i = 0; i < payouts.length; i += this.config.batchSize) {
      batches.push(payouts.slice(i, i + this.config.batchSize));
    }

    FinancialLogger.logOperation('BATCH_PROCESSING_START', {
      correlationId,
      totalPayouts: payouts.length,
      totalBatches: batches.length,
      batchSize: this.config.batchSize
    });

    // Process batches with concurrency control
    const semaphore = new Array(this.config.maxConcurrentProcessing).fill(null);
    const batchPromises: Promise<void>[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      const batchPromise = this.processBatch(batch, batchIndex, correlationId)
        .then(batchResult => {
          result.totalProcessed += batchResult.totalProcessed;
          result.successful += batchResult.successful;
          result.failed += batchResult.failed;
          result.errors.push(...batchResult.errors);
        })
        .catch(error => {
          FinancialLogger.logError(
            FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Batch ${batchIndex} processing failed: ${error.message}`, { correlationId, batchIndex, originalError: error }, true),
            correlationId
          );

          // Mark all payouts in this batch as failed
          batch.forEach(payout => {
            result.totalProcessed++;
            result.failed++;
            result.errors.push({
              payoutId: payout.id,
              error: `Batch processing failed: ${error.message}`,
              timestamp: new Date()
            });
          });
        });

      batchPromises.push(batchPromise);

      // Limit concurrent processing
      if (batchPromises.length >= this.config.maxConcurrentProcessing) {
        await Promise.race(batchPromises);
        // Remove completed promises
        const completedIndex = batchPromises.findIndex(p =>
          p.constructor.name === 'Promise' &&
          (p as any).isFulfilled !== undefined
        );
        if (completedIndex >= 0) {
          batchPromises.splice(completedIndex, 1);
        }
      }
    }

    // Wait for all remaining batches to complete
    await Promise.all(batchPromises);

    FinancialLogger.logOperation('BATCH_PROCESSING_COMPLETE', {
      correlationId,
      result
    });

    return result;
  }

  /**
   * Process a single batch of payouts
   */
  private async processBatch(
    batch: Payout[],
    batchIndex: number,
    correlationId: CorrelationId
  ): Promise<PayoutBatchResult> {
    const batchId = `batch_${batchIndex}_${Date.now()}`;
    const result: PayoutBatchResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    FinancialLogger.logOperation('BATCH_START', {
      correlationId,
      batchId,
      batchIndex,
      payoutCount: batch.length
    });

    // Process each payout in the batch
    const payoutPromises = batch.map(async (payout) => {
      try {
        const payoutResult = await this.processSinglePayout(payout, correlationId);

        result.totalProcessed++;

        if (payoutResult.success) {
          result.successful++;
          this.processingStatus.totalCompleted++;
        } else {
          result.failed++;
          this.processingStatus.totalFailed++;
          result.errors.push({
            payoutId: payout.id,
            error: payoutResult.error?.message || 'Unknown error',
            timestamp: new Date()
          });
        }

      } catch (error: any) {
        result.totalProcessed++;
        result.failed++;
        this.processingStatus.totalFailed++;
        result.errors.push({
          payoutId: payout.id,
          error: `Processing exception: ${error.message}`,
          timestamp: new Date()
        });

        FinancialLogger.logError(
          FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Payout ${payout.id} processing failed: ${error.message}`, { correlationId, payoutId: payout.id, originalError: error }, true),
          correlationId
        );
      }
    });

    await Promise.all(payoutPromises);

    FinancialLogger.logOperation('BATCH_COMPLETE', {
      correlationId,
      batchId,
      batchIndex,
      result
    });

    return result;
  }

  /**
   * Process a single payout with comprehensive error handling and retry logic
   */
  private async processSinglePayout(
    payout: Payout,
    correlationId: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    try {
await updateDoc(doc(db, getCollectionName("payouts"), payout.id), {
        status: 'processing',
        processingStartedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      this.processingStatus.totalProcessing++;

      // Track the payout processing transaction
      const trackingResult = await TransactionTrackingService.trackPayoutRequest(
        payout.id,
        payout.recipientId,
        payout.amount,
        undefined,
        correlationId
      );

      if (!trackingResult.success) {
        throw new Error(`Failed to track payout: ${trackingResult.error?.message}`);
      }

      // Process the payout through Stripe
      const stripeResult = await stripePayoutService.processPayout(payout.id);

      if (!stripeResult.success) {
        // Handle retry logic
        const retryCount = (payout.retryCount || 0) + 1;
        const shouldRetry = retryCount < this.config.maxRetries;
await updateDoc(doc(db, getCollectionName("payouts"), payout.id), {
          status: shouldRetry ? 'pending' : 'failed',
          retryCount: increment(1),
          lastFailureReason: stripeResult.error,
          lastAttemptAt: serverTimestamp(),
          nextRetryAt: shouldRetry ?
            new Date(Date.now() + this.config.retryDelayMs) : null,
          updatedAt: serverTimestamp()
        });

        this.processingStatus.totalProcessing--;

        if (shouldRetry) {
          // Schedule for retry
          await this.schedulePayoutProcessing(payout.id, 'normal', correlationId);

          FinancialLogger.logOperation('PAYOUT_RETRY_SCHEDULED', {
            correlationId,
            payoutId: payout.id,
            retryCount,
            nextRetryAt: new Date(Date.now() + this.config.retryDelayMs)
          });
        }

        return {
          success: false,
          error: FinancialUtils.createError(
            FinancialErrorCode.EXTERNAL_SERVICE_ERROR,
            stripeResult.error || 'Stripe payout processing failed',
            correlationId,
            shouldRetry,
            { payoutId: payout.id, retryCount }
          ),
          correlationId
        };
      }

      // Update transaction tracking
      if (trackingResult.data) {
        await TransactionTrackingService.updateTransactionStatus(
          trackingResult.data.id,
          'completed',
          correlationId
        );
      }

      this.processingStatus.totalProcessing--;

      FinancialLogger.logOperation('PAYOUT_PROCESSED', {
        correlationId,
        payoutId: payout.id,
        amount: payout.amount,
        recipientId: payout.recipientId
      });

      return {
        success: true,
        correlationId
      };

    } catch (error: any) {
      this.processingStatus.totalProcessing--;

await updateDoc(doc(db, getCollectionName("payouts"), payout.id), {
        status: 'failed',
        retryCount: increment(1),
        lastFailureReason: error.message,
        lastAttemptAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(updateError => {
        FinancialLogger.logError(
          FinancialUtils.createError(FinancialErrorCode.DATABASE_ERROR, `Failed to update payout status: ${updateError.message}`, { correlationId, payoutId: payout.id, originalError: updateError }, true),
          correlationId
        );
      });

      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Payout processing failed: ${error.message}`, { correlationId, payoutId: payout.id, originalError: error }, false);

      FinancialLogger.logError(financialError, correlationId);

      return {
        success: false,
        error: financialError,
        correlationId
      };
    }
  }
}