/**
 * Payout Status Tracking Service
 * 
 * Comprehensive tracking of payout status with webhook handling
 * and real-time updates for the fund holding model.
 */

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { stripeTransferService } from './stripeTransferService';
import { earningsHistoryService } from './earningsHistoryService';

export interface PayoutStatus {
  userId: string;
  month: string;
  payoutId: string;
  status: 'scheduled' | 'processing' | 'in_transit' | 'paid' | 'failed' | 'canceled';
  amount: number;
  currency: string;
  timeline: PayoutTimelineEvent[];
  estimatedArrival?: Date;
  actualArrival?: Date;
  failureReason?: string;
  retryCount: number;
  nextRetryDate?: Date;
  metadata: {
    stripeTransferId?: string;
    destinationAccountId?: string;
    createdBy: 'system' | 'admin';
  };
  lastUpdated: Date;
}

export interface PayoutTimelineEvent {
  timestamp: Date;
  status: string;
  description: string;
  source: 'stripe' | 'system' | 'admin';
  metadata?: Record<string, any>;
}

export interface PayoutSummary {
  totalPayouts: number;
  totalAmount: number;
  statusBreakdown: {
    scheduled: number;
    processing: number;
    in_transit: number;
    paid: number;
    failed: number;
    canceled: number;
  };
  averageProcessingTime: number; // in hours
  successRate: number; // percentage
}

export class PayoutStatusTrackingService {
  private static instance: PayoutStatusTrackingService;

  static getInstance(): PayoutStatusTrackingService {
    if (!this.instance) {
      this.instance = new PayoutStatusTrackingService();
    }
    return this.instance;
  }

