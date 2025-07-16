/**
 * Payout Retry Service
 * 
 * Handles automatic retry logic for failed payouts with exponential backoff,
 * maximum retry limits, and intelligent failure analysis.
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
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { payoutStatusService } from './payoutStatusService';
import { StripePayoutService } from './stripePayoutService';
import { payoutNotificationService } from './payoutNotificationService';
import { FinancialLogger } from '../types/financial';
import type { Payout } from '../types/payout';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableFailureCodes: string[];
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: Timestamp;
  failureReason: string;
  nextRetryAt?: Timestamp;
  isRetryable: boolean;
}

export class PayoutRetryService {
  private static instance: PayoutRetryService;
  private retryConfig: RetryConfig;

  constructor() {
    this.retryConfig = {
      maxRetries: 3,
      baseDelayMs: 5 * 60 * 1000, // 5 minutes
      maxDelayMs: 24 * 60 * 60 * 1000, // 24 hours
      backoffMultiplier: 2,
      retryableFailureCodes: [
        'account_closed', // Temporary account issues
        'insufficient_funds', // Platform balance issues
        'debit_not_authorized', // Temporary authorization issues
        'generic_decline', // Generic temporary failures
        'processing_error', // Stripe processing errors
        'rate_limit', // Rate limiting
        'api_connection_error', // Network issues
        'api_error' // Temporary API errors
      ]
    };
  }

  static getInstance(): PayoutRetryService {
    if (!PayoutRetryService.instance) {
      PayoutRetryService.instance = new PayoutRetryService();
    }
    return PayoutRetryService.instance;
  }

  /**
   * Determine if a payout failure is retryable
   */
  isRetryable(failureReason: string, retryCount: number): boolean {
    // Check retry count limit
    if (retryCount >= this.retryConfig.maxRetries) {
      return false;
    }

    // Check if failure code is retryable
    const isRetryableCode = this.retryConfig.retryableFailureCodes.some(code =>
      failureReason.toLowerCase().includes(code.toLowerCase())
    );

    return isRetryableCode;
  }

  /**
   * Calculate next retry delay using exponential backoff
   */
  calculateRetryDelay(retryCount: number): number {
    const delay = this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, retryCount);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Schedule a payout for retry
   */
  async scheduleRetry(payoutId: string, failureReason: string): Promise<{
    success: boolean;
    nextRetryAt?: Date;
    error?: string;
  }> {
    try {
      console.log(`Scheduling retry for payout ${payoutId}`);

      // Get current payout data
      const payoutDoc = await getDoc(doc(db, getCollectionName('payouts'), payoutId));
      if (!payoutDoc.exists()) {
        throw new Error(`Payout ${payoutId} not found`);
      }

      const payout = payoutDoc.data() as Payout;
      const currentRetryCount = payout.retryCount || 0;

      // Check if retryable
      if (!this.isRetryable(failureReason, currentRetryCount)) {
        console.log(`Payout ${payoutId} is not retryable (count: ${currentRetryCount}, reason: ${failureReason})`);
        return { success: false, error: 'Payout is not retryable' };
      }

      // Calculate next retry time
      const retryDelayMs = this.calculateRetryDelay(currentRetryCount);
      const nextRetryAt = new Date(Date.now() + retryDelayMs);

      // Create retry attempt record
      const retryAttempt: RetryAttempt = {
        attemptNumber: currentRetryCount + 1,
        timestamp: serverTimestamp() as any,
        failureReason,
        nextRetryAt: Timestamp.fromDate(nextRetryAt),
        isRetryable: true
      };

      // Update payout with retry information
      await updateDoc(doc(db, getCollectionName('payouts'), payoutId), {
        status: 'pending', // Reset to pending for retry
        nextRetryAt: Timestamp.fromDate(nextRetryAt),
        retryAttempts: [
          ...(payout.retryAttempts || []),
          retryAttempt
        ],
        updatedAt: serverTimestamp()
      });

      // Log the retry scheduling
      FinancialLogger.logOperation('PAYOUT_RETRY_SCHEDULED', {
        payoutId,
        retryCount: currentRetryCount + 1,
        nextRetryAt: nextRetryAt.toISOString(),
        failureReason,
        retryDelayMs
      });

      console.log(`Payout ${payoutId} scheduled for retry at ${nextRetryAt.toISOString()}`);

      // Send retry notification
      await payoutNotificationService.sendPayoutNotification(
        payoutId,
        'payout_retry_scheduled',
        ['email', 'in_app']
      );

      return { success: true, nextRetryAt };

    } catch (error) {
      console.error(`Error scheduling retry for payout ${payoutId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process all payouts that are due for retry
   */
  async processRetries(): Promise<{
    success: boolean;
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    try {
      console.log('Processing payout retries...');

      // Query for payouts due for retry
      const now = new Date();
      const retryQuery = query(
        collection(db, getCollectionName('payouts')),
        where('status', '==', 'pending'),
        where('nextRetryAt', '<=', Timestamp.fromDate(now)),
        orderBy('nextRetryAt'),
        limit(50) // Process in batches
      );

      const retrySnapshot = await getDocs(retryQuery);
      const payouts = retrySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payout[];

      console.log(`Found ${payouts.length} payouts due for retry`);

      let successful = 0;
      let failed = 0;
      const errors: string[] = [];

      // Process each payout
      for (const payout of payouts) {
        try {
          console.log(`Retrying payout ${payout.id} (attempt ${(payout.retryCount || 0) + 1})`);

          // Attempt to process the payout
          const stripePayoutService = StripePayoutService.getInstance();
          const result = await stripePayoutService.processPayout(payout.id);

          if (result.success) {
            successful++;
            console.log(`Payout ${payout.id} retry successful`);
          } else {
            failed++;
            console.log(`Payout ${payout.id} retry failed: ${result.error}`);

            // Schedule another retry if applicable
            const scheduleResult = await this.scheduleRetry(payout.id, result.error || 'Unknown error');
            if (!scheduleResult.success) {
              // Mark as permanently failed
              await payoutStatusService.updatePayoutStatus({
                payoutId: payout.id,
                status: 'failed',
                reason: 'Maximum retries exceeded',
                updateRecipientBalance: true
              });
            }
          }

        } catch (error) {
          failed++;
          errors.push(`Payout ${payout.id}: ${error.message}`);
          console.error(`Error retrying payout ${payout.id}:`, error);
        }
      }

      // Log summary
      FinancialLogger.logOperation('PAYOUT_RETRIES_PROCESSED', {
        totalProcessed: payouts.length,
        successful,
        failed,
        errors: errors.length
      });

      console.log(`Retry processing complete: ${successful} successful, ${failed} failed`);

      return {
        success: true,
        processed: payouts.length,
        successful,
        failed,
        errors
      };

    } catch (error) {
      console.error('Error processing payout retries:', error);
      return {
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Get retry statistics
   */
  async getRetryStatistics(): Promise<{
    success: boolean;
    data?: {
      pendingRetries: number;
      totalRetries: number;
      successRate: number;
      averageRetryDelay: number;
    };
    error?: string;
  }> {
    try {
      // Query for payouts with retry information
      const retryQuery = query(
        collection(db, getCollectionName('payouts')),
        where('retryCount', '>', 0)
      );

      const retrySnapshot = await getDocs(retryQuery);
      const payoutsWithRetries = retrySnapshot.docs.map(doc => doc.data()) as Payout[];

      // Calculate statistics
      const totalRetries = payoutsWithRetries.reduce((sum, p) => sum + (p.retryCount || 0), 0);
      const successfulRetries = payoutsWithRetries.filter(p => p.status === 'completed').length;
      const successRate = totalRetries > 0 ? (successfulRetries / totalRetries) * 100 : 0;

      // Count pending retries
      const pendingRetries = payoutsWithRetries.filter(p => 
        p.status === 'pending' && p.nextRetryAt
      ).length;

      return {
        success: true,
        data: {
          pendingRetries,
          totalRetries,
          successRate,
          averageRetryDelay: this.retryConfig.baseDelayMs
        }
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
    console.log('Retry configuration updated:', this.retryConfig);
  }

  /**
   * Get current retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
}

export const payoutRetryService = PayoutRetryService.getInstance();
