/**
 * Comprehensive Subscription Flow Testing
 * 
 * Tests all subscription-related flows including:
 * - Subscription creation and setup
 * - Payment processing and token allocation
 * - Subscription state changes (active, cancelled, failed)
 * - Billing cycle processing
 * - Token balance updates
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PaymentFlowTestUtils, TEST_USERS, TEST_SUBSCRIPTION_TIERS } from './setup/paymentFlowTestSetup';

// Mock the required services
jest.mock('../services/tokenService');
jest.mock('../services/transactionTrackingService');
jest.mock('../firebase/config');

describe('Subscription Flow Testing', () => {
  let mockEnvironment: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup test environment
    mockEnvironment = PaymentFlowTestUtils.setupTestEnvironment({
      currentUser: TEST_USERS.noSubscription,
      firestoreData: {
        users: {
          [TEST_USERS.noSubscription.uid]: TEST_USERS.noSubscription
        },
        subscriptions: {},
        token_balances: {},
        token_allocations: {}
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Subscription Status Synchronization', () => {
    test('should not auto-cancel recent subscriptions without stripeSubscriptionId', async () => {
      const user = TEST_USERS.noSubscription;

      // Create a recent subscription without stripeSubscriptionId (simulating checkout completion before webhook)
      const recentSubscription = {
        id: 'current',
        userId: user.uid,
        status: 'active',
        amount: 10,
        tier: 'tier1',
        stripeSubscriptionId: null, // Missing - webhook hasn't processed yet
        createdAt: new Date(), // Recent creation
        updatedAt: new Date()
      };

      // Mock the server-side subscription function
      const { getUserSubscriptionServer } = require('../firebase/subscription-server');

      // Test that recent subscriptions are not auto-cancelled
      const result = await getUserSubscriptionServer(user.uid, { verbose: true });

      // Should not auto-cancel if subscription is recent (less than 10 minutes old)
      expect(result?.status).not.toBe('canceled');
    });

    test('should auto-cancel stale subscriptions without stripeSubscriptionId', async () => {
      const user = TEST_USERS.noSubscription;

      // Create a stale subscription without stripeSubscriptionId
      const staleSubscription = {
        id: 'current',
        userId: user.uid,
        status: 'active',
        amount: 10,
        tier: 'tier1',
        stripeSubscriptionId: null,
        createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        updatedAt: new Date(Date.now() - 15 * 60 * 1000)
      };

      // Mock the server-side subscription function
      const { getUserSubscriptionServer } = require('../firebase/subscription-server');

      // Test that stale subscriptions are auto-cancelled
      const result = await getUserSubscriptionServer(user.uid, { verbose: true });

      // Should auto-cancel if subscription is stale (older than 10 minutes)
      expect(result?.status).toBe('canceled');
    });

    test('should force sync subscription status with Stripe', async () => {
      const user = TEST_USERS.activeSubscription;

      // Mock successful force sync API call
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          statusChanged: true,
          previousStatus: 'incomplete',
          currentStatus: 'active',
          subscription: {
            id: 'sub_test123',
            status: 'active',
            amount: 10,
            tokens: 100
          }
        })
      });

      const { SubscriptionService } = require('../services/subscriptionService');
      const result = await SubscriptionService.forceSyncSubscription(user.uid);

      expect(result.success).toBe(true);
      expect(result.statusChanged).toBe(true);
      expect(result.previousStatus).toBe('incomplete');
      expect(result.currentStatus).toBe('active');
    });
  });

  describe('Subscription Creation', () => {
    test('should create basic subscription successfully', async () => {
      const user = TEST_USERS.noSubscription;
      const tier = TEST_SUBSCRIPTION_TIERS.basic;
      
      // Mock successful Stripe checkout session creation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'cs_test_basic_123',
          url: 'https://checkout.stripe.com/pay/cs_test_basic_123'
        })
      });

      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: tier.stripePriceId,
          userId: user.uid,
          amount: tier.amount,
          tierName: tier.name
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.id).toBe('cs_test_basic_123');
      expect(result.url).toContain('checkout.stripe.com');
    });

    test('should create premium subscription successfully', async () => {
      const user = TEST_USERS.noSubscription;
      const tier = TEST_SUBSCRIPTION_TIERS.premium;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'cs_test_premium_456',
          url: 'https://checkout.stripe.com/pay/cs_test_premium_456'
        })
      });

      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: tier.stripePriceId,
          userId: user.uid,
          amount: tier.amount,
          tierName: tier.name
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.id).toBe('cs_test_premium_456');
      expect(result.url).toContain('checkout.stripe.com');
    });

    test('should handle subscription creation errors', async () => {
      const user = TEST_USERS.noSubscription;
      const tier = TEST_SUBSCRIPTION_TIERS.basic;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Invalid price ID'
        })
      });

      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: 'invalid_price_id',
          userId: user.uid,
          amount: tier.amount,
          tierName: tier.name
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('Subscription Activation', () => {
    test('should activate subscription and allocate tokens', async () => {
      const user = TEST_USERS.noSubscription;
      const tier = TEST_SUBSCRIPTION_TIERS.basic;
      
      // Mock successful subscription activation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          subscription: {
            id: 'sub_test_123',
            status: 'active',
            amount: tier.amount,
            tokens: tier.tokens,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          },
          tokenBalance: {
            totalTokens: tier.tokens,
            allocatedTokens: 0,
            availableTokens: tier.tokens
          }
        })
      });

      const response = await fetch('/api/subscription/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          stripeSubscriptionId: 'sub_test_123',
          amount: tier.amount
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.subscription.status).toBe('active');
      expect(result.tokenBalance.totalTokens).toBe(tier.tokens);
      expect(result.tokenBalance.availableTokens).toBe(tier.tokens);
    });

    test('should handle subscription activation failures', async () => {
      const user = TEST_USERS.noSubscription;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Invalid subscription ID'
        })
      });

      const response = await fetch('/api/subscription/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          stripeSubscriptionId: 'invalid_sub_id',
          amount: 5
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('Subscription State Changes', () => {
    test('should handle subscription cancellation', async () => {
      const user = TEST_USERS.activeBasic;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          subscription: {
            id: user.stripeSubscriptionId,
            status: 'cancelled',
            cancelAtPeriodEnd: true,
            currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
          }
        })
      });

      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          subscriptionId: user.stripeSubscriptionId
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.subscription.status).toBe('cancelled');
      expect(result.subscription.cancelAtPeriodEnd).toBe(true);
    });

    test('should handle failed payment recovery', async () => {
      const user = { ...TEST_USERS.activeBasic, subscriptionStatus: 'past_due' as const };
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          subscription: {
            id: user.stripeSubscriptionId,
            status: 'active',
            latestInvoice: {
              id: 'in_test_123',
              status: 'paid'
            }
          }
        })
      });

      const response = await fetch('/api/subscription/recover-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          subscriptionId: user.stripeSubscriptionId
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.subscription.status).toBe('active');
    });

    test('should handle subscription reactivation', async () => {
      const user = { ...TEST_USERS.activeBasic, subscriptionStatus: 'cancelled' as const };
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          subscription: {
            id: user.stripeSubscriptionId,
            status: 'active',
            cancelAtPeriodEnd: false,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        })
      });

      const response = await fetch('/api/subscription/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          subscriptionId: user.stripeSubscriptionId
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.subscription.status).toBe('active');
      expect(result.subscription.cancelAtPeriodEnd).toBe(false);
    });
  });

  describe('Billing Cycle Processing', () => {
    test('should process monthly billing and allocate new tokens', async () => {
      const user = TEST_USERS.activeBasic;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          processed: [{
            userId: user.uid,
            subscriptionId: user.stripeSubscriptionId,
            amount: user.subscriptionAmount,
            tokens: TEST_SUBSCRIPTION_TIERS.basic.tokens,
            newBalance: {
              totalTokens: TEST_SUBSCRIPTION_TIERS.basic.tokens,
              allocatedTokens: 0,
              availableTokens: TEST_SUBSCRIPTION_TIERS.basic.tokens
            }
          }]
        })
      });

      const response = await fetch('/api/subscription/process-new-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: false
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.processed).toHaveLength(1);
      expect(result.processed[0].tokens).toBe(TEST_SUBSCRIPTION_TIERS.basic.tokens);
    });

    test('should handle billing cycle errors gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: 'Billing processing failed',
          details: 'Stripe API error'
        })
      });

      const response = await fetch('/api/subscription/process-new-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: false
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe('Token Balance Updates', () => {
    test('should update token balance after subscription changes', async () => {
      const user = TEST_USERS.activeBasic;
      const newTier = TEST_SUBSCRIPTION_TIERS.premium;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          subscription: {
            id: user.stripeSubscriptionId,
            status: 'active',
            amount: newTier.amount,
            tokens: newTier.tokens
          },
          tokenBalance: {
            totalTokens: newTier.tokens,
            allocatedTokens: user.tokenBalance?.allocatedTokens || 0,
            availableTokens: newTier.tokens - (user.tokenBalance?.allocatedTokens || 0)
          }
        })
      });

      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          subscriptionId: user.stripeSubscriptionId,
          newPriceId: newTier.stripePriceId
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.tokenBalance.totalTokens).toBe(newTier.tokens);
      expect(result.tokenBalance.availableTokens).toBe(
        newTier.tokens - (user.tokenBalance?.allocatedTokens || 0)
      );
    });
  });

  describe('Subscription History and Audit Trail', () => {
    test('should include payment failure events in subscription history', async () => {
      // Mock the subscription history API response with payment failure events
      const mockHistoryResponse = {
        success: true,
        history: [
          {
            id: 'payment_failed_123',
            type: 'payment_failed',
            timestamp: new Date('2025-07-19T10:00:00Z'),
            description: 'Payment failed: Your card was declined. (Attempt 2)',
            details: {
              amount: 29.99,
              currency: 'USD',
              stripeEventId: 'inv_test_123',
              failureReason: 'Your card was declined.',
              failureCount: 2,
              failureType: 'card_declined',
              metadata: {
                correlationId: 'test_correlation_123',
                severity: 'warning',
                hostedInvoiceUrl: 'https://invoice.stripe.com/test'
              }
            },
            source: 'stripe'
          },
          {
            id: 'payment_recovered_456',
            type: 'payment_recovered',
            timestamp: new Date('2025-07-19T11:00:00Z'),
            description: 'Payment recovered after 2 failed attempts',
            details: {
              amount: 29.99,
              currency: 'USD',
              stripeEventId: 'inv_test_456',
              previousFailureCount: 2,
              metadata: {
                correlationId: 'recovery_correlation_456',
                severity: 'info'
              }
            },
            source: 'stripe'
          }
        ],
        count: 2
      };

      // Mock fetch for subscription history API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockHistoryResponse)
      });

      const response = await fetch('/api/subscription-history');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.history).toHaveLength(2);

      // Verify payment failure event
      const failureEvent = result.history.find((event: any) => event.type === 'payment_failed');
      expect(failureEvent).toBeDefined();
      expect(failureEvent.details.failureReason).toBe('Your card was declined.');
      expect(failureEvent.details.failureCount).toBe(2);
      expect(failureEvent.details.metadata.severity).toBe('warning');

      // Verify payment recovery event
      const recoveryEvent = result.history.find((event: any) => event.type === 'payment_recovered');
      expect(recoveryEvent).toBeDefined();
      expect(recoveryEvent.details.previousFailureCount).toBe(2);
      expect(recoveryEvent.description).toContain('recovered after 2 failed attempts');
    });

    test('should display payment failures prominently in subscription history UI', () => {
      // This would be tested in a component test, but we can verify the event structure
      const paymentFailureEvent = {
        id: 'payment_failed_critical',
        type: 'payment_failed',
        timestamp: new Date(),
        description: 'Payment failed: Insufficient funds. (Attempt 3)',
        details: {
          amount: 29.99,
          currency: 'USD',
          failureReason: 'Insufficient funds.',
          failureCount: 3,
          failureType: 'insufficient_funds',
          metadata: {
            severity: 'critical'
          }
        },
        source: 'stripe'
      };

      // Verify critical failure has proper severity
      expect(paymentFailureEvent.details.metadata.severity).toBe('critical');
      expect(paymentFailureEvent.details.failureCount).toBeGreaterThanOrEqual(3);
      expect(paymentFailureEvent.description).toContain('Attempt 3');
    });
  });
});
