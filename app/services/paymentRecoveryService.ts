/**
 * Enhanced Payment Recovery Service
 * Implements intelligent retry scheduling with exponential backoff for failed payments
 */

import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import Stripe from 'stripe';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../utils/environmentConfig';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { FinancialUtils, CorrelationId } from '../types/financial';
import { getCollectionName } from "../utils/environmentConfig";

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'});

export interface PaymentFailureRecord {
  id: string;
  userId: string;
  subscriptionId: string;
  invoiceId: string;
  failureCount: number;
  failureReason: string;
  failureType: 'card_declined' | 'insufficient_funds' | 'expired_card' | 'authentication_required' | 'other';
  lastFailureAt: Date;
  nextRetryAt: Date | null;
  retrySchedule: RetryAttempt[];
  status: 'active' | 'resolved' | 'abandoned';
  correlationId: CorrelationId;
  metadata: {
    originalAmount: number;
    currency: string;
    paymentMethodId?: string;
    customerEmail?: string;
  };
}

export interface RetryAttempt {
  attemptNumber: number;
  scheduledAt: Date;
  executedAt?: Date;
  result?: 'success' | 'failure' | 'skipped';
  failureReason?: string;
  nextRetryDelay?: number; // in minutes
}

export interface RetryStrategy {
  maxAttempts: number;
  baseDelayMinutes: number;
  maxDelayMinutes: number;
  backoffMultiplier: number;
  jitterPercentage: number;
}

export class PaymentRecoveryService {
  private static instance: PaymentRecoveryService;
  
  private readonly defaultStrategy: RetryStrategy = {
    maxAttempts: 5,
    baseDelayMinutes: 60, // Start with 1 hour
    maxDelayMinutes: 7 * 24 * 60, // Max 7 days
    backoffMultiplier: 2,
    jitterPercentage: 10
  };

  private constructor() {}

  public static getInstance(): PaymentRecoveryService {
    if (!PaymentRecoveryService.instance) {
      PaymentRecoveryService.instance = new PaymentRecoveryService();
    }
    return PaymentRecoveryService.instance;
  }

  /**
   * Record a payment failure and schedule intelligent retries
   */
  public async recordPaymentFailure(
    userId: string,
    subscriptionId: string,
    invoiceId: string,
    failureReason: string,
    amount: number,
    currency: string = 'USD',
    correlationId?: CorrelationId
  ): Promise<PaymentFailureRecord> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    
    // Get existing failure record or create new one
    const existingRecord = await this.getFailureRecord(userId, subscriptionId);
    const failureCount = existingRecord ? existingRecord.failureCount + 1 : 1;
    
    // Determine failure type for intelligent retry strategy
    const failureType = this.categorizeFailure(failureReason);
    
    // Generate retry schedule
    const retrySchedule = this.generateRetrySchedule(failureCount, failureType);
    
    const failureRecord: PaymentFailureRecord = {
      id: existingRecord?.id || `failure_${userId}_${subscriptionId}_${Date.now()}`,
      userId,
      subscriptionId,
      invoiceId,
      failureCount,
      failureReason,
      failureType,
      lastFailureAt: new Date(),
      nextRetryAt: retrySchedule.length > 0 ? retrySchedule[0].scheduledAt : null,
      retrySchedule,
      status: retrySchedule.length > 0 ? 'active' : 'abandoned',
      correlationId: corrId,
      metadata: {
        originalAmount: amount,
        currency,
        customerEmail: await this.getCustomerEmail(userId)
      }
    };

    // Save failure record
    await setDoc(doc(db, 'paymentFailures', failureRecord.id), {
      ...failureRecord,
      lastFailureAt: serverTimestamp(),
      nextRetryAt: failureRecord.nextRetryAt ? failureRecord.nextRetryAt : null,
      retrySchedule: failureRecord.retrySchedule.map(attempt => ({
        ...attempt,
        scheduledAt: attempt.scheduledAt
      }))
    });

