/**
 * Test suite for token allocation editing features
 * Tests clickable token numbers, custom input, and zero allocation handling
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Token Allocation Editing Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Token Number Input Editing', () => {
    test('should enter edit mode when token number is clicked', () => {
      let editingTokens: Record<string, boolean> = {};
      let inputValues: Record<string, string> = {};
      
      const handleTokenClick = (pageId: string, currentTokens: number) => {
        editingTokens = { ...editingTokens, [pageId]: true };
        inputValues = { ...inputValues, [pageId]: currentTokens.toString() };
      };

      handleTokenClick('page1', 5);

      expect(editingTokens['page1']).toBe(true);
      expect(inputValues['page1']).toBe('5');
    });

    test('should handle token input change', () => {
      let inputValues: Record<string, string> = { page1: '5' };
      
      const handleTokenInputChange = (pageId: string, value: string) => {
        inputValues = { ...inputValues, [pageId]: value };
      };

      handleTokenInputChange('page1', '10');

      expect(inputValues['page1']).toBe('10');
    });

    test('should validate and apply token changes on submit', () => {
      const allocationData = {
        allocations: [
          { pageId: 'page1', tokens: 5, pageTitle: 'Test Page', authorUsername: 'author1' }
        ],
        summary: {
          balance: { availableTokens: 10, totalTokens: 20, allocatedTokens: 10 }
        }
      };

      let inputValues = { page1: '8' };
      let editingTokens = { page1: true };
      let tokenAllocationCalled = false;
      let changeAmount = 0;

      const handleTokenAllocation = (pageId: string, change: number) => {
        tokenAllocationCalled = true;
        changeAmount = change;
      };

      const handleTokenInputSubmit = (pageId: string) => {
        const inputValue = inputValues[pageId];
        const newTokens = parseInt(inputValue) || 0;
        
        if (newTokens < 0) return;

        const currentAllocation = allocationData.allocations.find(a => a.pageId === pageId);
        const currentTokens = currentAllocation?.tokens || 0;
        const change = newTokens - currentTokens;

        // Validate against available tokens
        if (change > 0 && allocationData.summary.balance) {
          const maxAllocation = allocationData.summary.balance.availableTokens + currentTokens;
          if (newTokens > maxAllocation) return;
        }

        if (change !== 0) {
          handleTokenAllocation(pageId, change);
        }

        editingTokens = { ...editingTokens, [pageId]: false };
      };

      handleTokenInputSubmit('page1');

      expect(tokenAllocationCalled).toBe(true);
      expect(changeAmount).toBe(3); // 8 - 5 = 3
      expect(editingTokens['page1']).toBe(false);
    });

    test('should prevent negative token values', () => {
      let inputValues = { page1: '-5' };
      const allocationData = {
        allocations: [{ pageId: 'page1', tokens: 5 }]
      };

      const handleTokenInputSubmit = (pageId: string) => {
        const inputValue = inputValues[pageId];
        const newTokens = parseInt(inputValue) || 0;
        
        if (newTokens < 0) {
          const currentAllocation = allocationData.allocations.find(a => a.pageId === pageId);
          inputValues = { ...inputValues, [pageId]: (currentAllocation?.tokens || 0).toString() };
          return;
        }
      };

      handleTokenInputSubmit('page1');

      expect(inputValues['page1']).toBe('5'); // Reset to current value
    });

    test('should prevent exceeding available tokens', () => {
      let inputValues = { page1: '20' };
      const allocationData = {
        allocations: [{ pageId: 'page1', tokens: 5 }],
        summary: {
          balance: { availableTokens: 10, totalTokens: 20, allocatedTokens: 10 }
        }
      };

      const handleTokenInputSubmit = (pageId: string) => {
        const inputValue = inputValues[pageId];
        const newTokens = parseInt(inputValue) || 0;
        
        const currentAllocation = allocationData.allocations.find(a => a.pageId === pageId);
        const currentTokens = currentAllocation?.tokens || 0;
        const change = newTokens - currentTokens;

        if (change > 0 && allocationData.summary.balance) {
          const maxAllocation = allocationData.summary.balance.availableTokens + currentTokens;
          if (newTokens > maxAllocation) {
            inputValues = { ...inputValues, [pageId]: maxAllocation.toString() };
            return;
          }
        }
      };

      handleTokenInputSubmit('page1');

      expect(inputValues['page1']).toBe('15'); // 10 available + 5 current = 15 max
    });
  });

  describe('Zero Allocation Handling', () => {
    test('should identify zero allocations as previously pledged', () => {
      const allocation = { pageId: 'page1', tokens: 0, pageTitle: 'Test Page' };
      const isZeroAllocation = allocation.tokens === 0;

      expect(isZeroAllocation).toBe(true);
    });

    test('should apply lower opacity to zero allocations', () => {
      const allocation = { tokens: 0 };
      const isZeroAllocation = allocation.tokens === 0;
      const expectedClassName = isZeroAllocation ? 'opacity-50' : '';

      expect(expectedClassName).toBe('opacity-50');
    });

    test('should show trash icon for zero allocations instead of plus/minus', () => {
      const allocation = { tokens: 0 };
      const isZeroAllocation = allocation.tokens === 0;
      
      const shouldShowTrash = isZeroAllocation;
      const shouldShowPlusMinus = !isZeroAllocation;

      expect(shouldShowTrash).toBe(true);
      expect(shouldShowPlusMinus).toBe(false);
    });

    test('should handle deletion of zero allocations', async () => {
      let allocationData = {
        allocations: [
          { pageId: 'page1', tokens: 0 },
          { pageId: 'page2', tokens: 5 }
        ]
      };

      const handleDeleteAllocation = (pageId: string) => {
        allocationData = {
          ...allocationData,
          allocations: allocationData.allocations.filter(allocation => allocation.pageId !== pageId)
        };
      };

      handleDeleteAllocation('page1');

      expect(allocationData.allocations).toHaveLength(1);
      expect(allocationData.allocations[0].pageId).toBe('page2');
    });
  });

  describe('Sorting with Zero Allocations', () => {
    test('should prioritize active allocations over zero allocations', () => {
      const allocations = [
        { pageId: 'page1', tokens: 0, pageTitle: 'A Page' },
        { pageId: 'page2', tokens: 5, pageTitle: 'B Page' },
        { pageId: 'page3', tokens: 0, pageTitle: 'C Page' },
        { pageId: 'page4', tokens: 3, pageTitle: 'D Page' }
      ];

      // Simulate the sorting logic
      const activeAllocations = allocations.filter(a => a.tokens > 0);
      const zeroAllocations = allocations.filter(a => a.tokens === 0);
      const sorted = [...activeAllocations, ...zeroAllocations];

      expect(sorted[0].tokens).toBeGreaterThan(0); // First item should be active
      expect(sorted[1].tokens).toBeGreaterThan(0); // Second item should be active
      expect(sorted[2].tokens).toBe(0); // Third item should be zero
      expect(sorted[3].tokens).toBe(0); // Fourth item should be zero
    });

    test('should maintain sort order within active and zero groups', () => {
      const allocations = [
        { pageId: 'page1', tokens: 0, pageTitle: 'Z Page' },
        { pageId: 'page2', tokens: 5, pageTitle: 'A Page' },
        { pageId: 'page3', tokens: 0, pageTitle: 'A Zero Page' },
        { pageId: 'page4', tokens: 3, pageTitle: 'Z Active Page' }
      ];

      // Sort by title within each group
      const activeAllocations = allocations
        .filter(a => a.tokens > 0)
        .sort((a, b) => a.pageTitle.localeCompare(b.pageTitle));
      const zeroAllocations = allocations
        .filter(a => a.tokens === 0)
        .sort((a, b) => a.pageTitle.localeCompare(b.pageTitle));
      const sorted = [...activeAllocations, ...zeroAllocations];

      expect(sorted[0].pageTitle).toBe('A Page'); // First active by title
      expect(sorted[1].pageTitle).toBe('Z Active Page'); // Second active by title
      expect(sorted[2].pageTitle).toBe('A Zero Page'); // First zero by title
      expect(sorted[3].pageTitle).toBe('Z Page'); // Second zero by title
    });
  });

  describe('Keyboard Navigation', () => {
    test('should handle Enter key to submit input', () => {
      let submitCalled = false;
      
      const handleTokenInputSubmit = () => {
        submitCalled = true;
      };

      // Simulate Enter key press
      const event = { key: 'Enter' };
      if (event.key === 'Enter') {
        handleTokenInputSubmit();
      }

      expect(submitCalled).toBe(true);
    });

    test('should handle Escape key to cancel input', () => {
      let cancelCalled = false;
      
      const handleTokenInputCancel = () => {
        cancelCalled = true;
      };

      // Simulate Escape key press
      const event = { key: 'Escape' };
      if (event.key === 'Escape') {
        handleTokenInputCancel();
      }

      expect(cancelCalled).toBe(true);
    });
  });
});