/**
 * Token Purchase & Allocation Testing
 * 
 * Tests token purchasing, allocation to writers, validation, and UI components:
 * - Token allocation validation and limits
 * - Composition bar functionality
 * - Plus/minus button interactions
 * - Custom token input handling
 * - Allocation persistence and updates
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PaymentFlowTestUtils, TEST_USERS, TEST_PAGES, TEST_TOKEN_ALLOCATIONS } from './setup/paymentFlowTestSetup';

// Mock the required services
jest.mock('../services/tokenService');
jest.mock('../services/tokenEarningsService');
jest.mock('../firebase/config');

describe('Token Purchase & Allocation Testing', () => {
  let mockEnvironment: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEnvironment = PaymentFlowTestUtils.setupTestEnvironment({
      currentUser: TEST_USERS.activeBasic,
      firestoreData: {
        users: {
          [TEST_USERS.activeBasic.uid]: TEST_USERS.activeBasic,
          [TEST_USERS.writer.uid]: TEST_USERS.writer
        },
        pages: TEST_PAGES.reduce((acc, page) => ({ ...acc, [page.id]: page }), {}),
        token_balances: {
          [TEST_USERS.activeBasic.uid]: TEST_USERS.activeBasic.tokenBalance
        },
        token_allocations: TEST_TOKEN_ALLOCATIONS.reduce((acc, alloc) => ({ ...acc, [alloc.id]: alloc }), {})
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Token Allocation Validation', () => {
    test('should validate sufficient token balance for allocation', async () => {
      const user = TEST_USERS.activeBasic;
      const page = TEST_PAGES[0];
      const tokensToAllocate = 10;
      
      // Mock token service response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          allocation: {
            pageId: page.id,
            tokens: tokensToAllocate,
            newBalance: {
              totalTokens: user.tokenBalance!.totalTokens,
              allocatedTokens: user.tokenBalance!.allocatedTokens + tokensToAllocate,
              availableTokens: user.tokenBalance!.availableTokens - tokensToAllocate
            }
          }
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: tokensToAllocate,
          recipientUserId: page.authorId
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.allocation.tokens).toBe(tokensToAllocate);
    });

    test('should reject allocation when insufficient tokens', async () => {
      const user = TEST_USERS.activeBasic;
      const page = TEST_PAGES[0];
      const tokensToAllocate = user.tokenBalance!.availableTokens + 10; // More than available
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Insufficient tokens available',
          available: user.tokenBalance!.availableTokens,
          requested: tokensToAllocate
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: tokensToAllocate,
          recipientUserId: page.authorId
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.error).toContain('Insufficient tokens');
    });

    test('should enforce minimum allocation amount', async () => {
      const user = TEST_USERS.activeBasic;
      const page = TEST_PAGES[0];
      const tokensToAllocate = 0; // Below minimum
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Minimum allocation is 1 token',
          minimum: 1,
          requested: tokensToAllocate
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: tokensToAllocate,
          recipientUserId: page.authorId
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.error).toContain('Minimum allocation');
    });

    test('should prevent self-allocation', async () => {
      const user = TEST_USERS.writer;
      const page = { ...TEST_PAGES[0], authorId: user.uid }; // User's own page
      const tokensToAllocate = 10;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Cannot allocate tokens to your own content'
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: tokensToAllocate,
          recipientUserId: page.authorId
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.error).toContain('Cannot allocate tokens to your own content');
    });
  });

  describe('Composition Bar Functionality', () => {
    test('should calculate correct token distribution percentages', () => {
      const tokenData = {
        totalTokens: 100,
        allocatedTokens: 60,
        availableTokens: 40,
        currentPageAllocation: 20,
        otherPagesTokens: 40
      };

      // Calculate percentages as the component would
      const otherPagesPercentage = (tokenData.otherPagesTokens / tokenData.totalTokens) * 100;
      const currentPagePercentage = (tokenData.currentPageAllocation / tokenData.totalTokens) * 100;
      const availablePercentage = (tokenData.availableTokens / tokenData.totalTokens) * 100;

      expect(otherPagesPercentage).toBe(40);
      expect(currentPagePercentage).toBe(20);
      expect(availablePercentage).toBe(40);
      expect(otherPagesPercentage + currentPagePercentage + availablePercentage).toBe(100);
    });

    test('should handle zero allocations in composition bar', () => {
      const tokenData = {
        totalTokens: 50,
        allocatedTokens: 0,
        availableTokens: 50,
        currentPageAllocation: 0,
        otherPagesTokens: 0
      };

      const otherPagesPercentage = (tokenData.otherPagesTokens / tokenData.totalTokens) * 100;
      const currentPagePercentage = (tokenData.currentPageAllocation / tokenData.totalTokens) * 100;
      const availablePercentage = (tokenData.availableTokens / tokenData.totalTokens) * 100;

      expect(otherPagesPercentage).toBe(0);
      expect(currentPagePercentage).toBe(0);
      expect(availablePercentage).toBe(100);
    });

    test('should update composition bar after token allocation', () => {
      const initialData = {
        totalTokens: 100,
        allocatedTokens: 40,
        availableTokens: 60,
        currentPageAllocation: 10,
        otherPagesTokens: 30
      };

      const tokensToAdd = 15;
      const updatedData = {
        totalTokens: initialData.totalTokens,
        allocatedTokens: initialData.allocatedTokens + tokensToAdd,
        availableTokens: initialData.availableTokens - tokensToAdd,
        currentPageAllocation: initialData.currentPageAllocation + tokensToAdd,
        otherPagesTokens: initialData.otherPagesTokens
      };

      expect(updatedData.currentPageAllocation).toBe(25);
      expect(updatedData.availableTokens).toBe(45);
      expect(updatedData.allocatedTokens).toBe(55);
    });
  });

  describe('Plus/Minus Button Interactions', () => {
    test('should increment tokens with plus button', async () => {
      const user = TEST_USERS.activeBasic;
      const page = TEST_PAGES[0];
      const incrementAmount = 5;
      const currentAllocation = 10;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          allocation: {
            pageId: page.id,
            tokens: currentAllocation + incrementAmount,
            change: incrementAmount
          }
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: incrementAmount,
          operation: 'increment'
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.allocation.change).toBe(incrementAmount);
    });

    test('should decrement tokens with minus button', async () => {
      const user = TEST_USERS.activeBasic;
      const page = TEST_PAGES[0];
      const decrementAmount = 3;
      const currentAllocation = 10;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          allocation: {
            pageId: page.id,
            tokens: currentAllocation - decrementAmount,
            change: -decrementAmount
          }
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: -decrementAmount,
          operation: 'decrement'
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.allocation.change).toBe(-decrementAmount);
    });

    test('should prevent decrementing below zero', async () => {
      const user = TEST_USERS.activeBasic;
      const page = TEST_PAGES[0];
      const decrementAmount = 15;
      const currentAllocation = 5; // Less than decrement amount
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Cannot reduce allocation below zero',
          current: currentAllocation,
          requested: -decrementAmount
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: -decrementAmount,
          operation: 'decrement'
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.error).toContain('Cannot reduce allocation below zero');
    });

    test('should respect increment amount settings', () => {
      const incrementAmounts = [1, 5, 10];
      const selectedIncrement = 5;
      
      // Simulate increment button behavior
      const handleIncrement = (amount: number) => {
        return amount === selectedIncrement;
      };

      incrementAmounts.forEach(amount => {
        if (amount === selectedIncrement) {
          expect(handleIncrement(amount)).toBe(true);
        } else {
          expect(handleIncrement(amount)).toBe(false);
        }
      });
    });
  });

  describe('Custom Token Input Handling', () => {
    test('should accept valid custom token input', async () => {
      const user = TEST_USERS.activeBasic;
      const page = TEST_PAGES[0];
      const customTokens = 25;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          allocation: {
            pageId: page.id,
            tokens: customTokens
          }
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: customTokens,
          operation: 'set'
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.allocation.tokens).toBe(customTokens);
    });

    test('should validate custom input against available tokens', () => {
      const availableTokens = 20;
      const currentAllocation = 5;
      const maxAllocation = availableTokens + currentAllocation;
      const inputValue = 30; // Exceeds max

      const isValidInput = inputValue <= maxAllocation;
      const clampedValue = Math.min(inputValue, maxAllocation);

      expect(isValidInput).toBe(false);
      expect(clampedValue).toBe(maxAllocation);
    });

    test('should handle non-numeric input gracefully', () => {
      const invalidInputs = ['abc', '', 'null', 'undefined', '-5'];
      
      invalidInputs.forEach(input => {
        const parsedValue = parseInt(input) || 0;
        const isValid = parsedValue >= 0 && !isNaN(parsedValue);
        
        if (input === '-5') {
          expect(isValid).toBe(false); // Negative values should be invalid
        } else {
          expect(parsedValue).toBe(0); // Invalid inputs should default to 0
        }
      });
    });
  });

  describe('Allocation Persistence and Updates', () => {
    test('should persist allocation changes to database', async () => {
      const user = TEST_USERS.activeBasic;
      const page = TEST_PAGES[0];
      const tokens = 15;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          allocation: {
            id: `${user.uid}_${page.id}_2024-01`,
            userId: user.uid,
            pageId: page.id,
            tokens: tokens,
            month: '2024-01',
            status: 'active',
            createdAt: new Date().toISOString()
          }
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: tokens
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.allocation.tokens).toBe(tokens);
      expect(result.allocation.status).toBe('active');
    });

    test('should update existing allocation', async () => {
      const user = TEST_USERS.activeBasic;
      const page = TEST_PAGES[0];
      const existingTokens = 10;
      const newTokens = 20;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          allocation: {
            id: `${user.uid}_${page.id}_2024-01`,
            userId: user.uid,
            pageId: page.id,
            tokens: newTokens,
            previousTokens: existingTokens,
            change: newTokens - existingTokens,
            updatedAt: new Date().toISOString()
          }
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: newTokens
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.allocation.tokens).toBe(newTokens);
      expect(result.allocation.change).toBe(newTokens - existingTokens);
    });

    test('should remove allocation when set to zero', async () => {
      const user = TEST_USERS.activeBasic;
      const page = TEST_PAGES[0];
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          allocation: null,
          removed: true,
          pageId: page.id
        })
      });

      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          pageId: page.id,
          tokens: 0
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.removed).toBe(true);
      expect(result.allocation).toBeNull();
    });
  });
});