    // Update subscription with failure tracking
    await this.updateSubscriptionFailureStatus(userId, failureCount, failureRecord.nextRetryAt);

    // Schedule next retry if applicable
    if (failureRecord.nextRetryAt) {
      await this.scheduleRetryAttempt(failureRecord.id, failureRecord.nextRetryAt);
    }

    console.log(`[PAYMENT RECOVERY] Recorded failure for user ${userId}, attempt ${failureCount}, next retry: ${failureRecord.nextRetryAt?.toISOString() || 'none'}`);

    return failureRecord;
  }

  /**
   * Execute a scheduled retry attempt
   */
  public async executeRetryAttempt(failureRecordId: string): Promise<{
    success: boolean;
    result: 'success' | 'failure' | 'skipped';
    message: string;
  }> {
    const failureDoc = await getDoc(doc(db, 'paymentFailures', failureRecordId));
    
    if (!failureDoc.exists()) {
      return { success: false, result: 'skipped', message: 'Failure record not found' };
    }

    const failureRecord = failureDoc.data() as PaymentFailureRecord;
    
    if (failureRecord.status !== 'active') {
      return { success: false, result: 'skipped', message: 'Failure record is not active' };
    }

    try {
      // Attempt to retry the payment through Stripe
      const retryResult = await this.retryStripePayment(failureRecord.invoiceId);
      
      if (retryResult.success) {
        // Payment succeeded - mark as resolved
        await this.markFailureResolved(failureRecordId);
        await this.clearSubscriptionFailureStatus(failureRecord.userId);
        
        return { 
          success: true, 
          result: 'success', 
          message: 'Payment retry succeeded' 
        };
      } else {
        // Payment failed again - schedule next retry if available
        const nextRetry = await this.scheduleNextRetry(failureRecordId, retryResult.error);
        
        return { 
          success: false, 
          result: 'failure', 
          message: `Payment retry failed: ${retryResult.error}. ${nextRetry ? `Next retry scheduled for ${nextRetry.toISOString()}` : 'No more retries scheduled.'}` 
        };
      }
    } catch (error: any) {
      console.error(`[PAYMENT RECOVERY] Error executing retry for ${failureRecordId}:`, error);
      
      return { 
        success: false, 
        result: 'failure', 
        message: `Retry execution failed: ${error.message}` 
      };
    }
  }

  /**
   * Generate intelligent retry schedule based on failure type and count
   */
  private generateRetrySchedule(failureCount: number, failureType: string): RetryAttempt[] {
    const strategy = this.getRetryStrategy(failureType);
    const schedule: RetryAttempt[] = [];
    
    const remainingAttempts = Math.max(0, strategy.maxAttempts - failureCount + 1);
    
    for (let i = 0; i < remainingAttempts; i++) {
      const attemptNumber = failureCount + i;
      const baseDelay = strategy.baseDelayMinutes * Math.pow(strategy.backoffMultiplier, i);
      const maxDelay = strategy.maxDelayMinutes;
      const delayWithCap = Math.min(baseDelay, maxDelay);
      
      // Add jitter to prevent thundering herd
      const jitter = delayWithCap * (strategy.jitterPercentage / 100) * (Math.random() - 0.5);
      const finalDelay = Math.max(1, delayWithCap + jitter); // Minimum 1 minute
      
      const scheduledAt = new Date(Date.now() + finalDelay * 60 * 1000);
      
      schedule.push({
        attemptNumber,
        scheduledAt,
        nextRetryDelay: i < remainingAttempts - 1 ? finalDelay : undefined
      });
    }
    
    return schedule;
  }

  /**
   * Get retry strategy based on failure type
   */
  private getRetryStrategy(failureType: string): RetryStrategy {
    switch (failureType) {
      case 'insufficient_funds':
        return {
          ...this.defaultStrategy,
          baseDelayMinutes: 24 * 60, // Start with 24 hours for insufficient funds
          maxAttempts: 3
        };
      
      case 'expired_card':
        return {
          ...this.defaultStrategy,
          baseDelayMinutes: 7 * 24 * 60, // Start with 7 days for expired cards
          maxAttempts: 2
        };
      
      case 'authentication_required':
        return {
          ...this.defaultStrategy,
          baseDelayMinutes: 30, // Quick retry for 3DS authentication
          maxAttempts: 2
        };
      
      case 'card_declined':
      default:
        return this.defaultStrategy;
    }
  }

  /**
   * Categorize failure reason for intelligent retry strategy
   */
  private categorizeFailure(failureReason: string): PaymentFailureRecord['failureType'] {
    const reason = failureReason.toLowerCase();
    
    if (reason.includes('insufficient') || reason.includes('funds')) {
      return 'insufficient_funds';
    }
    if (reason.includes('expired') || reason.includes('card_expired')) {
      return 'expired_card';
    }
    if (reason.includes('authentication') || reason.includes('3d_secure')) {
      return 'authentication_required';
    }
    if (reason.includes('declined') || reason.includes('card_declined')) {
      return 'card_declined';
    }
    
    return 'other';
  }

  /**
   * Retry payment through Stripe
   */
  private async retryStripePayment(invoiceId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Attempt to pay the invoice
      const invoice = await stripe.invoices.pay(invoiceId);
      
      if (invoice.status === 'paid') {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `Invoice status: ${invoice.status}` 
        };
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || 'Unknown Stripe error' 
      };
    }
  }

  /**
   * Get existing failure record for user/subscription
   */
  private async getFailureRecord(userId: string, subscriptionId: string): Promise<PaymentFailureRecord | null> {
    // Implementation would query for existing active failure record
    // For now, return null to create new record each time
    return null;
  }

  /**
   * Get customer email for notifications
   */
  private async getCustomerEmail(userId: string): Promise<string | undefined> {
    try {
      const userDoc = await getDoc(doc(db, getCollectionName("users"), userId));
      return userDoc.data()?.email;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Update subscription with failure status
   */
  private async updateSubscriptionFailureStatus(
    userId: string, 
    failureCount: number, 
    nextRetryAt: Date | null
  ): Promise<void> {
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);
    const subscriptionRef = doc(db, parentPath, subCollectionName, 'current');
    
    await updateDoc(subscriptionRef, {
      status: 'past_due',
      failureCount,
      nextRetryAt: nextRetryAt ? nextRetryAt : null,
      lastFailureProcessedAt: serverTimestamp()
    });
  }

  /**
   * Clear subscription failure status on successful payment
   */
  async clearSubscriptionFailureStatus(userId: string): Promise<void> {
    const subscriptionRef = doc(db, getCollectionName("users"), userId, 'subscription', 'current');

    await updateDoc(subscriptionRef, {
      status: 'active',
      failureCount: 0,
      nextRetryAt: null,
      lastSuccessfulPaymentAt: serverTimestamp()
    });
  }

  /**
   * Mark failure record as resolved
   */
  private async markFailureResolved(failureRecordId: string): Promise<void> {
    await updateDoc(doc(db, 'paymentFailures', failureRecordId), {
      status: 'resolved',
      resolvedAt: serverTimestamp()
    });
  }

  /**
   * Schedule next retry attempt
   */
  private async scheduleNextRetry(failureRecordId: string, error: string): Promise<Date | null> {
    // Implementation would update the failure record with next retry
    // and schedule the retry job
    return null;
  }

  /**
   * Schedule retry attempt (would integrate with job scheduler)
   */
  private async scheduleRetryAttempt(failureRecordId: string, retryAt: Date): Promise<void> {
    // Implementation would schedule a job to execute the retry
    // For now, just log the scheduling
    console.log(`[PAYMENT RECOVERY] Scheduled retry for ${failureRecordId} at ${retryAt.toISOString()}`);
  }
}