  /**
   * Create initial payout status record
   */
  async createPayoutStatus(
    userId: string,
    month: string,
    amount: number,
    stripeTransferId?: string,
    destinationAccountId?: string
  ): Promise<{ success: boolean; payoutId?: string; error?: string }> {
    try {
      const payoutId = `payout_${userId}_${month}_${Date.now()}`;
      
      const payoutStatus: PayoutStatus = {
        userId,
        month,
        payoutId,
        status: 'scheduled',
        amount,
        currency: 'usd',
        timeline: [{
          timestamp: new Date(),
          status: 'scheduled',
          description: 'Payout scheduled for processing',
          source: 'system'
        }],
        retryCount: 0,
        metadata: {
          stripeTransferId,
          destinationAccountId,
          createdBy: 'system'
        },
        lastUpdated: new Date()
      };

      await this.savePayoutStatus(payoutStatus);

      console.log(`📊 [PAYOUT STATUS] Created payout status for user ${userId} (${month}): ${payoutId}`);

      return {
        success: true,
        payoutId
      };

    } catch (error) {
      console.error('❌ [PAYOUT STATUS] Error creating payout status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update payout status
   */
  async updatePayoutStatus(
    payoutId: string,
    newStatus: PayoutStatus['status'],
    description?: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payoutStatus = await this.getPayoutStatus(payoutId);
      if (!payoutStatus) {
        return {
          success: false,
          error: 'Payout status not found'
        };
      }

      // Add timeline event
      const timelineEvent: PayoutTimelineEvent = {
        timestamp: new Date(),
        status: newStatus,
        description: description || this.getStatusDescription(newStatus),
        source: 'system',
        metadata
      };

      payoutStatus.status = newStatus;
      payoutStatus.timeline.push(timelineEvent);
      payoutStatus.lastUpdated = new Date();

      // Update specific fields based on status
      if (newStatus === 'paid' && metadata?.actualArrival) {
        payoutStatus.actualArrival = new Date(metadata.actualArrival);
      }

      if (newStatus === 'failed') {
        payoutStatus.failureReason = metadata?.failureReason || 'Unknown failure reason';
        payoutStatus.retryCount += 1;
        payoutStatus.nextRetryDate = this.calculateNextRetryDate(payoutStatus.retryCount);
      }

      await this.savePayoutStatus(payoutStatus);

      // Update earnings history
      await earningsHistoryService.updatePayoutStatus(
        payoutStatus.userId,
        payoutStatus.month,
        {
          status: newStatus === 'paid' ? 'completed' : newStatus === 'failed' ? 'failed' : 'processing',
          processedDate: newStatus === 'paid' ? new Date() : undefined,
          payoutId: payoutStatus.payoutId,
          failureReason: payoutStatus.failureReason
        }
      );

      console.log(`📊 [PAYOUT STATUS] Updated payout ${payoutId}: ${newStatus}`);

      return { success: true };

    } catch (error) {
      console.error('❌ [PAYOUT STATUS] Error updating payout status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle Stripe webhook events for transfer updates
   */
  async handleStripeWebhook(
    eventType: string,
    transferId: string,
    eventData: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔔 [PAYOUT STATUS] Handling Stripe webhook: ${eventType} for transfer ${transferId}`);

      // Find payout status by Stripe transfer ID
      const payoutStatus = await this.getPayoutStatusByTransferId(transferId);
      if (!payoutStatus) {
        console.log(`⚠️ [PAYOUT STATUS] No payout status found for transfer ${transferId}`);
        return { success: true }; // Not an error, just no matching payout
      }

      let newStatus: PayoutStatus['status'];
      let description: string;
      let metadata: Record<string, any> = {};

      switch (eventType) {
        case 'transfer.created':
          newStatus = 'processing';
          description = 'Transfer created in Stripe';
          break;

        case 'transfer.paid':
          newStatus = 'in_transit';
          description = 'Transfer sent to destination bank';
          metadata.paidAt = new Date(eventData.created * 1000);
          break;

        case 'transfer.failed':
          newStatus = 'failed';
          description = 'Transfer failed';
          metadata.failureReason = eventData.failure_message || 'Transfer failed';
          metadata.failureCode = eventData.failure_code;
          break;

        case 'transfer.reversed':
          newStatus = 'canceled';
          description = 'Transfer was reversed';
          metadata.reversalReason = eventData.reversal?.reason || 'Transfer reversed';
          break;

        default:
          console.log(`⚠️ [PAYOUT STATUS] Unhandled webhook event type: ${eventType}`);
          return { success: true };
      }

      await this.updatePayoutStatus(payoutStatus.payoutId, newStatus, description, metadata);

      return { success: true };

    } catch (error) {
      console.error('❌ [PAYOUT STATUS] Error handling Stripe webhook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get payout status by ID
   */
  async getPayoutStatus(payoutId: string): Promise<PayoutStatus | null> {
    try {
      const statusDoc = await getDoc(doc(db, getCollectionName('payoutStatus'), payoutId));
      
      if (!statusDoc.exists()) {
        return null;
      }

      const data = statusDoc.data();
      return {
        ...data,
        timeline: data.timeline?.map((event: any) => ({
          ...event,
          timestamp: event.timestamp?.toDate() || new Date()
        })) || [],
        estimatedArrival: data.estimatedArrival?.toDate(),
        actualArrival: data.actualArrival?.toDate(),
        nextRetryDate: data.nextRetryDate?.toDate(),
        lastUpdated: data.lastUpdated?.toDate() || new Date()
      } as PayoutStatus;

    } catch (error) {
      console.error('❌ [PAYOUT STATUS] Error getting payout status:', error);
      return null;
    }
  }

  /**
   * Get payout status for a user and month
   */
  async getUserPayoutStatus(userId: string, month: string): Promise<PayoutStatus | null> {
    try {
      const statusQuery = query(
        collection(db, getCollectionName('payoutStatus')),
        where('userId', '==', userId),
        where('month', '==', month),
        orderBy('lastUpdated', 'desc'),
        limit(1)
      );

      const statusSnapshot = await getDocs(statusQuery);
      
      if (statusSnapshot.empty) {
        return null;
      }

      const data = statusSnapshot.docs[0].data();
      return {
        ...data,
        timeline: data.timeline?.map((event: any) => ({
          ...event,
          timestamp: event.timestamp?.toDate() || new Date()
        })) || [],
        estimatedArrival: data.estimatedArrival?.toDate(),
        actualArrival: data.actualArrival?.toDate(),
        nextRetryDate: data.nextRetryDate?.toDate(),
        lastUpdated: data.lastUpdated?.toDate() || new Date()
      } as PayoutStatus;

    } catch (error) {
      console.error('❌ [PAYOUT STATUS] Error getting user payout status:', error);
      return null;
    }
  }

  /**
   * Get payout summary for a month
   */
  async getMonthlyPayoutSummary(month: string): Promise<PayoutSummary | null> {
    try {
      const statusQuery = query(
        collection(db, getCollectionName('payoutStatus')),
        where('month', '==', month)
      );

      const statusSnapshot = await getDocs(statusQuery);
      
      if (statusSnapshot.empty) {
        return null;
      }

      const payouts: PayoutStatus[] = [];
      for (const doc of statusSnapshot.docs) {
        const data = doc.data();
        payouts.push({
          ...data,
          timeline: data.timeline?.map((event: any) => ({
            ...event,
            timestamp: event.timestamp?.toDate() || new Date()
          })) || [],
          lastUpdated: data.lastUpdated?.toDate() || new Date()
        } as PayoutStatus);
      }

      // Calculate summary statistics
      const totalPayouts = payouts.length;
      const totalAmount = payouts.reduce((sum, payout) => sum + payout.amount, 0);

      const statusBreakdown = {
        scheduled: payouts.filter(p => p.status === 'scheduled').length,
        processing: payouts.filter(p => p.status === 'processing').length,
        in_transit: payouts.filter(p => p.status === 'in_transit').length,
        paid: payouts.filter(p => p.status === 'paid').length,
        failed: payouts.filter(p => p.status === 'failed').length,
        canceled: payouts.filter(p => p.status === 'canceled').length
      };

      const successfulPayouts = statusBreakdown.paid;
      const successRate = totalPayouts > 0 ? (successfulPayouts / totalPayouts) * 100 : 0;

      // Calculate average processing time for completed payouts
      const completedPayouts = payouts.filter(p => p.status === 'paid' && p.actualArrival);
      const averageProcessingTime = completedPayouts.length > 0
        ? completedPayouts.reduce((sum, payout) => {
            const created = payout.timeline[0]?.timestamp || new Date();
            const completed = payout.actualArrival || new Date();
            return sum + (completed.getTime() - created.getTime());
          }, 0) / completedPayouts.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      return {
        totalPayouts,
        totalAmount,
        statusBreakdown,
        averageProcessingTime,
        successRate
      };

    } catch (error) {
      console.error('❌ [PAYOUT STATUS] Error getting monthly payout summary:', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */
  private async getPayoutStatusByTransferId(transferId: string): Promise<PayoutStatus | null> {
    try {
      const statusQuery = query(
        collection(db, getCollectionName('payoutStatus')),
        where('metadata.stripeTransferId', '==', transferId),
        limit(1)
      );

      const statusSnapshot = await getDocs(statusQuery);
      
      if (statusSnapshot.empty) {
        return null;
      }

      const data = statusSnapshot.docs[0].data();
      return {
        ...data,
        timeline: data.timeline?.map((event: any) => ({
          ...event,
          timestamp: event.timestamp?.toDate() || new Date()
        })) || [],
        lastUpdated: data.lastUpdated?.toDate() || new Date()
      } as PayoutStatus;

    } catch (error) {
      console.error('❌ [PAYOUT STATUS] Error getting payout status by transfer ID:', error);
      return null;
    }
  }

  private getStatusDescription(status: PayoutStatus['status']): string {
    const descriptions = {
      scheduled: 'Payout scheduled for processing',
      processing: 'Payout is being processed',
      in_transit: 'Payout sent to your bank account',
      paid: 'Payout completed successfully',
      failed: 'Payout failed to process',
      canceled: 'Payout was canceled'
    };

    return descriptions[status] || 'Status updated';
  }

  private calculateNextRetryDate(retryCount: number): Date {
    // Exponential backoff: 1 day, 3 days, 7 days, then weekly
    const daysToAdd = Math.min(Math.pow(2, retryCount - 1), 7);
    const nextRetry = new Date();
    nextRetry.setDate(nextRetry.getDate() + daysToAdd);
    return nextRetry;
  }

  private async savePayoutStatus(status: PayoutStatus): Promise<void> {
    await setDoc(doc(db, getCollectionName('payoutStatus'), status.payoutId), {
      ...status,
      timeline: status.timeline.map(event => ({
        ...event,
        timestamp: serverTimestamp()
      })),
      estimatedArrival: status.estimatedArrival ? serverTimestamp() : null,
      actualArrival: status.actualArrival ? serverTimestamp() : null,
      nextRetryDate: status.nextRetryDate ? serverTimestamp() : null,
      lastUpdated: serverTimestamp()
    });
  }
}

export const payoutStatusTrackingService = PayoutStatusTrackingService.getInstance();
