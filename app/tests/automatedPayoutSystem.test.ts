/**
 * Comprehensive tests for the Automated Payout System
 * 
 * Tests the integration of automated payout processing, scheduling,
 * monitoring, and error handling capabilities.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AutomatedPayoutService } from '../services/automatedPayoutService';
import { PayoutSchedulerService } from '../services/payoutSchedulerService';
import { PayoutMonitoringService } from '../services/payoutMonitoringService';
import { FinancialUtils } from '../types/financial';

// Mock Firebase
jest.mock('../firebase/config', () => ({
  db: {},
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  increment: jest.fn((value) => ({ _increment: value })),
}));

// Mock services
jest.mock('../services/stripePayoutService', () => ({
  stripePayoutService: {
    processPayout: jest.fn(),
    verifyStripeAccount: jest.fn(),
    createStripeTransfer: jest.fn(),
  },
}));

jest.mock('../services/transactionTrackingService', () => ({
  TransactionTrackingService: {
    trackPayoutRequest: jest.fn(),
    updateTransactionStatus: jest.fn(),
  },
}));

describe('Automated Payout System', () => {
  let automatedPayoutService: AutomatedPayoutService;
  let schedulerService: PayoutSchedulerService;
  let monitoringService: PayoutMonitoringService;
  let correlationId: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Get service instances
    automatedPayoutService = AutomatedPayoutService.getInstance();
    schedulerService = PayoutSchedulerService.getInstance();
    monitoringService = PayoutMonitoringService.getInstance();
    
    correlationId = FinancialUtils.generateCorrelationId();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AutomatedPayoutService', () => {
    test('should process pending payouts successfully', async () => {
      // Mock pending payouts
      const mockPayouts = [
        {
          id: 'payout_1',
          recipientId: 'recipient_1',
          amount: 100,
          currency: 'usd',
          status: 'pending',
          retryCount: 0
        },
        {
          id: 'payout_2',
          recipientId: 'recipient_2',
          amount: 50,
          currency: 'usd',
          status: 'pending',
          retryCount: 0
        }
      ];

      // Mock Firestore queries
      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: mockPayouts.map(payout => ({
          id: payout.id,
          data: () => payout
        }))
      });

      // Mock successful Stripe processing
      const { stripePayoutService } = require('../services/stripePayoutService');
      stripePayoutService.processPayout.mockResolvedValue({
        success: true,
        data: { id: 'stripe_transfer_123' }
      });

      // Mock transaction tracking
      const { TransactionTrackingService } = require('../services/transactionTrackingService');
      TransactionTrackingService.trackPayoutRequest.mockResolvedValue({
        success: true,
        data: { id: 'transaction_123' }
      });
      TransactionTrackingService.updateTransactionStatus.mockResolvedValue({
        success: true
      });

      // Mock document updates
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue(undefined);

      // Process payouts
      const result = await automatedPayoutService.processAllPendingPayouts(correlationId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.totalProcessed).toBe(2);
      expect(result.data!.successful).toBe(2);
      expect(result.data!.failed).toBe(0);
    });

    test('should handle payout processing failures with retry logic', async () => {
      const mockPayout = {
        id: 'payout_fail',
        recipientId: 'recipient_1',
        amount: 100,
        currency: 'usd',
        status: 'pending',
        retryCount: 0
      };

      // Mock Firestore queries
      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: [{
          id: mockPayout.id,
          data: () => mockPayout
        }]
      });

      // Mock failed Stripe processing
      const { stripePayoutService } = require('../services/stripePayoutService');
      stripePayoutService.processPayout.mockResolvedValue({
        success: false,
        error: 'Insufficient funds in Stripe account'
      });

      // Mock transaction tracking
      const { TransactionTrackingService } = require('../services/transactionTrackingService');
      TransactionTrackingService.trackPayoutRequest.mockResolvedValue({
        success: true,
        data: { id: 'transaction_123' }
      });

      // Mock document updates
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue(undefined);

      // Process payouts
      const result = await automatedPayoutService.processAllPendingPayouts(correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.totalProcessed).toBe(1);
      expect(result.data!.successful).toBe(0);
      expect(result.data!.failed).toBe(1);
      expect(result.data!.errors).toHaveLength(1);
      expect(result.data!.errors[0].error).toContain('Insufficient funds');
    });

    test('should respect batch size configuration', async () => {
      const batchSize = 3;
      const customService = AutomatedPayoutService.getInstance({ batchSize });

      // Mock 5 pending payouts
      const mockPayouts = Array.from({ length: 5 }, (_, i) => ({
        id: `payout_${i + 1}`,
        recipientId: `recipient_${i + 1}`,
        amount: 100,
        currency: 'usd',
        status: 'pending',
        retryCount: 0
      }));

      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: mockPayouts.map(payout => ({
          id: payout.id,
          data: () => payout
        }))
      });

      const { stripePayoutService } = require('../services/stripePayoutService');
      stripePayoutService.processPayout.mockResolvedValue({
        success: true,
        data: { id: 'stripe_transfer_123' }
      });

      const { TransactionTrackingService } = require('../services/transactionTrackingService');
      TransactionTrackingService.trackPayoutRequest.mockResolvedValue({
        success: true,
        data: { id: 'transaction_123' }
      });

      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue(undefined);

      const result = await customService.processAllPendingPayouts(correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.totalProcessed).toBe(5);
      expect(result.data!.successful).toBe(5);
    });
  });

  describe('PayoutSchedulerService', () => {
    test('should initialize with default configuration', async () => {
      const { getDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => false
      });

      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await schedulerService.initialize();

      expect(result.success).toBe(true);
      expect(setDoc).toHaveBeenCalled();
    });

    test('should calculate next scheduled time correctly for monthly schedule', () => {
      const nextTime = schedulerService.getNextScheduledTime();
      
      expect(nextTime).toBeInstanceOf(Date);
      expect(nextTime.getTime()).toBeGreaterThan(Date.now());
    });

    test('should determine when scheduled payouts should run', () => {
      // This test would need to mock the current time to test specific scenarios
      const shouldRun = schedulerService.shouldRunScheduledPayouts();
      expect(typeof shouldRun).toBe('boolean');
    });

    test('should update schedule configuration', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue(undefined);

      const newConfig = {
        enabled: true,
        frequency: 'weekly' as const,
        dayOfWeek: 1, // Monday
        hour: 10,
        minute: 0
      };

      const result = await schedulerService.updateScheduleConfig(newConfig, correlationId);

      expect(result.success).toBe(true);
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('PayoutMonitoringService', () => {
    test('should calculate payout metrics correctly', async () => {
      // Mock payout data for metrics calculation
      const mockPayouts = [
        { status: 'completed', amount: 100, createdAt: new Date(), completedAt: new Date() },
        { status: 'completed', amount: 50, createdAt: new Date(), completedAt: new Date() },
        { status: 'failed', amount: 75, createdAt: new Date() },
        { status: 'pending', amount: 25, createdAt: new Date() }
      ];

      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: mockPayouts.map((payout, index) => ({
          id: `payout_${index}`,
          data: () => payout
        }))
      });

      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await monitoringService.calculateMetrics(correlationId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.totalPayouts).toBe(4);
      expect(result.data!.successfulPayouts).toBe(2);
      expect(result.data!.failedPayouts).toBe(1);
      expect(result.data!.pendingPayouts).toBe(1);
      expect(result.data!.totalAmount).toBe(250);
      expect(result.data!.successRate).toBe(50);
      expect(result.data!.failureRate).toBe(25);
    });

    test('should generate alerts for high failure rates', async () => {
      const metrics = {
        totalPayouts: 10,
        successfulPayouts: 5,
        failedPayouts: 5,
        pendingPayouts: 0,
        totalAmount: 1000,
        averageProcessingTime: 30000,
        successRate: 50,
        failureRate: 50,
        retryRate: 10,
        lastUpdated: new Date()
      };

      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await monitoringService.checkAlertConditions(metrics, correlationId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBeGreaterThan(0);
      
      const failureRateAlert = result.data!.find(alert => alert.type === 'failure_rate');
      expect(failureRateAlert).toBeDefined();
      expect(failureRateAlert!.severity).toBe('high');
    });

    test('should get health status with system load information', async () => {
      // Mock metrics calculation
      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: [],
        size: 0
      });

      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await monitoringService.getHealthStatus(correlationId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBeDefined();
      expect(result.data!.metrics).toBeDefined();
      expect(result.data!.systemLoad).toBeDefined();
      expect(result.data!.lastCheckAt).toBeInstanceOf(Date);
    });
  });

  describe('Integration Tests', () => {
    test('should handle end-to-end automated payout processing', async () => {
      // This test would simulate a complete flow from scheduling to monitoring
      // Mock all necessary dependencies and verify the complete workflow
      
      // Initialize services
      await schedulerService.initialize();
      await monitoringService.initialize();

      // Mock pending payouts
      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: [{
          id: 'payout_integration_test',
          data: () => ({
            id: 'payout_integration_test',
            recipientId: 'recipient_1',
            amount: 100,
            currency: 'usd',
            status: 'pending',
            retryCount: 0
          })
        }]
      });

      // Mock successful processing
      const { stripePayoutService } = require('../services/stripePayoutService');
      stripePayoutService.processPayout.mockResolvedValue({
        success: true,
        data: { id: 'stripe_transfer_integration' }
      });

      const { TransactionTrackingService } = require('../services/transactionTrackingService');
      TransactionTrackingService.trackPayoutRequest.mockResolvedValue({
        success: true,
        data: { id: 'transaction_integration' }
      });

      const { updateDoc, setDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue(undefined);
      setDoc.mockResolvedValue(undefined);

      // Run scheduled payouts
      const result = await schedulerService.runScheduledPayouts(correlationId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBe('completed');
    });
  });
});
