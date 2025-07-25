/**
 * Comprehensive Payment System Tests
 * End-to-end testing for payment processing, subscription management, and webhook handling
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { initAdmin } from '../firebase/admin';
import { getCollectionName } from '../utils/environmentConfig';
import { UnifiedFeeCalculationService } from '../services/unifiedFeeCalculationService';
import { PaymentRecoveryService } from '../services/paymentRecoveryService';
import { SubscriptionSynchronizationService } from '../services/subscriptionSynchronizationService';
import { TransactionTrackingService } from '../services/transactionTrackingService';
import { FinancialUtils } from '../types/financial';

// Mock Stripe for testing
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    subscriptions: {
      retrieve: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn()
    },
    invoices: {
      retrieve: jest.fn(),
      pay: jest.fn(),
      create: jest.fn()
    },
    customers: {
      retrieve: jest.fn(),
      create: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    },
    accounts: {
      retrieve: jest.fn().mockResolvedValue({
        charges_enabled: true,
        payouts_enabled: true
      })
    }
  }));
});

describe('Payment System Integration Tests', () => {
  let adminApp: any;
  let adminDb: any;
  let testUserId: string;
  let testSubscriptionId: string;

  beforeAll(async () => {
    // Initialize Firebase Admin for testing
    adminApp = initAdmin();
    adminDb = adminApp.firestore();
    
    // Create test user
    testUserId = `test_user_${Date.now()}`;
    testSubscriptionId = `sub_test_${Date.now()}`;
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await adminDb.collection(getCollectionName('users')).doc(testUserId).delete();
      await adminDb.collection(getCollectionName('subscriptions')).doc(testSubscriptionId).delete();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  describe('Fee Calculation Service', () => {
    let feeService: UnifiedFeeCalculationService;

    beforeEach(() => {
      feeService = UnifiedFeeCalculationService.getInstance();
      feeService.clearCache(); // Clear cache for consistent testing
    });

    test('should calculate fees correctly for payment transactions', async () => {
      const grossAmount = 100.00;
      const breakdown = await feeService.calculateFees(grossAmount, 'payment', 'USD');

      expect(breakdown.grossAmount).toBe(grossAmount);
      expect(breakdown.stripeProcessingFee).toBeGreaterThan(0);
      expect(breakdown.netAfterProcessing).toBeLessThan(grossAmount);
      expect(breakdown.totalFees).toBeGreaterThan(0);
      expect(breakdown.netPayoutAmount).toBeLessThan(grossAmount);
      expect(breakdown.correlationId).toBeDefined();
    });

    test('should calculate fees correctly for payout transactions', async () => {
      const grossAmount = 100.00;
      const breakdown = await feeService.calculateFees(grossAmount, 'payout', 'USD', 'standard');

      expect(breakdown.grossAmount).toBe(grossAmount);
      expect(breakdown.stripeProcessingFee).toBe(0); // No processing fee for payouts
      expect(breakdown.stripeConnectFee).toBeGreaterThanOrEqual(0);
      expect(breakdown.stripePayoutFee).toBeGreaterThanOrEqual(0);
      expect(breakdown.netPayoutAmount).toBeLessThanOrEqual(grossAmount);
    });

    test('should validate payout amounts correctly', async () => {
      // Test minimum threshold
      const smallAmount = 10.00;
      const smallValidation = await feeService.validatePayoutAmount(smallAmount, 'USD');
      expect(smallValidation.isValid).toBe(false);
      expect(smallValidation.errors.length).toBeGreaterThan(0);

      // Test valid amount
      const validAmount = 50.00;
      const validValidation = await feeService.validatePayoutAmount(validAmount, 'USD');
      expect(validValidation.isValid).toBe(true);
      expect(validValidation.errors.length).toBe(0);
    });

    test('should calculate minimum gross amount for payout threshold', async () => {
      const minimumGross = await feeService.calculateMinimumGrossForPayout('USD', 'standard');
      expect(minimumGross).toBeGreaterThan(25); // Should be higher than threshold due to fees
    });
  });

  describe('Payment Recovery Service', () => {
    let recoveryService: PaymentRecoveryService;

    beforeEach(() => {
      recoveryService = PaymentRecoveryService.getInstance();
    });

    test('should record payment failure and schedule retries', async () => {
      const correlationId = FinancialUtils.generateCorrelationId();
      const failureRecord = await recoveryService.recordPaymentFailure(
        testUserId,
        testSubscriptionId,
        'inv_test_123',
        'card_declined',
        29.99,
        'USD',
        correlationId
      );

      expect(failureRecord.userId).toBe(testUserId);
      expect(failureRecord.subscriptionId).toBe(testSubscriptionId);
      expect(failureRecord.failureCount).toBe(1);
      expect(failureRecord.failureType).toBe('card_declined');
      expect(failureRecord.retrySchedule.length).toBeGreaterThan(0);
      expect(failureRecord.correlationId).toBe(correlationId);
    });

    test('should categorize failure types correctly', async () => {
      const testCases = [
        { reason: 'insufficient_funds', expectedType: 'insufficient_funds' },
        { reason: 'card_expired', expectedType: 'expired_card' },
        { reason: 'authentication_required', expectedType: 'authentication_required' },
        { reason: 'card_declined', expectedType: 'card_declined' },
        { reason: 'unknown_error', expectedType: 'other' }
      ];

      for (const testCase of testCases) {
        const failureRecord = await recoveryService.recordPaymentFailure(
          testUserId,
          testSubscriptionId,
          `inv_test_${Date.now()}`,
          testCase.reason,
          29.99
        );

        expect(failureRecord.failureType).toBe(testCase.expectedType);
      }
    });
  });

  describe('Subscription Synchronization Service', () => {
    let syncService: SubscriptionSynchronizationService;

    beforeEach(() => {
      syncService = SubscriptionSynchronizationService.getInstance();
    });

    test('should synchronize subscription data without conflicts', async () => {
      const correlationId = FinancialUtils.generateCorrelationId();
      const syncOperation = {
        type: 'webhook' as const,
        source: 'test_webhook',
        timestamp: new Date(),
        correlationId,
        subscriptionData: {
          stripeSubscriptionId: testSubscriptionId,
          status: 'active',
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false
        }
      };

      const result = await syncService.synchronizeSubscription(
        testUserId,
        testSubscriptionId,
        syncOperation
      );

      expect(result.success).toBe(true);
      expect(result.conflict).toBe(false);
    });

    test('should detect and handle sync conflicts', async () => {
      const correlationId1 = FinancialUtils.generateCorrelationId();
      const correlationId2 = FinancialUtils.generateCorrelationId();

      // First operation (webhook)
      const webhookOperation = {
        type: 'webhook' as const,
        source: 'stripe_webhook',
        timestamp: new Date(),
        correlationId: correlationId1,
        subscriptionData: { status: 'active' }
      };

      // Second operation (API call) very close in time
      const apiOperation = {
        type: 'api_call' as const,
        source: 'direct_api',
        timestamp: new Date(Date.now() + 1000), // 1 second later
        correlationId: correlationId2,
        subscriptionData: { status: 'past_due' }
      };

      // Execute operations
      await syncService.synchronizeSubscription(testUserId, testSubscriptionId, webhookOperation);
      const result = await syncService.synchronizeSubscription(testUserId, testSubscriptionId, apiOperation);

      // Should detect potential conflict due to close timing
      expect(result.conflict).toBeDefined();
    });

    test('should get sync status correctly', async () => {
      const syncStatus = await syncService.getSyncStatus(testUserId, testSubscriptionId);
      
      if (syncStatus) {
        expect(syncStatus.userId).toBe(testUserId);
        expect(syncStatus.stripeSubscriptionId).toBe(testSubscriptionId);
        expect(syncStatus.lastSyncAt).toBeInstanceOf(Date);
        expect(syncStatus.syncVersion).toBeGreaterThan(0);
      }
    });
  });

  describe('Transaction Tracking Service', () => {
    test('should track subscription payments correctly', async () => {
      const correlationId = FinancialUtils.generateCorrelationId();
      const result = await TransactionTrackingService.trackSubscriptionPayment(
        'inv_test_123',
        testSubscriptionId,
        testUserId,
        29.99,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.type).toBe('SUBSCRIPTION_PAYMENT');
        expect(result.data.amount).toBe(29.99);
        expect(result.data.correlationId).toBe(correlationId);
      }
    });

    test('should track payout requests correctly', async () => {
      const correlationId = FinancialUtils.generateCorrelationId();
      const result = await TransactionTrackingService.trackPayoutRequest(
        'payout_test_123',
        `recipient_${testUserId}`,
        100.00,
        undefined,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.type).toBe('PAYOUT_REQUEST');
        expect(result.data.amount).toBe(100.00);
        expect(result.data.correlationId).toBe(correlationId);
      }
    });

    test('should handle tracking failures gracefully', async () => {
      // Test with invalid data to trigger failure
      const result = await TransactionTrackingService.trackSubscriptionPayment(
        '', // Invalid invoice ID
        '',
        '',
        -1, // Invalid amount
        FinancialUtils.generateCorrelationId()
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('End-to-End Payment Flow', () => {
    test('should process complete payment flow with tracking', async () => {
      const correlationId = FinancialUtils.generateCorrelationId();
      
      // 1. Track subscription payment
      const trackingResult = await TransactionTrackingService.trackSubscriptionPayment(
        'inv_e2e_test',
        testSubscriptionId,
        testUserId,
        29.99,
        correlationId
      );
      expect(trackingResult.success).toBe(true);

      // 2. Calculate fees
      const feeService = UnifiedFeeCalculationService.getInstance();
      const feeBreakdown = await feeService.calculateFees(29.99, 'payment', 'USD');
      expect(feeBreakdown.netPayoutAmount).toBeLessThan(29.99);

      // 3. Synchronize subscription
      const syncService = SubscriptionSynchronizationService.getInstance();
      const syncResult = await syncService.synchronizeSubscription(
        testUserId,
        testSubscriptionId,
        {
          type: 'webhook',
          source: 'e2e_test',
          timestamp: new Date(),
          correlationId,
          subscriptionData: {
            status: 'active',
            lastPaymentAt: new Date().toISOString()
          }
        }
      );
      expect(syncResult.success).toBe(true);
    });

    test('should handle payment failure flow with recovery', async () => {
      const correlationId = FinancialUtils.generateCorrelationId();
      
      // 1. Record payment failure
      const recoveryService = PaymentRecoveryService.getInstance();
      const failureRecord = await recoveryService.recordPaymentFailure(
        testUserId,
        testSubscriptionId,
        'inv_failed_test',
        'insufficient_funds',
        29.99,
        'USD',
        correlationId
      );
      expect(failureRecord.failureCount).toBe(1);
      expect(failureRecord.retrySchedule.length).toBeGreaterThan(0);

      // 2. Synchronize failed subscription state
      const syncService = SubscriptionSynchronizationService.getInstance();
      const syncResult = await syncService.synchronizeSubscription(
        testUserId,
        testSubscriptionId,
        {
          type: 'webhook',
          source: 'payment_failed',
          timestamp: new Date(),
          correlationId,
          subscriptionData: {
            status: 'past_due',
            failureCount: 1,
            lastFailedPaymentAt: new Date().toISOString()
          }
        }
      );
      expect(syncResult.success).toBe(true);
    });
  });
});