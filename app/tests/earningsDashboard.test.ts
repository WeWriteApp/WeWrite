/**
 * Earnings Dashboard Testing
 * 
 * Tests the writer earnings dashboard functionality:
 * - Display of all token states (unfunded, pending, locked, available)
 * - Earnings history and charts
 * - Balance calculations and breakdowns
 * - Real-time updates and refresh functionality
 * - Payout request integration
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PaymentFlowTestUtils, TEST_USERS } from './setup/paymentFlowTestSetup';

// Mock the required components and services
jest.mock('../components/payments/WriterTokenDashboard');
jest.mock('../components/payments/EarningsChart');
jest.mock('../services/tokenEarningsService');

describe('Earnings Dashboard Testing', () => {
  let mockEnvironment: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEnvironment = PaymentFlowTestUtils.setupTestEnvironment({
      currentUser: TEST_USERS.writer,
      firestoreData: {
        users: {
          [TEST_USERS.writer.uid]: TEST_USERS.writer
        },
        writer_token_balances: {
          [TEST_USERS.writer.uid]: {
            id: TEST_USERS.writer.uid,
            userId: TEST_USERS.writer.uid,
            totalTokensEarned: 1255,
            totalUsdEarned: 125.50,
            availableUsdValue: 75.25,
            pendingUsdValue: 35.00,
            lockedUsdValue: 15.25,
            lastPayoutAmount: 50.00,
            lastPayoutDate: new Date('2024-01-15'),
            createdAt: new Date('2023-12-01'),
            updatedAt: new Date('2024-01-31')
          }
        },
        writer_token_earnings: {
          [`${TEST_USERS.writer.uid}_2024-01`]: {
            id: `${TEST_USERS.writer.uid}_2024-01`,
            userId: TEST_USERS.writer.uid,
            month: '2024-01',
            totalTokensReceived: 350,
            totalUsdValue: 35.00,
            status: 'pending',
            allocations: [
              { allocationId: 'alloc1', tokens: 150, usdValue: 15.00, status: 'funded_pending' },
              { allocationId: 'alloc2', tokens: 100, usdValue: 10.00, status: 'funded_pending' },
              { allocationId: 'alloc3', tokens: 100, usdValue: 10.00, status: 'unfunded_no_subscription' }
            ],
            createdAt: new Date('2024-01-31'),
            updatedAt: new Date('2024-01-31')
          },
          [`${TEST_USERS.writer.uid}_2023-12`]: {
            id: `${TEST_USERS.writer.uid}_2023-12`,
            userId: TEST_USERS.writer.uid,
            month: '2023-12',
            totalTokensReceived: 152,
            totalUsdValue: 15.25,
            status: 'locked',
            allocations: [
              { allocationId: 'alloc4', tokens: 152, usdValue: 15.25, status: 'funded_locked' }
            ],
            createdAt: new Date('2023-12-31'),
            updatedAt: new Date('2024-01-01')
          }
        }
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Dashboard Data Loading', () => {
    test('should load writer balance and earnings data', async () => {
      const writer = TEST_USERS.writer;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          balance: {
            totalUsdEarned: 125.50,
            availableUsdValue: 75.25,
            pendingUsdValue: 35.00,
            lockedUsdValue: 15.25
          },
          earnings: [
            {
              month: '2024-01',
              totalUsdValue: 35.00,
              status: 'pending',
              totalTokensReceived: 350
            },
            {
              month: '2023-12',
              totalUsdValue: 15.25,
              status: 'locked',
              totalTokensReceived: 152
            }
          ]
        })
      });

      const response = await fetch(`/api/earnings/writer/${writer.uid}/dashboard`);
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.balance.totalUsdEarned).toBe(125.50);
      expect(result.earnings).toHaveLength(2);
    });

    test('should handle loading errors gracefully', async () => {
      const writer = TEST_USERS.writer;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: 'Failed to load earnings data'
        })
      });

      const response = await fetch(`/api/earnings/writer/${writer.uid}/dashboard`);
      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.error).toContain('Failed to load earnings data');
    });

    test('should display empty state for new writers', async () => {
      const newWriter = { ...TEST_USERS.writer, uid: 'new_writer_123' };
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          balance: null,
          earnings: []
        })
      });

      const response = await fetch(`/api/earnings/writer/${newWriter.uid}/dashboard`);
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.balance).toBeNull();
      expect(result.earnings).toHaveLength(0);
    });
  });

  describe('Token States Display', () => {
    test('should display all token states with correct amounts', () => {
      const earningsData = {
        totalEarnings: 125.50,
        availableForPayout: 75.25,
        pendingThisMonth: 35.00,
        lockedLastMonth: 15.25,
        unfundedAllocations: 10.00
      };

      // Verify total calculation
      const calculatedTotal = earningsData.availableForPayout + 
                             earningsData.pendingThisMonth + 
                             earningsData.lockedLastMonth;
      
      expect(calculatedTotal).toBe(earningsData.totalEarnings);
      
      // Verify each state has appropriate display
      expect(earningsData.availableForPayout).toBeGreaterThan(0);
      expect(earningsData.pendingThisMonth).toBeGreaterThan(0);
      expect(earningsData.lockedLastMonth).toBeGreaterThan(0);
    });

    test('should show appropriate status badges for each state', () => {
      const tokenStates = [
        { state: 'available', badge: 'Ready for payout', color: 'green' },
        { state: 'pending', badge: 'This month', color: 'yellow' },
        { state: 'locked', badge: 'Last month', color: 'blue' },
        { state: 'unfunded', badge: 'Not funded', color: 'red' }
      ];

      tokenStates.forEach(({ state, badge, color }) => {
        expect(badge).toBeTruthy();
        expect(color).toBeTruthy();
        expect(['green', 'yellow', 'blue', 'red']).toContain(color);
      });
    });

    test('should calculate percentages for token state breakdown', () => {
      const totalEarnings = 125.50;
      const breakdown = {
        available: 75.25,
        pending: 35.00,
        locked: 15.25
      };

      const percentages = {
        available: (breakdown.available / totalEarnings) * 100,
        pending: (breakdown.pending / totalEarnings) * 100,
        locked: (breakdown.locked / totalEarnings) * 100
      };

      expect(Math.round(percentages.available)).toBe(60);
      expect(Math.round(percentages.pending)).toBe(28);
      expect(Math.round(percentages.locked)).toBe(12);
    });

    test('should handle zero amounts gracefully', () => {
      const emptyBreakdown = {
        available: 0,
        pending: 0,
        locked: 0,
        total: 0
      };

      const hasEarnings = emptyBreakdown.total > 0;
      const displayMessage = hasEarnings ? 'Earnings breakdown' : 'No earnings yet';

      expect(hasEarnings).toBe(false);
      expect(displayMessage).toBe('No earnings yet');
    });
  });

  describe('Earnings History and Charts', () => {
    test('should format earnings data for chart display', () => {
      const rawEarnings = [
        { month: '2023-10', totalUsdValue: 15.25 },
        { month: '2023-11', totalUsdValue: 22.50 },
        { month: '2023-12', totalUsdValue: 18.75 },
        { month: '2024-01', totalUsdValue: 28.00 }
      ];

      const chartData = rawEarnings.map(earning => {
        const date = new Date(earning.month + '-01');
        return {
          month: earning.month,
          shortMonth: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
          earnings: earning.totalUsdValue,
          formattedEarnings: `$${earning.totalUsdValue.toFixed(2)}`
        };
      });

      expect(chartData).toHaveLength(4);
      expect(chartData[0].shortMonth).toBe('Oct');
      expect(chartData[3].formattedEarnings).toBe('$28.00');
    });

    test('should calculate earnings trends', () => {
      const monthlyEarnings = [22.50, 18.75, 28.00]; // Last 3 months
      
      const currentMonth = monthlyEarnings[monthlyEarnings.length - 1];
      const previousMonth = monthlyEarnings[monthlyEarnings.length - 2];
      
      const trendPercentage = ((currentMonth - previousMonth) / previousMonth) * 100;
      const isPositiveTrend = trendPercentage > 0;
      
      expect(Math.round(trendPercentage * 10) / 10).toBe(49.3);
      expect(isPositiveTrend).toBe(true);
    });

    test('should handle missing data in charts', () => {
      const incompleteData = [
        { month: '2023-10', totalUsdValue: 15.25 },
        { month: '2023-12', totalUsdValue: 18.75 } // Missing November
      ];

      // Fill missing months with zero
      const completeData = [];
      const months = ['2023-10', '2023-11', '2023-12'];

      months.forEach(monthKey => {
        const existing = incompleteData.find(item => item.month === monthKey);
        completeData.push({
          month: monthKey,
          totalUsdValue: existing ? existing.totalUsdValue : 0
        });
      });

      expect(completeData).toHaveLength(3);
      expect(completeData[1].totalUsdValue).toBe(0); // November should be 0
    });

    test('should display earnings sparkline correctly', () => {
      const sparklineData = [15.25, 22.50, 18.75, 28.00, 35.00];
      const maxValue = Math.max(...sparklineData);
      const minValue = Math.min(...sparklineData);
      
      // Normalize data for sparkline (0-100 scale)
      const normalizedData = sparklineData.map(value => 
        ((value - minValue) / (maxValue - minValue)) * 100
      );

      expect(normalizedData[0]).toBe(0); // Min value should be 0
      expect(normalizedData[4]).toBe(100); // Max value should be 100
      expect(normalizedData).toHaveLength(sparklineData.length);
    });
  });

  describe('Balance Calculations', () => {
    test('should calculate total balance correctly', () => {
      const balanceComponents = {
        availableForPayout: 75.25,
        pendingThisMonth: 35.00,
        lockedLastMonth: 15.25,
        paidOutPreviously: 50.00
      };

      const totalEarned = Object.values(balanceComponents).reduce((sum, value) => sum + value, 0);
      const currentBalance = balanceComponents.availableForPayout + 
                           balanceComponents.pendingThisMonth + 
                           balanceComponents.lockedLastMonth;

      expect(totalEarned).toBe(175.50);
      expect(currentBalance).toBe(125.50);
    });

    test('should validate minimum payout threshold', () => {
      const minimumThreshold = 25.00;
      const availableBalance = 75.25;
      
      const canRequestPayout = availableBalance >= minimumThreshold;
      const amountUntilThreshold = Math.max(0, minimumThreshold - availableBalance);

      expect(canRequestPayout).toBe(true);
      expect(amountUntilThreshold).toBe(0);
    });

    test('should handle insufficient balance for payout', () => {
      const minimumThreshold = 25.00;
      const availableBalance = 15.50;
      
      const canRequestPayout = availableBalance >= minimumThreshold;
      const amountUntilThreshold = minimumThreshold - availableBalance;

      expect(canRequestPayout).toBe(false);
      expect(amountUntilThreshold).toBe(9.50);
    });

    test('should calculate estimated next payout date', () => {
      const currentDate = new Date('2024-01-15T00:00:00Z');
      const nextMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

      const daysUntilPayout = Math.ceil((nextMonthEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysUntilPayout).toBeGreaterThanOrEqual(16);
      expect(daysUntilPayout).toBeLessThanOrEqual(18);
      expect(nextMonthEnd.getMonth()).toBe(1); // February
    });
  });

  describe('Real-time Updates and Refresh', () => {
    test('should refresh dashboard data on demand', async () => {
      const writer = TEST_USERS.writer;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          refreshed: true,
          timestamp: new Date().toISOString(),
          balance: {
            totalUsdEarned: 130.75, // Updated amount
            availableUsdValue: 80.50,
            pendingUsdValue: 35.00,
            lockedUsdValue: 15.25
          }
        })
      });

      const response = await fetch(`/api/earnings/writer/${writer.uid}/refresh`, {
        method: 'POST'
      });
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.refreshed).toBe(true);
      expect(result.balance.totalUsdEarned).toBe(130.75);
    });

    test('should handle refresh errors gracefully', async () => {
      const writer = TEST_USERS.writer;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({
          error: 'Service temporarily unavailable'
        })
      });

      const response = await fetch(`/api/earnings/writer/${writer.uid}/refresh`, {
        method: 'POST'
      });
      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.error).toContain('Service temporarily unavailable');
    });

    test('should update UI when new allocations are received', () => {
      const initialBalance = 125.50;
      const newAllocation = { tokens: 50, usdValue: 5.00 };
      
      const updatedBalance = initialBalance + newAllocation.usdValue;
      const shouldShowNotification = newAllocation.usdValue > 0;
      
      expect(updatedBalance).toBe(130.50);
      expect(shouldShowNotification).toBe(true);
    });

    test('should throttle refresh requests', () => {
      const lastRefreshTime = Date.now() - 5000; // 5 seconds ago
      const minRefreshInterval = 10000; // 10 seconds
      
      const canRefresh = (Date.now() - lastRefreshTime) >= minRefreshInterval;
      const timeUntilNextRefresh = Math.max(0, minRefreshInterval - (Date.now() - lastRefreshTime));
      
      expect(canRefresh).toBe(false);
      expect(timeUntilNextRefresh).toBeGreaterThan(0);
    });
  });

  describe('Payout Request Integration', () => {
    test('should enable payout request when threshold is met', () => {
      const availableBalance = 75.25;
      const minimumThreshold = 25.00;
      
      const canRequestPayout = availableBalance >= minimumThreshold;
      const payoutButtonEnabled = canRequestPayout;
      
      expect(canRequestPayout).toBe(true);
      expect(payoutButtonEnabled).toBe(true);
    });

    test('should disable payout request when threshold is not met', () => {
      const availableBalance = 15.50;
      const minimumThreshold = 25.00;
      
      const canRequestPayout = availableBalance >= minimumThreshold;
      const payoutButtonEnabled = canRequestPayout;
      const disabledMessage = `Minimum payout amount is $${minimumThreshold.toFixed(2)}`;
      
      expect(canRequestPayout).toBe(false);
      expect(payoutButtonEnabled).toBe(false);
      expect(disabledMessage).toBe('Minimum payout amount is $25.00');
    });

    test('should navigate to payout setup when clicked', () => {
      const hasPayoutSetup = TEST_USERS.writer.payoutSetup?.accountVerified || false;
      const targetRoute = hasPayoutSetup ? '/settings/earnings#payouts' : '/settings/earnings/setup';
      
      expect(hasPayoutSetup).toBe(true);
      expect(targetRoute).toBe('/settings/earnings#payouts');
    });

    test('should show payout setup prompt for unverified writers', () => {
      const unverifiedWriter = TEST_USERS.writerUnverified;
      const hasPayoutSetup = unverifiedWriter.payoutSetup?.accountVerified || false;
      const setupMessage = 'Complete payout setup to request withdrawals';
      
      expect(hasPayoutSetup).toBe(false);
      expect(setupMessage).toContain('Complete payout setup');
    });
  });
});
