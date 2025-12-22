/**
 * Payout Status Service
 * 
 * Centralized service for managing payout status transitions and ensuring
 * database consistency throughout the payout lifecycle.
 */

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { FinancialLogger } from '../types/financial';
import { payoutNotificationService } from './payoutNotificationService';
import type { Payout, PayoutRecipient } from '../types/payout';

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface StatusTransition {
  from: PayoutStatus;
  to: PayoutStatus;
  timestamp: Timestamp;
  reason?: string;
  metadata?: any;
}

export interface PayoutStatusUpdate {
  payoutId: string;
  status: PayoutStatus;
  reason?: string;
  metadata?: any;
  stripeTransferId?: string;
  updateRecipientBalance?: boolean;
}

export class PayoutStatusService {
  private static instance: PayoutStatusService;

  static getInstance(): PayoutStatusService {
    if (!PayoutStatusService.instance) {
      PayoutStatusService.instance = new PayoutStatusService();
    }
    return PayoutStatusService.instance;
  }

  /**
   * Update payout status with full consistency checks
   */
  async updatePayoutStatus(update: PayoutStatusUpdate): Promise<{ success: boolean; error?: string }> {
    try {

      // Get current payout data
      const payoutDoc = await getDoc(doc(db, getCollectionName('payouts'), update.payoutId));
      if (!payoutDoc.exists()) {
        throw new Error(`Payout ${update.payoutId} not found`);
      }

      const payout = payoutDoc.data() as Payout;
      const previousStatus = payout.status;

      // Validate status transition
      const isValidTransition = this.isValidStatusTransition(previousStatus, update.status);
      if (!isValidTransition) {
        throw new Error(`Invalid status transition from ${previousStatus} to ${update.status}`);
      }

      // Use batch for atomic updates
      const batch = writeBatch(db);

      // Prepare payout update
      const payoutUpdate: any = {
        status: update.status,
        updatedAt: serverTimestamp()
      };

      // Add status-specific fields
      switch (update.status) {
        case 'processing':
          payoutUpdate.processedAt = serverTimestamp();
          if (update.stripeTransferId) {
            payoutUpdate.stripeTransferId = update.stripeTransferId;
          }
          break;

        case 'completed':
          payoutUpdate.completedAt = serverTimestamp();
          break;

        case 'failed':
          payoutUpdate.failureReason = update.reason || 'Unknown failure';
          payoutUpdate.retryCount = increment(1);
          break;

        case 'cancelled':
          payoutUpdate.cancelledAt = serverTimestamp();
          payoutUpdate.cancellationReason = update.reason || 'Manual cancellation';
          break;
      }

      // Add metadata if provided
      if (update.metadata) {
        payoutUpdate.metadata = {
          ...payout.metadata,
          ...update.metadata
        };
      }

      // Add status transition history
      const transition: StatusTransition = {
        from: previousStatus,
        to: update.status,
        timestamp: serverTimestamp() as any,
        reason: update.reason,
        metadata: update.metadata
      };

      payoutUpdate.statusHistory = [
        ...(payout.statusHistory || []),
        transition
      ];

      // Update payout document
      batch.update(doc(db, getCollectionName('payouts'), update.payoutId), payoutUpdate);

      // Update recipient balance if needed
      if (update.updateRecipientBalance) {
        await this.updateRecipientBalance(batch, payout, previousStatus, update.status);
      }

      // Commit all updates atomically
      await batch.commit();

      // Log the status change
      FinancialLogger.logOperation('PAYOUT_STATUS_UPDATED', {
        payoutId: update.payoutId,
        previousStatus,
        newStatus: update.status,
        reason: update.reason,
        metadata: update.metadata
      });

      // Send notification for status change
      await this.sendStatusChangeNotification(update.payoutId, update.status, previousStatus);

      return { success: true };

    } catch (error) {
      console.error(`Error updating payout status:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate if a status transition is allowed
   */
  private isValidStatusTransition(from: PayoutStatus, to: PayoutStatus): boolean {
    const validTransitions: Record<PayoutStatus, PayoutStatus[]> = {
      'pending': ['processing', 'cancelled'],
      'processing': ['completed', 'failed', 'cancelled'],
      'completed': [], // Terminal state
      'failed': ['processing', 'cancelled'], // Can retry
      'cancelled': [] // Terminal state
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Update recipient balance based on status transition
   */
  private async updateRecipientBalance(
    batch: any,
    payout: Payout,
    previousStatus: PayoutStatus,
    newStatus: PayoutStatus
  ): Promise<void> {
    const recipientRef = doc(db, getCollectionName('payoutRecipients'), payout.recipientId);

    switch (newStatus) {
      case 'processing':
        if (previousStatus === 'pending') {
          // Move from available to pending
          batch.update(recipientRef, {
            availableBalance: increment(-payout.amount),
            pendingBalance: increment(payout.amount),
            lastPayoutAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
        break;

      case 'completed':
        if (previousStatus === 'processing') {
          // Remove from pending (already moved from available)
          batch.update(recipientRef, {
            pendingBalance: increment(-payout.amount),
            updatedAt: serverTimestamp()
          });
        }
        break;

      case 'failed':
      case 'cancelled':
        if (previousStatus === 'processing') {
          // Restore to available balance
          batch.update(recipientRef, {
            availableBalance: increment(payout.amount),
            pendingBalance: increment(-payout.amount),
            updatedAt: serverTimestamp()
          });
        }
        break;
    }
  }

  /**
   * Get payout status with full history
   */
  async getPayoutStatus(payoutId: string): Promise<{
    success: boolean;
    data?: {
      payout: Payout;
      currentStatus: PayoutStatus;
      statusHistory: StatusTransition[];
    };
    error?: string;
  }> {
    try {
      const payoutDoc = await getDoc(doc(db, getCollectionName('payouts'), payoutId));
      if (!payoutDoc.exists()) {
        return { success: false, error: 'Payout not found' };
      }

      const payout = payoutDoc.data() as Payout;
      return {
        success: true,
        data: {
          payout,
          currentStatus: payout.status,
          statusHistory: payout.statusHistory || []
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Bulk status update for multiple payouts
   */
  async bulkUpdateStatus(updates: PayoutStatusUpdate[]): Promise<{
    success: boolean;
    results: Array<{ payoutId: string; success: boolean; error?: string }>;
  }> {
    const results = [];

    for (const update of updates) {
      const result = await this.updatePayoutStatus(update);
      results.push({
        payoutId: update.payoutId,
        success: result.success,
        error: result.error
      });
    }

    const successCount = results.filter(r => r.success).length;
    const overallSuccess = successCount === results.length;

    return {
      success: overallSuccess,
      results
    };
  }

  /**
   * Check for stuck payouts and alert
   */
  async checkStuckPayouts(): Promise<{
    success: boolean;
    stuckPayouts: Array<{ payoutId: string; status: PayoutStatus; stuckDuration: number }>;
  }> {
    try {
      // Implementation would query for payouts that have been in processing state too long
      // This is a placeholder for the monitoring functionality
      return {
        success: true,
        stuckPayouts: []
      };
    } catch (error) {
      console.error('Error checking stuck payouts:', error);
      return {
        success: false,
        stuckPayouts: []
      };
    }
  }

  /**
   * Send notification for status change
   */
  private async sendStatusChangeNotification(
    payoutId: string,
    newStatus: PayoutStatus,
    previousStatus: PayoutStatus
  ): Promise<void> {
    try {
      // Map status to notification type
      let notificationType: string | null = null;

      switch (newStatus) {
        case 'processing':
          if (previousStatus === 'pending') {
            notificationType = 'payout_initiated';
          } else {
            notificationType = 'payout_processing';
          }
          break;
        case 'completed':
          notificationType = 'payout_completed';
          break;
        case 'failed':
          notificationType = 'payout_failed';
          break;
        case 'cancelled':
          notificationType = 'payout_cancelled';
          break;
      }

      if (notificationType) {
        await payoutNotificationService.sendPayoutNotification(
          payoutId,
          notificationType as any,
          ['email', 'in_app'] // Send both email and in-app notifications
        );
      }
    } catch (error) {
      console.error(`Error sending notification for payout ${payoutId}:`, error);
      // Don't throw error - notification failure shouldn't break status update
    }
  }
}

export const payoutStatusService = PayoutStatusService.getInstance();
