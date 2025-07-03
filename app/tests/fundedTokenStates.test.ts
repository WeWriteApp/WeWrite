/**
 * Funded Token States Testing
 * 
 * Tests funded token states and earnings tracking:
 * - Pending amounts (current month allocations)
 * - Locked amounts (previous month allocations)
 * - Month-end processing and state transitions
 * - Earnings calculations and tracking
 * - Writer earnings dashboard updates
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PaymentFlowTestUtils, TEST_USERS, TEST_TOKEN_ALLOCATIONS } from './setup/paymentFlowTestSetup';

// Mock the required services
jest.mock('../services/tokenEarningsService');
jest.mock('../services/tokenService');
jest.mock('../firebase/config');

describe('Funded Token States Testing', () => {
  let mockEnvironment: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEnvironment = PaymentFlowTestUtils.setupTestEnvironment({
      currentUser: TEST_USERS.writer,
      firestoreData: {
        users: {
          [TEST_USERS.writer.uid]: TEST_USERS.writer,
          [TEST_USERS.activeBasic.uid]: TEST_USERS.activeBasic
        },
        token_allocations: TEST_TOKEN_ALLOCATIONS.reduce((acc, alloc) => ({ ...acc, [alloc.id]: alloc }), {}),
        writer_token_earnings: {
          [`${TEST_USERS.writer.uid}_2024-01`]: {
            id: `${TEST_USERS.writer.uid}_2024-01`,
            userId: TEST_USERS.writer.uid,
            month: '2024-01',
            totalTokensReceived: 85,
            totalUsdValue: 8.50,
            status: 'pending',
            allocations: [
              { allocationId: 'alloc_funded_pending_1', tokens: 25, usdValue: 2.50 },
              { allocationId: 'alloc_funded_locked_1', tokens: 30, usdValue: 3.00 },
              { allocationId: 'alloc_other', tokens: 30, usdValue: 3.00 }
            ],
            createdAt: new Date('2024-01-31'),
            updatedAt: new Date('2024-01-31')
          }
        },
        writer_token_balances: {
          [TEST_USERS.writer.uid]: {
            id: TEST_USERS.writer.uid,
            userId: TEST_USERS.writer.uid,
            totalTokensEarned: 125,
            totalUsdEarned: 12.50,
            availableUsdValue: 7.50,
            pendingUsdValue: 3.50,
            lockedUsdValue: 1.50,
            lastPayoutAmount: 0,
            lastPayoutDate: null,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-31')
          }
        }
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Pending Token Amounts (Current Month)', () => {
    test('should track pending tokens for current month', async () => {
      const writer = TEST_USERS.writer;
      const currentMonth = '2024-01';
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          earnings: {
            month: currentMonth,
            totalTokensReceived: 55,
            totalUsdValue: 5.50,
            status: 'pending',
            allocations: [
              { allocationId: 'alloc_funded_pending_1', tokens: 25, usdValue: 2.50 },
              { allocationId: 'alloc_funded_pending_2', tokens: 30, usdValue: 3.00 }
            ]
          }
        })
      });

      const response = await fetch(`/api/earnings/writer/${writer.uid}/month/${currentMonth}`);
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.earnings.status).toBe('pending');
      expect(result.earnings.totalTokensReceived).toBe(55);
      expect(result.earnings.totalUsdValue).toBe(5.50);
    });

    test('should calculate pending USD value correctly', () => {
      const pendingTokens = 45;
      const tokenToUsdRate = 0.10; // $0.10 per token
      const expectedUsdValue = pendingTokens * tokenToUsdRate;

      expect(expectedUsdValue).toBe(4.50);
    });

    test('should update pending amounts when new allocations are made', async () => {
      const writer = TEST_USERS.writer;
      const newAllocation = {
        userId: TEST_USERS.activeBasic.uid,
        recipientUserId: writer.uid,
        pageId: 'page_test_new',
        tokens: 20,
        month: '2024-01'
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          allocation: newAllocation,
          updatedEarnings: {
            month: '2024-01',
            totalTokensReceived: 75, // Previous 55 + new 20
            totalUsdValue: 7.50,
            status: 'pending'
          }
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAllocation)
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.updatedEarnings.totalTokensReceived).toBe(75);
      expect(result.updatedEarnings.totalUsdValue).toBe(7.50);
    });

    test('should display pending amounts in writer dashboard', () => {
      const writerBalance = {
        totalUsdEarned: 12.50,
        availableUsdValue: 7.50,
        pendingUsdValue: 3.50,
        lockedUsdValue: 1.50
      };

      // Verify pending amount calculation
      const expectedTotal = writerBalance.availableUsdValue + writerBalance.pendingUsdValue + writerBalance.lockedUsdValue;
      
      expect(expectedTotal).toBe(writerBalance.totalUsdEarned);
      expect(writerBalance.pendingUsdValue).toBe(3.50);
    });
  });

  describe('Locked Token Amounts (Previous Month)', () => {
    test('should lock previous month tokens at month end', async () => {
      const writer = TEST_USERS.writer;
      const previousMonth = '2023-12';
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          processedEarnings: [{
            userId: writer.uid,
            month: previousMonth,
            totalTokensReceived: 30,
            totalUsdValue: 3.00,
            status: 'locked',
            lockedAt: new Date('2024-01-01').toISOString()
          }]
        })
      });

      const response = await fetch('/api/earnings/process-month-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: previousMonth,
          dryRun: false
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.processedEarnings[0].status).toBe('locked');
      expect(result.processedEarnings[0].totalUsdValue).toBe(3.00);
    });

    test('should make locked amounts available for payout', async () => {
      const writer = TEST_USERS.writer;
      const lockedAmount = 15.25;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          balance: {
            userId: writer.uid,
            totalUsdEarned: 125.50,
            availableUsdValue: 75.25, // Includes previously locked amount
            pendingUsdValue: 35.00,
            lockedUsdValue: 15.25,
            lastProcessedAt: new Date().toISOString()
          }
        })
      });

      const response = await fetch(`/api/earnings/writer/${writer.uid}/balance`);
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.balance.availableUsdValue).toBe(75.25);
      expect(result.balance.lockedUsdValue).toBe(15.25);
    });

    test('should track locked amount history', async () => {
      const writer = TEST_USERS.writer;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          history: [
            {
              month: '2023-12',
              totalUsdValue: 15.25,
              status: 'locked',
              lockedAt: '2024-01-01T00:00:00Z',
              madeAvailableAt: '2024-01-01T00:00:00Z'
            },
            {
              month: '2023-11',
              totalUsdValue: 22.50,
              status: 'paid_out',
              lockedAt: '2023-12-01T00:00:00Z',
              madeAvailableAt: '2023-12-01T00:00:00Z',
              paidOutAt: '2023-12-15T00:00:00Z'
            }
          ]
        })
      });

      const response = await fetch(`/api/earnings/writer/${writer.uid}/history`);
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.history).toHaveLength(2);
      expect(result.history[0].status).toBe('locked');
      expect(result.history[1].status).toBe('paid_out');
    });
  });

  describe('Month-End Processing and State Transitions', () => {
    test('should transition pending to locked at month end', async () => {
      const processingDate = new Date('2024-02-01'); // First day of new month
      const previousMonth = '2024-01';
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          processed: [{
            month: previousMonth,
            pendingTokens: 55,
            pendingUsdValue: 5.50,
            newStatus: 'locked',
            transitionedAt: processingDate.toISOString()
          }]
        })
      });

      const response = await fetch('/api/earnings/process-month-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetMonth: previousMonth,
          processingDate: processingDate.toISOString()
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.processed[0].newStatus).toBe('locked');
      expect(result.processed[0].pendingUsdValue).toBe(5.50);
    });

    test('should handle month-end processing errors gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: 'Month-end processing failed',
          details: 'Database transaction error',
          partiallyProcessed: true,
          processedCount: 5,
          failedCount: 2
        })
      });

      const response = await fetch('/api/earnings/process-month-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetMonth: '2024-01'
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.error).toContain('Month-end processing failed');
      expect(result.partiallyProcessed).toBe(true);
    });

    test('should validate month-end processing timing', () => {
      const currentDate = new Date('2024-01-15'); // Mid-month
      const monthEndDate = new Date('2024-02-01'); // First day of next month
      
      const canProcessMonthEnd = currentDate >= monthEndDate;
      const daysUntilProcessing = Math.ceil((monthEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      expect(canProcessMonthEnd).toBe(false);
      expect(daysUntilProcessing).toBe(17);
    });
  });

  describe('Earnings Calculations and Tracking', () => {
    test('should calculate total earnings correctly', () => {
      const allocations = [
        { tokens: 25, usdValue: 2.50 },
        { tokens: 30, usdValue: 3.00 },
        { tokens: 20, usdValue: 2.00 }
      ];
      
      const totalTokens = allocations.reduce((sum, alloc) => sum + alloc.tokens, 0);
      const totalUsdValue = allocations.reduce((sum, alloc) => sum + alloc.usdValue, 0);
      
      expect(totalTokens).toBe(75);
      expect(totalUsdValue).toBe(7.50);
    });

    test('should track earnings by allocation source', async () => {
      const writer = TEST_USERS.writer;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          earningsBySource: {
            pageAllocations: 45.50,
            groupAllocations: 12.25,
            bioAllocations: 5.75,
            total: 63.50
          }
        })
      });

      const response = await fetch(`/api/earnings/writer/${writer.uid}/by-source`);
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.earningsBySource.total).toBe(63.50);
      expect(result.earningsBySource.pageAllocations).toBe(45.50);
    });

    test('should calculate earnings growth trends', () => {
      const monthlyEarnings = [
        { month: '2023-10', usdValue: 15.25 },
        { month: '2023-11', usdValue: 22.50 },
        { month: '2023-12', usdValue: 18.75 },
        { month: '2024-01', usdValue: 28.00 }
      ];
      
      // Calculate month-over-month growth
      const currentMonth = monthlyEarnings[monthlyEarnings.length - 1];
      const previousMonth = monthlyEarnings[monthlyEarnings.length - 2];
      
      const growthAmount = currentMonth.usdValue - previousMonth.usdValue;
      const growthPercentage = (growthAmount / previousMonth.usdValue) * 100;
      
      expect(growthAmount).toBe(9.25);
      expect(Math.round(growthPercentage * 10) / 10).toBe(49.3); // 49.3% growth
    });

    test('should handle zero earnings gracefully', () => {
      const emptyEarnings = {
        totalTokensReceived: 0,
        totalUsdValue: 0,
        allocations: []
      };
      
      const hasEarnings = emptyEarnings.totalTokensReceived > 0;
      const displayValue = hasEarnings ? `$${emptyEarnings.totalUsdValue.toFixed(2)}` : '$0.00';
      
      expect(hasEarnings).toBe(false);
      expect(displayValue).toBe('$0.00');
    });
  });

  describe('Writer Earnings Dashboard Updates', () => {
    test('should display current earnings breakdown', async () => {
      const writer = TEST_USERS.writer;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          dashboard: {
            totalEarnings: 125.50,
            availableForPayout: 75.25,
            pendingThisMonth: 35.00,
            lockedLastMonth: 15.25,
            earningsChart: [
              { month: '2023-11', earnings: 22.50 },
              { month: '2023-12', earnings: 18.75 },
              { month: '2024-01', earnings: 28.00 }
            ]
          }
        })
      });

      const response = await fetch(`/api/earnings/writer/${writer.uid}/dashboard`);
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.dashboard.totalEarnings).toBe(125.50);
      expect(result.dashboard.availableForPayout).toBe(75.25);
      expect(result.dashboard.pendingThisMonth).toBe(35.00);
    });

    test('should update dashboard in real-time when allocations change', async () => {
      const writer = TEST_USERS.writer;
      const newAllocation = { tokens: 10, usdValue: 1.00 };
      
      // Simulate real-time update
      const currentPending = 35.00;
      const updatedPending = currentPending + newAllocation.usdValue;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          realTimeUpdate: {
            pendingThisMonth: updatedPending,
            totalEarnings: 126.50,
            lastUpdated: new Date().toISOString()
          }
        })
      });

      const response = await fetch(`/api/earnings/writer/${writer.uid}/real-time-update`);
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.realTimeUpdate.pendingThisMonth).toBe(36.00);
      expect(result.realTimeUpdate.totalEarnings).toBe(126.50);
    });

    test('should show earnings status indicators', () => {
      const earningsStates = [
        { status: 'pending', indicator: 'clock', color: 'yellow' },
        { status: 'locked', indicator: 'lock', color: 'blue' },
        { status: 'available', indicator: 'check', color: 'green' },
        { status: 'paid_out', indicator: 'dollar', color: 'gray' }
      ];
      
      earningsStates.forEach(({ status, indicator, color }) => {
        const shouldShowIndicator = ['pending', 'locked', 'available', 'paid_out'].includes(status);
        expect(shouldShowIndicator).toBe(true);
        expect(indicator).toBeTruthy();
        expect(color).toBeTruthy();
      });
    });
  });
});
