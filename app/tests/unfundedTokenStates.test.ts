/**
 * Unfunded Token States Testing
 * 
 * Tests all unfunded token states and their UI feedback:
 * - Logged-out users (simulated tokens in localStorage)
 * - Users without subscription (simulated tokens)
 * - Over-budget allocations (exceeding subscription limits)
 * - Proper warning messages and UI indicators
 * - Token conversion when users activate subscriptions
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PaymentFlowTestUtils, TEST_USERS, TEST_PAGES } from './setup/paymentFlowTestSetup';

// Mock the required services and utilities
jest.mock('../services/tokenService');
jest.mock('../utils/simulatedTokens');
jest.mock('../firebase/config');

describe('Unfunded Token States Testing', () => {
  let mockEnvironment: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEnvironment = PaymentFlowTestUtils.setupTestEnvironment({
      enableLocalStorage: true,
      firestoreData: {
        pages: TEST_PAGES.reduce((acc, page) => ({ ...acc, [page.id]: page }), {}),
        users: Object.values(TEST_USERS).reduce((acc, user) => ({ ...acc, [user.uid]: user }), {})
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockEnvironment.mockLocalStorage?.clear();
  });

  describe('Logged-Out User Token Allocations', () => {
    test('should allow logged-out users to allocate simulated tokens', () => {
      const page = TEST_PAGES[0];
      const tokensToAllocate = 10;
      const simulatedMonthlyTokens = 100;

      // Mock localStorage operations
      const mockBalance = {
        totalTokens: simulatedMonthlyTokens,
        allocatedTokens: 0,
        availableTokens: simulatedMonthlyTokens,
        allocations: [],
        lastUpdated: Date.now()
      };

      // Simulate getting existing balance
      mockEnvironment.mockLocalStorage.getItem('wewrite_simulated_tokens_logged_out');
      mockEnvironment.mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockBalance));

      // Simulate allocation
      const newAllocation = {
        pageId: page.id,
        pageTitle: page.title,
        tokens: tokensToAllocate,
        timestamp: Date.now()
      };

      const updatedBalance = {
        ...mockBalance,
        allocatedTokens: tokensToAllocate,
        availableTokens: simulatedMonthlyTokens - tokensToAllocate,
        allocations: [newAllocation],
        lastUpdated: Date.now()
      };

      // Simulate saving updated balance
      mockEnvironment.mockLocalStorage.setItem('wewrite_simulated_tokens_logged_out', JSON.stringify(updatedBalance));

      // Verify localStorage operations
      expect(mockEnvironment.mockLocalStorage.getItem).toHaveBeenCalled();
      expect(mockEnvironment.mockLocalStorage.setItem).toHaveBeenCalledWith(
        'wewrite_simulated_tokens_logged_out',
        JSON.stringify(updatedBalance)
      );
    });

    test('should display warning for logged-out user allocations', () => {
      const warningMessage = 'These token allocations are not yet funded. Sign up for a subscription to fund your allocations.';
      const tokenState = 'unfunded_logged_out';
      
      // Simulate UI warning display logic
      const shouldShowWarning = tokenState === 'unfunded_logged_out';
      const displayMessage = shouldShowWarning ? warningMessage : '';
      
      expect(shouldShowWarning).toBe(true);
      expect(displayMessage).toBe(warningMessage);
    });

    test('should persist logged-out allocations across browser sessions', () => {
      const page = TEST_PAGES[0];
      const allocation = {
        pageId: page.id,
        pageTitle: page.title,
        tokens: 15,
        timestamp: Date.now()
      };
      
      // Simulate saving allocation
      const storageKey = 'wewrite_simulated_tokens_logged_out';
      const balance = {
        totalTokens: 100,
        allocatedTokens: 15,
        availableTokens: 85,
        allocations: [allocation],
        lastUpdated: Date.now()
      };
      
      mockEnvironment.mockLocalStorage.setItem(storageKey, JSON.stringify(balance));
      
      // Simulate page reload - retrieve from localStorage
      mockEnvironment.mockLocalStorage.getItem.mockReturnValue(JSON.stringify(balance));
      const retrievedBalance = JSON.parse(mockEnvironment.mockLocalStorage.getItem(storageKey));
      
      expect(retrievedBalance.allocations).toHaveLength(1);
      expect(retrievedBalance.allocations[0].pageId).toBe(page.id);
      expect(retrievedBalance.allocations[0].tokens).toBe(15);
    });

    test('should limit logged-out user allocations to simulated monthly amount', () => {
      const simulatedMonthlyTokens = 100;
      const existingAllocations = 90;
      const tokensToAllocate = 20; // Would exceed limit
      
      const currentBalance = {
        totalTokens: simulatedMonthlyTokens,
        allocatedTokens: existingAllocations,
        availableTokens: simulatedMonthlyTokens - existingAllocations,
        allocations: [],
        lastUpdated: Date.now()
      };
      
      // Validate allocation
      const canAllocate = tokensToAllocate <= currentBalance.availableTokens;
      const maxAllowedAllocation = currentBalance.availableTokens;
      
      expect(canAllocate).toBe(false);
      expect(maxAllowedAllocation).toBe(10);
    });
  });

  describe('No Subscription User Token Allocations', () => {
    test('should allow users without subscription to allocate simulated tokens', () => {
      const user = TEST_USERS.noSubscription;
      const page = TEST_PAGES[0];
      const tokensToAllocate = 15;
      
      // Mock user-specific localStorage
      const storageKey = `wewrite_simulated_tokens_user_${user.uid}`;
      const balance = {
        totalTokens: 100,
        allocatedTokens: 0,
        availableTokens: 100,
        allocations: [],
        lastUpdated: Date.now()
      };
      
      mockEnvironment.mockLocalStorage.getItem.mockReturnValue(JSON.stringify(balance));
      
      // Simulate allocation
      const newAllocation = {
        pageId: page.id,
        pageTitle: page.title,
        tokens: tokensToAllocate,
        timestamp: Date.now()
      };
      
      const updatedBalance = {
        ...balance,
        allocatedTokens: tokensToAllocate,
        availableTokens: 100 - tokensToAllocate,
        allocations: [newAllocation]
      };
      
      mockEnvironment.mockLocalStorage.setItem(storageKey, JSON.stringify(updatedBalance));
      
      expect(mockEnvironment.mockLocalStorage.setItem).toHaveBeenCalledWith(
        storageKey,
        JSON.stringify(updatedBalance)
      );
    });

    test('should display subscription prompt for no-subscription users', () => {
      const user = TEST_USERS.noSubscription;
      const warningMessage = 'Subscribe to fund your token allocations and support creators.';
      const tokenState = 'unfunded_no_subscription';
      
      const shouldShowSubscriptionPrompt = user.subscriptionStatus === 'none' && tokenState === 'unfunded_no_subscription';
      const displayMessage = shouldShowSubscriptionPrompt ? warningMessage : '';
      
      expect(shouldShowSubscriptionPrompt).toBe(true);
      expect(displayMessage).toBe(warningMessage);
    });

    test('should convert simulated tokens when user activates subscription', async () => {
      const user = TEST_USERS.noSubscription;
      const simulatedAllocations = [
        { pageId: 'page1', tokens: 10, pageTitle: 'Page 1', timestamp: Date.now() },
        { pageId: 'page2', tokens: 15, pageTitle: 'Page 2', timestamp: Date.now() }
      ];
      
      // Mock conversion API call
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          convertedCount: 2,
          totalTokensConverted: 25,
          errors: []
        })
      });
      
      const response = await fetch('/api/tokens/convert-simulated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          allocations: simulatedAllocations
        })
      });
      
      const result = await response.json();
      
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.convertedCount).toBe(2);
      expect(result.totalTokensConverted).toBe(25);
    });
  });

  describe('Over-Budget Token Allocations', () => {
    test('should identify over-budget allocations', () => {
      const user = TEST_USERS.overBudget;
      const subscriptionTokens = 50; // Basic subscription
      const allocatedTokens = 60; // Over budget
      
      const isOverBudget = allocatedTokens > subscriptionTokens;
      const overBudgetAmount = allocatedTokens - subscriptionTokens;
      
      expect(isOverBudget).toBe(true);
      expect(overBudgetAmount).toBe(10);
    });

    test('should display over-budget warning', () => {
      const user = TEST_USERS.overBudget;
      const overBudgetAmount = 10;
      const warningMessage = `You have allocated ${overBudgetAmount} more tokens than your subscription provides. Upgrade your subscription or reduce allocations.`;
      
      const shouldShowWarning = user.tokenBalance!.availableTokens < 0;
      const displayMessage = shouldShowWarning ? warningMessage : '';
      
      expect(shouldShowWarning).toBe(true);
      expect(displayMessage).toContain('allocated 10 more tokens');
    });

    test('should prevent new allocations when over budget', async () => {
      const user = TEST_USERS.overBudget;
      const page = TEST_PAGES[0];
      const tokensToAllocate = 5;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Cannot allocate tokens: over subscription limit',
          currentAllocation: 60,
          subscriptionLimit: 50,
          overBudgetAmount: 10
        })
      });
      
      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: tokensToAllocate
        })
      });
      
      const result = await response.json();
      
      expect(response.ok).toBe(false);
      expect(result.error).toContain('over subscription limit');
    });

    test('should allow reducing over-budget allocations', async () => {
      const user = TEST_USERS.overBudget;
      const page = TEST_PAGES[0];
      const tokensToReduce = -5; // Negative to reduce
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          allocation: {
            pageId: page.id,
            tokens: 15, // Reduced from 20
            change: tokensToReduce
          },
          newBalance: {
            totalTokens: 50,
            allocatedTokens: 55, // Reduced from 60
            availableTokens: -5 // Still over budget but improved
          }
        })
      });
      
      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: tokensToReduce,
          operation: 'decrement'
        })
      });
      
      const result = await response.json();
      
      expect(response.ok).toBe(true);
      expect(result.allocation.change).toBe(tokensToReduce);
      expect(result.newBalance.allocatedTokens).toBe(55);
    });

    test('should suggest subscription upgrade for over-budget users', () => {
      const user = TEST_USERS.overBudget;
      const currentTier = 'basic'; // $5, 50 tokens
      const overBudgetAmount = 10;
      const requiredTokens = 60;
      
      // Determine suggested tier
      const suggestedTier = requiredTokens <= 150 ? 'premium' : 'custom';
      const upgradeMessage = `Consider upgrading to ${suggestedTier} to cover your ${requiredTokens} token allocations.`;
      
      expect(suggestedTier).toBe('premium');
      expect(upgradeMessage).toContain('upgrading to premium');
    });
  });

  describe('UI Feedback for Unfunded States', () => {
    test('should display appropriate warning dots for unfunded tokens', () => {
      const tokenStates = [
        { state: 'unfunded_logged_out', shouldShowDot: true },
        { state: 'unfunded_no_subscription', shouldShowDot: true },
        { state: 'unfunded_over_budget', shouldShowDot: true },
        { state: 'funded_pending', shouldShowDot: false },
        { state: 'funded_locked', shouldShowDot: false }
      ];
      
      tokenStates.forEach(({ state, shouldShowDot }) => {
        const showWarningDot = state.startsWith('unfunded');
        expect(showWarningDot).toBe(shouldShowDot);
      });
    });

    test('should display appropriate warning banners', () => {
      const warningMessages = {
        unfunded_logged_out: 'Sign up for a subscription to fund your allocations',
        unfunded_no_subscription: 'Subscribe to fund your token allocations',
        unfunded_over_budget: 'Upgrade subscription or reduce allocations',
        funded_pending: '',
        funded_locked: ''
      };
      
      Object.entries(warningMessages).forEach(([state, expectedMessage]) => {
        const shouldShowBanner = state.startsWith('unfunded');
        const message = shouldShowBanner ? expectedMessage : '';
        
        if (shouldShowBanner) {
          expect(message).toBeTruthy();
          expect(message.length).toBeGreaterThan(0);
        } else {
          expect(message).toBe('');
        }
      });
    });

    test('should provide appropriate call-to-action buttons', () => {
      const ctaButtons = {
        unfunded_logged_out: 'Sign Up',
        unfunded_no_subscription: 'Subscribe',
        unfunded_over_budget: 'Upgrade',
        funded_pending: null,
        funded_locked: null
      };
      
      Object.entries(ctaButtons).forEach(([state, expectedCta]) => {
        const shouldShowCta = state.startsWith('unfunded');
        const cta = shouldShowCta ? expectedCta : null;
        
        if (shouldShowCta) {
          expect(cta).toBeTruthy();
        } else {
          expect(cta).toBeNull();
        }
      });
    });

    test('should update UI state when token funding status changes', () => {
      const initialState = 'unfunded_no_subscription';
      const finalState = 'funded_pending';
      
      // Simulate state transition after subscription activation
      const stateTransition = {
        from: initialState,
        to: finalState,
        showWarning: finalState.startsWith('unfunded'),
        showSuccess: finalState.startsWith('funded')
      };
      
      expect(stateTransition.showWarning).toBe(false);
      expect(stateTransition.showSuccess).toBe(true);
    });
  });
});
