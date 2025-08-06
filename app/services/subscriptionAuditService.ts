/**
 * Subscription Audit Service
 * 
 * Tracks all subscription-related events for audit trail and history
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName } from '../utils/environmentConfig';
import { FieldValue } from 'firebase-admin/firestore';

// Get Firebase Admin instance
const getAdminDb = () => {
  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new Error('Firebase Admin not available');
  }
  return admin.firestore();
};

export interface SubscriptionAuditEvent {
  userId: string;
  eventType: 'subscription_created' | 'subscription_updated' | 'subscription_cancelled' | 'subscription_reactivated' | 'plan_changed' | 'payment_method_updated' | 'payment_failed' | 'payment_recovered';
  description: string;
  entityType: 'subscription';
  entityId?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
  source: 'stripe' | 'system' | 'user';
  correlationId?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

class SubscriptionAuditService {
  /**
   * Log a subscription audit event
   */
  async logEvent(event: SubscriptionAuditEvent): Promise<void> {
    try {
      const auditEvent = {
        ...event,
        timestamp: FieldValue.serverTimestamp(),
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        retentionPeriod: 2555, // 7 years in days for financial records
        regulatoryCategory: 'financial_transaction'
      };

      // Store in audit trail collection
      const db = getAdminDb();
      await db.collection(getCollectionName('auditTrail')).add(auditEvent);

      console.log(`[SUBSCRIPTION AUDIT] ${event.eventType.toUpperCase()}`, {
        userId: event.userId,
        description: event.description,
        source: event.source,
        correlationId: event.correlationId
      });

    } catch (error) {
      console.error('[SUBSCRIPTION AUDIT] Failed to log event:', error);
      // Don't throw error to avoid disrupting the main operation
    }
  }

  /**
   * Log subscription creation
   */
  async logSubscriptionCreated(
    userId: string,
    subscriptionData: Record<string, any>,
    options: {
      source?: 'stripe' | 'system' | 'user';
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'subscription_created',
      description: `Subscription created with amount $${subscriptionData.amount}/month`,
      entityType: 'subscription',
      entityId: subscriptionData.stripeSubscriptionId || subscriptionData.id,
      afterState: subscriptionData,
      metadata: {
        amount: subscriptionData.amount,
        status: subscriptionData.status,
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
        ...options.metadata
      },
      source: options.source || 'system',
      correlationId: options.correlationId,
      severity: 'info'
    });
  }

  /**
   * Log subscription update/change
   */
  async logSubscriptionUpdated(
    userId: string,
    beforeState: Record<string, any>,
    afterState: Record<string, any>,
    options: {
      source?: 'stripe' | 'system' | 'user';
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const oldAmount = beforeState.amount;
    const newAmount = afterState.amount;
    const oldStatus = beforeState.status;
    const newStatus = afterState.status;

    let description = 'Subscription updated';
    let eventType: SubscriptionAuditEvent['eventType'] = 'subscription_updated';

    // Determine specific type of change
    if (oldAmount !== newAmount) {
      if (newAmount > oldAmount) {
        description = `Subscription upgraded from $${oldAmount} to $${newAmount}/month`;
      } else {
        description = `Subscription downgraded from $${oldAmount} to $${newAmount}/month`;
      }
      eventType = 'plan_changed';
    } else if (oldStatus !== newStatus) {
      if (newStatus === 'cancelled') {
        description = 'Subscription cancelled';
        eventType = 'subscription_cancelled';
      } else if (oldStatus === 'cancelled' && newStatus === 'active') {
        description = 'Subscription reactivated';
        eventType = 'subscription_reactivated';
      } else {
        description = `Subscription status changed from ${oldStatus} to ${newStatus}`;
      }
    }

    await this.logEvent({
      userId,
      eventType,
      description,
      entityType: 'subscription',
      entityId: afterState.stripeSubscriptionId || afterState.id,
      beforeState,
      afterState,
      metadata: {
        oldAmount,
        newAmount,
        oldStatus,
        newStatus,
        ...options.metadata
      },
      source: options.source || 'system',
      correlationId: options.correlationId,
      severity: 'info'
    });
  }

  /**
   * Log subscription cancellation
   */
  async logSubscriptionCancelled(
    userId: string,
    subscriptionData: Record<string, any>,
    options: {
      source?: 'stripe' | 'system' | 'user';
      correlationId?: string;
      metadata?: Record<string, any>;
      reason?: string;
    } = {}
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'subscription_cancelled',
      description: `Subscription cancelled${options.reason ? ` (${options.reason})` : ''}`,
      entityType: 'subscription',
      entityId: subscriptionData.stripeSubscriptionId || subscriptionData.id,
      beforeState: subscriptionData,
      afterState: { ...subscriptionData, status: 'cancelled' },
      metadata: {
        amount: subscriptionData.amount,
        cancelReason: options.reason,
        cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
        ...options.metadata
      },
      source: options.source || 'system',
      correlationId: options.correlationId,
      severity: 'info'
    });
  }

  /**
   * Log subscription reactivation
   */
  async logSubscriptionReactivated(
    userId: string,
    subscriptionData: Record<string, any>,
    options: {
      source?: 'stripe' | 'system' | 'user';
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'subscription_reactivated',
      description: `Subscription reactivated with amount $${subscriptionData.amount}/month`,
      entityType: 'subscription',
      entityId: subscriptionData.stripeSubscriptionId || subscriptionData.id,
      afterState: subscriptionData,
      metadata: {
        amount: subscriptionData.amount,
        status: subscriptionData.status,
        ...options.metadata
      },
      source: options.source || 'system',
      correlationId: options.correlationId,
      severity: 'info'
    });
  }

  /**
   * Log payment method update
   */
  async logPaymentMethodUpdated(
    userId: string,
    options: {
      source?: 'stripe' | 'system' | 'user';
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'payment_method_updated',
      description: 'Payment method updated',
      entityType: 'subscription',
      metadata: options.metadata,
      source: options.source || 'system',
      correlationId: options.correlationId,
      severity: 'info'
    });
  }

  /**
   * Log payment failure
   */
  async logPaymentFailed(
    userId: string,
    paymentData: {
      amount: number;
      currency: string;
      invoiceId: string;
      subscriptionId: string;
      failureReason: string;
      failureCount: number;
      failureType?: string;
    },
    options: {
      source?: 'stripe' | 'system' | 'user';
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const severity = paymentData.failureCount >= 3 ? 'critical' :
                    paymentData.failureCount >= 2 ? 'warning' : 'info';

    await this.logEvent({
      userId,
      eventType: 'payment_failed',
      description: `Payment failed: ${paymentData.failureReason} (Attempt ${paymentData.failureCount})`,
      entityType: 'subscription',
      entityId: paymentData.subscriptionId,
      metadata: {
        amount: paymentData.amount,
        currency: paymentData.currency,
        invoiceId: paymentData.invoiceId,
        failureReason: paymentData.failureReason,
        failureCount: paymentData.failureCount,
        failureType: paymentData.failureType,
        ...options.metadata
      },
      source: options.source || 'stripe',
      correlationId: options.correlationId,
      severity
    });
  }

  /**
   * Log payment success after failure
   */
  async logPaymentRecovered(
    userId: string,
    paymentData: {
      amount: number;
      currency: string;
      invoiceId: string;
      subscriptionId: string;
      previousFailureCount: number;
    },
    options: {
      source?: 'stripe' | 'system' | 'user';
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'payment_recovered',
      description: `Payment recovered after ${paymentData.previousFailureCount} failed attempts`,
      entityType: 'subscription',
      entityId: paymentData.subscriptionId,
      metadata: {
        amount: paymentData.amount,
        currency: paymentData.currency,
        invoiceId: paymentData.invoiceId,
        previousFailureCount: paymentData.previousFailureCount,
        ...options.metadata
      },
      source: options.source || 'stripe',
      correlationId: options.correlationId,
      severity: 'info'
    });
  }
}

export const subscriptionAuditService = new SubscriptionAuditService();
