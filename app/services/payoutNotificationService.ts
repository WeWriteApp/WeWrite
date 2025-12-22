/**
 * Payout Notification Service
 * 
 * Handles all notifications related to payout status changes including
 * email notifications, in-app notifications, and push notifications.
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
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getCollectionName, USD_COLLECTIONS } from '../utils/environmentConfig';
import { FinancialLogger } from '../types/financial';
import type { Payout, PayoutRecipient } from '../types/payout';

export type NotificationType = 
  | 'payout_initiated'
  | 'payout_processing'
  | 'payout_completed'
  | 'payout_failed'
  | 'payout_retry_scheduled'
  | 'payout_cancelled';

export interface NotificationTemplate {
  type: NotificationType;
  subject: string;
  emailTemplate: string;
  inAppTitle: string;
  inAppMessage: string;
  pushTitle?: string;
  pushMessage?: string;
}

export interface PayoutNotification {
  id: string;
  userId: string;
  payoutId: string;
  type: NotificationType;
  status: 'pending' | 'sent' | 'failed';
  channels: ('email' | 'in_app' | 'push')[];
  data: {
    amount: number;
    currency: string;
    failureReason?: string;
    nextRetryAt?: string;
    estimatedArrival?: string;
  };
  createdAt: Timestamp;
  sentAt?: Timestamp;
  error?: string;
}

export class PayoutNotificationService {
  private static instance: PayoutNotificationService;
  private templates: Map<NotificationType, NotificationTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  static getInstance(): PayoutNotificationService {
    if (!PayoutNotificationService.instance) {
      PayoutNotificationService.instance = new PayoutNotificationService();
    }
    return PayoutNotificationService.instance;
  }

  /**
   * Initialize notification templates
   */
  private initializeTemplates(): void {
    this.templates.set('payout_initiated', {
      type: 'payout_initiated',
      subject: 'Your payout has been initiated',
      emailTemplate: `
        <h2>Payout Initiated</h2>
        <p>Your payout of {{amount}} has been initiated and is being processed.</p>
        <p><strong>Amount:</strong> {{amount}}</p>
        <p><strong>Estimated arrival:</strong> {{estimatedArrival}}</p>
        <p>You'll receive another notification when the payout is completed.</p>
      `,
      inAppTitle: 'Payout Initiated',
      inAppMessage: 'Your payout of {{amount}} is being processed',
      pushTitle: 'Payout Started',
      pushMessage: 'Your {{amount}} payout is on its way'
    });

    this.templates.set('payout_processing', {
      type: 'payout_processing',
      subject: 'Your payout is being processed',
      emailTemplate: `
        <h2>Payout Processing</h2>
        <p>Your payout of {{amount}} is currently being processed by our payment provider.</p>
        <p><strong>Amount:</strong> {{amount}}</p>
        <p><strong>Status:</strong> Processing</p>
        <p>This typically takes 1-3 business days to complete.</p>
      `,
      inAppTitle: 'Payout Processing',
      inAppMessage: 'Your {{amount}} payout is being processed',
      pushTitle: 'Payout Processing',
      pushMessage: 'Your {{amount}} payout is being processed'
    });

    this.templates.set('payout_completed', {
      type: 'payout_completed',
      subject: 'Your payout has been completed',
      emailTemplate: `
        <h2>Payout Completed</h2>
        <p>Great news! Your payout of {{amount}} has been successfully completed.</p>
        <p><strong>Amount:</strong> {{amount}}</p>
        <p><strong>Status:</strong> Completed</p>
        <p>The funds should appear in your bank account within 1-2 business days.</p>
      `,
      inAppTitle: 'Payout Completed',
      inAppMessage: 'Your {{amount}} payout has been completed successfully',
      pushTitle: 'Payout Complete!',
      pushMessage: 'Your {{amount}} payout is on its way to your bank'
    });

    this.templates.set('payout_failed', {
      type: 'payout_failed',
      subject: 'Your payout has failed',
      emailTemplate: `
        <h2>Payout Failed</h2>
        <p>Unfortunately, your payout of {{amount}} has failed.</p>
        <p><strong>Amount:</strong> {{amount}}</p>
        <p><strong>Reason:</strong> {{failureReason}}</p>
        <p>The funds have been returned to your available balance. Please check your account settings and try again.</p>
      `,
      inAppTitle: 'Payout Failed',
      inAppMessage: 'Your {{amount}} payout failed: {{failureReason}}',
      pushTitle: 'Payout Failed',
      pushMessage: 'Your {{amount}} payout failed - please check your account'
    });

    this.templates.set('payout_retry_scheduled', {
      type: 'payout_retry_scheduled',
      subject: 'Your payout will be retried',
      emailTemplate: `
        <h2>Payout Retry Scheduled</h2>
        <p>Your payout of {{amount}} will be automatically retried.</p>
        <p><strong>Amount:</strong> {{amount}}</p>
        <p><strong>Next retry:</strong> {{nextRetryAt}}</p>
        <p>We'll notify you when the retry is processed.</p>
      `,
      inAppTitle: 'Payout Retry Scheduled',
      inAppMessage: 'Your {{amount}} payout will be retried on {{nextRetryAt}}',
      pushTitle: 'Payout Retry',
      pushMessage: 'Your {{amount}} payout will be retried automatically'
    });

    this.templates.set('payout_cancelled', {
      type: 'payout_cancelled',
      subject: 'Your payout has been cancelled',
      emailTemplate: `
        <h2>Payout Cancelled</h2>
        <p>Your payout of {{amount}} has been cancelled.</p>
        <p><strong>Amount:</strong> {{amount}}</p>
        <p>The funds have been returned to your available balance.</p>
      `,
      inAppTitle: 'Payout Cancelled',
      inAppMessage: 'Your {{amount}} payout has been cancelled',
      pushTitle: 'Payout Cancelled',
      pushMessage: 'Your {{amount}} payout has been cancelled'
    });
  }

  /**
   * Send notification for payout status change
   */
  async sendPayoutNotification(
    payoutId: string,
    type: NotificationType,
    channels: ('email' | 'in_app' | 'push')[] = ['email', 'in_app']
  ): Promise<{ success: boolean; error?: string }> {
    try {

      // Get payout data
      const payoutDoc = await getDoc(doc(db, getCollectionName('payouts'), payoutId));
      if (!payoutDoc.exists()) {
        throw new Error(`Payout ${payoutId} not found`);
      }

      const payout = payoutDoc.data() as Payout;

      // Get recipient data
      const recipientDoc = await getDoc(doc(db, getCollectionName(USD_COLLECTIONS.PAYOUT_RECIPIENTS), payout.recipientId));
      if (!recipientDoc.exists()) {
        throw new Error(`Recipient ${payout.recipientId} not found`);
      }

      const recipient = recipientDoc.data() as PayoutRecipient;

      // Create notification record
      const notificationId = `${payoutId}_${type}_${Date.now()}`;
      const notification: PayoutNotification = {
        id: notificationId,
        userId: recipient.userId,
        payoutId,
        type,
        status: 'pending',
        channels,
        data: {
          amount: payout.amount,
          currency: payout.currency,
          failureReason: payout.failureReason,
          nextRetryAt: payout.nextRetryAt?.toDate().toISOString(),
          estimatedArrival: this.calculateEstimatedArrival(payout)
        },
        createdAt: serverTimestamp() as any
      };

      // Save notification record
      await setDoc(doc(db, getCollectionName('notifications'), notificationId), notification);

      // Send notifications on each channel
      const results = await Promise.allSettled([
        channels.includes('email') ? this.sendEmailNotification(notification) : Promise.resolve(true),
        channels.includes('in_app') ? this.sendInAppNotification(notification) : Promise.resolve(true),
        channels.includes('push') ? this.sendPushNotification(notification) : Promise.resolve(true)
      ]);

      // Check if any notifications failed
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn(`Some notifications failed for payout ${payoutId}:`, failures);
      }

      // Update notification status
      await updateDoc(doc(db, getCollectionName('notifications'), notificationId), {
        status: failures.length === results.length ? 'failed' : 'sent',
        sentAt: serverTimestamp(),
        error: failures.length > 0 ? `${failures.length} channels failed` : undefined
      });

      // Log notification
      FinancialLogger.logOperation('PAYOUT_NOTIFICATION_SENT', {
        payoutId,
        type,
        channels,
        userId: recipient.userId,
        success: failures.length < results.length
      });

      return { success: failures.length < results.length };

    } catch (error) {
      console.error(`Error sending payout notification:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: PayoutNotification): Promise<boolean> {
    try {
      const template = this.templates.get(notification.type);
      if (!template) {
        throw new Error(`No template found for ${notification.type}`);
      }

      // Replace template variables
      const subject = this.replaceTemplateVariables(template.subject, notification.data);
      const body = this.replaceTemplateVariables(template.emailTemplate, notification.data);

      // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
      // For now, just log the email content
      // In production, you would send via your email service
      
      return true;
    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(notification: PayoutNotification): Promise<boolean> {
    try {
      const template = this.templates.get(notification.type);
      if (!template) {
        throw new Error(`No template found for ${notification.type}`);
      }

      // Create in-app notification
      const inAppNotification = {
        id: `${notification.id}_in_app`,
        userId: notification.userId,
        type: 'payout_update',
        title: this.replaceTemplateVariables(template.inAppTitle, notification.data),
        message: this.replaceTemplateVariables(template.inAppMessage, notification.data),
        data: {
          payoutId: notification.payoutId,
          payoutType: notification.type
        },
        read: false,
        createdAt: serverTimestamp()
      };

      // Save to notifications collection
      await setDoc(
        doc(db, getCollectionName('userNotifications'), inAppNotification.id),
        inAppNotification
      );

      return true;
    } catch (error) {
      console.error('Error sending in-app notification:', error);
      return false;
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: PayoutNotification): Promise<boolean> {
    try {
      const template = this.templates.get(notification.type);
      if (!template || !template.pushTitle) {
        return true; // Skip if no push template
      }

      // TODO: Integrate with push notification service (FCM, APNs, etc.)
      // For now, just log the push notification
      // In production, you would send via FCM/APNs
      
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Replace template variables with actual values
   */
  private replaceTemplateVariables(template: string, data: any): string {
    let result = template;
    
    // Format amount as currency
    if (data.amount) {
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: data.currency || 'USD'
      }).format(data.amount);
      result = result.replace(/\{\{amount\}\}/g, formattedAmount);
    }

    // Format dates
    if (data.nextRetryAt) {
      const retryDate = new Date(data.nextRetryAt).toLocaleDateString();
      result = result.replace(/\{\{nextRetryAt\}\}/g, retryDate);
    }

    if (data.estimatedArrival) {
      result = result.replace(/\{\{estimatedArrival\}\}/g, data.estimatedArrival);
    }

    // Replace other variables
    if (data.failureReason) {
      result = result.replace(/\{\{failureReason\}\}/g, data.failureReason);
    }

    return result;
  }

  /**
   * Calculate estimated arrival time for payout
   */
  private calculateEstimatedArrival(payout: Payout): string {
    // Standard ACH transfer takes 1-3 business days
    const businessDays = 2; // Conservative estimate
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + businessDays);
    
    return estimatedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

export const payoutNotificationService = PayoutNotificationService.getInstance();
