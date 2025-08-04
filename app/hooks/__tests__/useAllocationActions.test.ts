import { renderHook, act, waitFor } from '@testing-library/react';
import { useAllocationActions } from '../useAllocationActions';
import { allocationBatcher } from '../../utils/allocationBatching';
import { AllocationResponse } from '../../types/allocation';
import React from 'react';

// Mock dependencies
jest.mock('../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-id' }
  })
}));

jest.mock('../../contexts/UsdBalanceContext', () => ({
  useUsdBalance: () => ({
    usdBalance: {
      totalUsdCents: 10000,
      allocatedUsdCents: 5000
    },
    updateOptimisticBalance: jest.fn()
  })
}));

jest.mock('../../contexts/AllocationIntervalContext', () => ({
  useAllocationInterval: () => ({
    allocationIntervalCents: 100
  })
}));

jest.mock('../../components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

jest.mock('../../utils/allocationBatching', () => ({
  allocationBatcher: {
    batchRequest: jest.fn()
  }
}));

jest.mock('../../utils/usdNotifications', () => ({
  showUsdAllocationNotification: jest.fn()
}));

const mockBatchRequest = allocationBatcher.batchRequest as jest.MockedFunction<typeof allocationBatcher.batchRequest>;

describe('useAllocationActions', () => {
  const defaultProps = {
    pageId: 'test-page',
    authorId: 'author-id',
    pageTitle: 'Test Page',
    currentAllocationCents: 500,
    onAllocationChange: jest.fn(),
    onOptimisticUpdate: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useAllocationActions(defaultProps));

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.handleAllocationChange).toBe('function');
    expect(typeof result.current.handleDirectAllocation).toBe('function');
  });

  it('should handle allocation changes with batching', async () => {
    const mockResponse: AllocationResponse = {
      success: true,
      currentAllocation: 600
    };
    mockBatchRequest.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAllocationActions(defaultProps));

    // Trigger allocation change
    act(() => {
      result.current.handleAllocationChange(1, new MouseEvent('click'));
    });

    // Fast-forward timers to trigger batch processing
    act(() => {
      jest.advanceTimersByTime(300); // Default batch delay
    });

    await waitFor(() => {
      expect(mockBatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          pageId: 'test-page',
          changeCents: 100, // allocationIntervalCents
          source: 'FloatingBar'
        }),
        'normal'
      );
    });

    expect(defaultProps.onAllocationChange).toHaveBeenCalledWith(600);
  });

  it('should handle direct allocation with high priority', async () => {
    const mockResponse: AllocationResponse = {
      success: true,
      currentAllocation: 750
    };
    mockBatchRequest.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAllocationActions(defaultProps));

    await act(async () => {
      await result.current.handleDirectAllocation(250);
    });

    expect(mockBatchRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: 'test-page',
        changeCents: 250,
        source: 'FloatingBar'
      }),
      'high'
    );

    expect(defaultProps.onOptimisticUpdate).toHaveBeenCalledWith(750); // 500 + 250
    expect(defaultProps.onAllocationChange).toHaveBeenCalledWith(750);
  });

  it('should batch multiple rapid allocation changes', async () => {
    const mockResponse: AllocationResponse = {
      success: true,
      currentAllocation: 800
    };
    mockBatchRequest.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAllocationActions(defaultProps));

    // Trigger multiple rapid changes
    act(() => {
      result.current.handleAllocationChange(1, new MouseEvent('click'));
      result.current.handleAllocationChange(1, new MouseEvent('click'));
      result.current.handleAllocationChange(1, new MouseEvent('click'));
    });

    // Fast-forward timers
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockBatchRequest).toHaveBeenCalledTimes(1);
      expect(mockBatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          changeCents: 300 // 3 * 100
        }),
        'normal'
      );
    });
  });

  it('should handle negative allocation changes', async () => {
    const mockResponse: AllocationResponse = {
      success: true,
      currentAllocation: 400
    };
    mockBatchRequest.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAllocationActions(defaultProps));

    act(() => {
      result.current.handleAllocationChange(-1, new MouseEvent('click'));
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockBatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          changeCents: -100
        }),
        'normal'
      );
    });
  });

  it('should prevent allocation below zero', () => {
    const propsWithLowAllocation = {
      ...defaultProps,
      currentAllocationCents: 50 // Less than interval
    };

    const { result } = renderHook(() => useAllocationActions(propsWithLowAllocation));

    act(() => {
      result.current.handleAllocationChange(-1, new MouseEvent('click'));
    });

    // Should not trigger any batch request since it would go below zero
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockBatchRequest).not.toHaveBeenCalled();
  });

  it('should handle insufficient funds error', async () => {
    const mockError = new Error('Insufficient funds');
    mockBatchRequest.mockRejectedValue(mockError);

    const { result } = renderHook(() => useAllocationActions(defaultProps));

    act(() => {
      result.current.handleAllocationChange(1, new MouseEvent('click'));
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('should handle out of funds scenario', () => {
    const propsWithNoFunds = {
      ...defaultProps,
      currentAllocationCents: 5000 // Equal to allocated amount
    };

    const mockOnOutOfFunds = jest.fn();
    const { result } = renderHook(() => 
      useAllocationActions({
        ...propsWithNoFunds,
        onOutOfFunds: mockOnOutOfFunds
      })
    );

    act(() => {
      result.current.handleAllocationChange(1, new MouseEvent('click'));
    });

    expect(mockOnOutOfFunds).toHaveBeenCalled();
  });

  it('should clear pending batches on direct allocation', async () => {
    const mockResponse: AllocationResponse = {
      success: true,
      currentAllocation: 600
    };
    mockBatchRequest.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAllocationActions(defaultProps));

    // Start a batched change
    act(() => {
      result.current.handleAllocationChange(1, new MouseEvent('click'));
    });

    // Before batch processes, trigger direct allocation
    await act(async () => {
      await result.current.handleDirectAllocation(200);
    });

    // Fast-forward timers
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should only see the direct allocation call
    expect(mockBatchRequest).toHaveBeenCalledTimes(1);
    expect(mockBatchRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        changeCents: 200
      }),
      'high'
    );
  });

  it('should handle custom batch delay', async () => {
    const customProps = {
      ...defaultProps,
      batchDelayMs: 500
    };

    const { result } = renderHook(() => useAllocationActions(customProps));

    act(() => {
      result.current.handleAllocationChange(1, new MouseEvent('click'));
    });

    // Should not trigger at default delay
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockBatchRequest).not.toHaveBeenCalled();

    // Should trigger at custom delay
    act(() => {
      jest.advanceTimersByTime(200); // Total 500ms
    });

    await waitFor(() => {
      expect(mockBatchRequest).toHaveBeenCalled();
    });
  });
});
