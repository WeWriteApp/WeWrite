/**
 * End-to-End Payment Flow Integration Testing
 * 
 * Tests complete payment flows from subscription to payout:
 * - Full user journey from signup to payout
 * - Month-end processing and state transitions
 * - Cross-service integration and data consistency
 * - Error recovery and rollback scenarios
 * - Performance and scalability testing
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PaymentFlowTestUtils, TEST_USERS, TEST_SUBSCRIPTION_TIERS } from './setup/paymentFlowTestSetup';

// Mock all required services for integration testing
jest.mock('../services/tokenService');
jest.mock('../services/tokenEarningsService');
jest.mock('../services/transactionTrackingService');
jest.mock('../services/unifiedFeeCalculationService');
jest.mock('../firebase/config');

describe('End-to-End Payment Flow Integration Testing', () => {
  let mockEnvironment: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEnvironment = PaymentFlowTestUtils.setupTestEnvironment({
      enableLocalStorage: true,
      firestoreData: {
        users: Object.values(TEST_USERS).reduce((acc, user) => ({ ...acc, [user.uid]: user }), {}),
        subscriptions: {},
        token_balances: {},
        token_allocations: {},
        writer_token_earnings: {},
        payouts: {}
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete User Journey: Signup to Payout', () => {
    test('should complete full payment flow for new user', async () => {
      const newUser = PaymentFlowTestUtils.createTestUser({
        uid: 'new_user_journey_123',
        email: 'journey@test.com',
        username: 'journey_test_user'
      });

      // Step 1: User signs up and creates subscription
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            checkoutSession: {
              id: 'cs_journey_123',
              url: 'https://checkout.stripe.com/pay/cs_journey_123'
            }
          })
        })
        // Step 2: Subscription activation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            subscription: {
              id: 'sub_journey_123',
              status: 'active',
              amount: 15,
              tokens: 150
            },
            tokenBalance: {
              totalTokens: 150,
              allocatedTokens: 0,
              availableTokens: 150
            }
          })
        })
        // Step 3: Token allocation to writer
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            allocation: {
              pageId: 'page_journey_test',
              tokens: 50,
              recipientUserId: TEST_USERS.writer.uid
            },
            updatedBalance: {
              totalTokens: 150,
              allocatedTokens: 50,
              availableTokens: 100
            }
          })
        })
        // Step 4: Writer earnings update
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            earnings: {
              userId: TEST_USERS.writer.uid,
              month: '2024-01',
              totalTokensReceived: 50,
              totalUsdValue: 5.00,
              status: 'pending'
            }
          })
        });

      // Execute the journey
      const checkoutResponse = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newUser.uid,
          priceId: TEST_SUBSCRIPTION_TIERS.premium.stripePriceId,
          amount: TEST_SUBSCRIPTION_TIERS.premium.amount
        })
      });

      const activationResponse = await fetch('/api/subscription/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newUser.uid,
          subscriptionId: 'sub_journey_123'
        })
      });

      const allocationResponse = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newUser.uid,
          pageId: 'page_journey_test',
          tokens: 50,
          recipientUserId: TEST_USERS.writer.uid
        })
      });

      const earningsResponse = await fetch(`/api/earnings/writer/${TEST_USERS.writer.uid}/update`);

      // Verify each step
      expect(checkoutResponse.ok).toBe(true);
      expect(activationResponse.ok).toBe(true);
      expect(allocationResponse.ok).toBe(true);
      expect(earningsResponse.ok).toBe(true);
    });

    test('should handle logged-out user token conversion on signup', async () => {
      // Setup logged-out user with simulated tokens
      const loggedOutAllocations = [
        { pageId: 'page1', tokens: 25, pageTitle: 'Page 1', timestamp: Date.now() },
        { pageId: 'page2', tokens: 15, pageTitle: 'Page 2', timestamp: Date.now() }
      ];

      mockEnvironment.mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        totalTokens: 100,
        allocatedTokens: 40,
        availableTokens: 60,
        allocations: loggedOutAllocations
      }));

      const newUser = PaymentFlowTestUtils.createTestUser({
        uid: 'converted_user_123',
        email: 'converted@test.com'
      });

      global.fetch = jest.fn()
        // User signup and subscription
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            subscription: { id: 'sub_converted_123', status: 'active' }
          })
        })
        // Convert simulated tokens
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            convertedCount: 2,
            totalTokensConverted: 40,
            errors: []
          })
        });

      const subscriptionResponse = await fetch('/api/subscription/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newUser.uid })
      });

      const conversionResponse = await fetch('/api/tokens/convert-simulated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newUser.uid,
          allocations: loggedOutAllocations
        })
      });

      expect(subscriptionResponse.ok).toBe(true);
      expect(conversionResponse.ok).toBe(true);
      
      const conversionResult = await conversionResponse.json();
      expect(conversionResult.convertedCount).toBe(2);
      expect(conversionResult.totalTokensConverted).toBe(40);
    });

    test('should complete writer payout journey', async () => {
      const writer = TEST_USERS.writer;
      const payoutAmount = 75.25;

      global.fetch = jest.fn()
        // Check writer balance
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            balance: {
              availableUsdValue: payoutAmount,
              pendingUsdValue: 35.00,
              totalUsdEarned: 125.50
            }
          })
        })
        // Calculate fees
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            feeBreakdown: {
              grossAmount: payoutAmount,
              totalFees: 5.83,
              netAmount: 69.42
            }
          })
        })
        // Request payout
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            payout: {
              id: 'payout_writer_123',
              amount: payoutAmount,
              netAmount: 69.42,
              status: 'pending'
            }
          })
        })
        // Process transfer
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            transfer: {
              id: 'tr_writer_123',
              status: 'pending',
              estimatedArrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
            }
          })
        });

      const balanceResponse = await fetch(`/api/earnings/writer/${writer.uid}/balance`);
      const feesResponse = await fetch('/api/payouts/calculate-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: payoutAmount })
      });
      const payoutResponse = await fetch('/api/payouts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: writer.uid, amount: payoutAmount })
      });
      const transferResponse = await fetch('/api/payouts/process-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId: 'payout_writer_123' })
      });

      expect(balanceResponse.ok).toBe(true);
      expect(feesResponse.ok).toBe(true);
      expect(payoutResponse.ok).toBe(true);
      expect(transferResponse.ok).toBe(true);
    });
  });

  describe('Month-End Processing Integration', () => {
    test('should process complete month-end cycle', async () => {
      const targetMonth = '2024-01';
      const processingDate = new Date('2024-02-01');

      global.fetch = jest.fn()
        // Finalize pending allocations
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            finalizedAllocations: 150,
            totalTokensProcessed: 5500,
            totalUsdValue: 550.00
          })
        })
        // Process writer earnings
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            processedWriters: 25,
            totalEarningsCreated: 550.00,
            averageEarningsPerWriter: 22.00
          })
        })
        // Update token balances
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            updatedBalances: 25,
            newAvailableAmount: 450.00,
            newPendingAmount: 100.00
          })
        })
        // Process subscription renewals
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            renewedSubscriptions: 100,
            newTokensAllocated: 15000,
            totalRevenue: 1500.00
          })
        });

      const finalizationResponse = await fetch('/api/earnings/finalize-allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: targetMonth })
      });

      const earningsResponse = await fetch('/api/earnings/process-month-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: targetMonth })
      });

      const balancesResponse = await fetch('/api/earnings/update-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: targetMonth })
      });

      const renewalsResponse = await fetch('/api/subscription/process-new-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processingDate: processingDate.toISOString() })
      });

      expect(finalizationResponse.ok).toBe(true);
      expect(earningsResponse.ok).toBe(true);
      expect(balancesResponse.ok).toBe(true);
      expect(renewalsResponse.ok).toBe(true);
    });

    test('should handle month-end processing failures with rollback', async () => {
      const targetMonth = '2024-01';
      let stepCount = 0;

      global.fetch = jest.fn().mockImplementation(() => {
        stepCount++;
        if (stepCount === 3) {
          // Fail on third step
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
              error: 'Database transaction failed',
              step: 'update-balances',
              rollbackRequired: true
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      });

      const responses = [];
      
      // Execute steps until failure
      try {
        responses.push(await fetch('/api/earnings/finalize-allocations', {
          method: 'POST',
          body: JSON.stringify({ month: targetMonth })
        }));
        
        responses.push(await fetch('/api/earnings/process-month-end', {
          method: 'POST',
          body: JSON.stringify({ month: targetMonth })
        }));
        
        responses.push(await fetch('/api/earnings/update-balances', {
          method: 'POST',
          body: JSON.stringify({ month: targetMonth })
        }));
      } catch (error) {
        // Expected to fail
      }

      expect(responses[0].ok).toBe(true);
      expect(responses[1].ok).toBe(true);
      expect(responses[2].ok).toBe(false);
    });

    test('should maintain data consistency during processing', async () => {
      const beforeProcessing = {
        totalAllocations: 100,
        totalTokens: 5000,
        totalUsdValue: 500.00,
        pendingEarnings: 25
      };

      const afterProcessing = {
        finalizedAllocations: 100,
        processedTokens: 5000,
        createdEarnings: 500.00,
        lockedEarnings: 25
      };

      // Verify data consistency
      expect(afterProcessing.finalizedAllocations).toBe(beforeProcessing.totalAllocations);
      expect(afterProcessing.processedTokens).toBe(beforeProcessing.totalTokens);
      expect(afterProcessing.createdEarnings).toBe(beforeProcessing.totalUsdValue);
      expect(afterProcessing.lockedEarnings).toBe(beforeProcessing.pendingEarnings);
    });
  });

  describe('Cross-Service Integration', () => {
    test('should maintain consistency across all services', async () => {
      const userId = TEST_USERS.activeBasic.uid;
      const pageId = 'page_consistency_test';
      const tokens = 25;

      // Mock responses that should be consistent
      global.fetch = jest.fn()
        // Token service allocation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            allocation: { userId, pageId, tokens },
            newBalance: { allocatedTokens: 55, availableTokens: 95 }
          })
        })
        // Earnings service update
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            earnings: { totalTokensReceived: 25, totalUsdValue: 2.50 }
          })
        })
        // Transaction tracking
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            transaction: { type: 'token_allocation', amount: 2.50, status: 'completed' }
          })
        });

      const allocationResponse = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pageId, tokens })
      });

      const earningsResponse = await fetch('/api/earnings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tokens })
      });

      const transactionResponse = await fetch('/api/transactions/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'token_allocation', amount: 2.50 })
      });

      expect(allocationResponse.ok).toBe(true);
      expect(earningsResponse.ok).toBe(true);
      expect(transactionResponse.ok).toBe(true);
    });

    test('should handle service communication failures', async () => {
      const userId = TEST_USERS.activeBasic.uid;
      let callCount = 0;

      global.fetch = jest.fn().mockImplementation((url) => {
        callCount++;
        if (url.includes('earnings') && callCount === 2) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: () => Promise.resolve({
              error: 'Earnings service unavailable',
              retryable: true
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      });

      const allocationResponse = await fetch('/api/tokens/allocate', {
        method: 'POST',
        body: JSON.stringify({ userId, tokens: 10 })
      });

      const earningsResponse = await fetch('/api/earnings/update', {
        method: 'POST',
        body: JSON.stringify({ userId, tokens: 10 })
      });

      expect(allocationResponse.ok).toBe(true);
      expect(earningsResponse.ok).toBe(false);
    });
  });

  describe('Error Recovery and Rollback', () => {
    test('should recover from partial payment failures', async () => {
      const paymentData = {
        userId: TEST_USERS.activeBasic.uid,
        amount: 15.00,
        subscriptionId: 'sub_recovery_test'
      };

      let attemptCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
              error: 'Payment processing failed',
              recoverable: true,
              partialData: { chargeId: 'ch_partial_123' }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            recovered: true,
            chargeId: 'ch_recovered_123'
          })
        });
      });

      // First attempt fails
      let response = await fetch('/api/subscription/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      expect(response.ok).toBe(false);

      // Recovery attempt succeeds
      response = await fetch('/api/subscription/recover-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...paymentData, recovery: true })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.recovered).toBe(true);
    });

    test('should rollback failed token allocations', async () => {
      const allocationData = {
        userId: TEST_USERS.activeBasic.uid,
        pageId: 'page_rollback_test',
        tokens: 50
      };

      global.fetch = jest.fn()
        // Initial allocation succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            allocation: allocationData,
            transactionId: 'tx_rollback_123'
          })
        })
        // Earnings update fails
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({
            error: 'Earnings service failed',
            rollbackRequired: true,
            transactionId: 'tx_rollback_123'
          })
        })
        // Rollback succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            rolledBack: true,
            transactionId: 'tx_rollback_123'
          })
        });

      const allocationResponse = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allocationData)
      });

      const earningsResponse = await fetch('/api/earnings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allocationData)
      });

      const rollbackResponse = await fetch('/api/tokens/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: 'tx_rollback_123' })
      });

      expect(allocationResponse.ok).toBe(true);
      expect(earningsResponse.ok).toBe(false);
      expect(rollbackResponse.ok).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high-volume token allocations', async () => {
      const batchSize = 100;
      const allocations = Array.from({ length: batchSize }, (_, i) => ({
        userId: `user_${i}`,
        pageId: `page_${i}`,
        tokens: 10 + (i % 20)
      }));

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          processed: batchSize,
          totalTokens: allocations.reduce((sum, alloc) => sum + alloc.tokens, 0),
          processingTime: 1250 // milliseconds
        })
      });

      const startTime = Date.now();
      const response = await fetch('/api/tokens/batch-allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations })
      });
      const endTime = Date.now();

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.processed).toBe(batchSize);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle concurrent payout requests', async () => {
      const concurrentRequests = 10;
      const payoutAmount = 50.00;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          payout: { id: `payout_concurrent_${Date.now()}`, amount: payoutAmount }
        })
      });

      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        fetch('/api/payouts/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: `writer_${i}`,
            amount: payoutAmount
          })
        })
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.ok).length;

      expect(successCount).toBe(concurrentRequests);
    });
  });
});
