import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAllocationState } from '../useAllocationState';
import { usePageAllocation } from '../useAllocationQueries';
import React from 'react';

// Mock the usePageAllocation hook
jest.mock('../useAllocationQueries', () => ({
  usePageAllocation: jest.fn()
}));

// Mock the auth provider
jest.mock('../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-id' }
  })
}));

const mockUsePageAllocation = usePageAllocation as jest.MockedFunction<typeof usePageAllocation>;

describe('useAllocationState', () => {
  let queryClient: QueryClient;

  const createWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should return initial loading state', () => {
    mockUsePageAllocation.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn()
    });

    const { result } = renderHook(
      () => useAllocationState({ pageId: 'test-page' }),
      { wrapper: createWrapper }
    );

    expect(result.current.allocationState.isLoading).toBe(true);
    expect(result.current.allocationState.currentAllocationCents).toBe(0);
    expect(result.current.allocationState.isOptimistic).toBe(false);
  });

  it('should return server data when loaded', async () => {
    const mockRefetch = jest.fn();
    mockUsePageAllocation.mockReturnValue({
      data: 500, // 5 dollars in cents
      isLoading: false,
      error: null,
      refetch: mockRefetch
    });

    const { result } = renderHook(
      () => useAllocationState({ pageId: 'test-page' }),
      { wrapper: createWrapper }
    );

    expect(result.current.allocationState.isLoading).toBe(false);
    expect(result.current.allocationState.currentAllocationCents).toBe(500);
    expect(result.current.allocationState.isOptimistic).toBe(false);
  });

  it('should handle optimistic updates', async () => {
    const mockRefetch = jest.fn();
    mockUsePageAllocation.mockReturnValue({
      data: 500,
      isLoading: false,
      error: null,
      refetch: mockRefetch
    });

    const { result } = renderHook(
      () => useAllocationState({ pageId: 'test-page' }),
      { wrapper: createWrapper }
    );

    // Apply optimistic update
    result.current.setOptimisticAllocation(750);

    expect(result.current.allocationState.currentAllocationCents).toBe(750);
    expect(result.current.allocationState.isOptimistic).toBe(true);
  });

  it('should refresh allocation data', async () => {
    const mockRefetch = jest.fn().mockResolvedValue({ data: 600 });
    mockUsePageAllocation.mockReturnValue({
      data: 500,
      isLoading: false,
      error: null,
      refetch: mockRefetch
    });

    const { result } = renderHook(
      () => useAllocationState({ pageId: 'test-page' }),
      { wrapper: createWrapper }
    );

    // Set optimistic state first
    result.current.setOptimisticAllocation(750);
    expect(result.current.allocationState.isOptimistic).toBe(true);

    // Refresh should clear optimistic state and refetch
    await result.current.refreshAllocation();

    expect(mockRefetch).toHaveBeenCalled();
    expect(result.current.allocationState.isOptimistic).toBe(false);
  });

  it('should handle disabled state', () => {
    mockUsePageAllocation.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: jest.fn()
    });

    const { result } = renderHook(
      () => useAllocationState({ pageId: 'test-page', enabled: false }),
      { wrapper: createWrapper }
    );

    // Should still provide a valid state even when disabled
    expect(result.current.allocationState).toBeDefined();
    expect(result.current.refreshAllocation).toBeDefined();
    expect(result.current.setOptimisticAllocation).toBeDefined();
  });

  it('should prioritize optimistic value over server value', () => {
    mockUsePageAllocation.mockReturnValue({
      data: 500,
      isLoading: false,
      error: null,
      refetch: jest.fn()
    });

    const { result } = renderHook(
      () => useAllocationState({ pageId: 'test-page' }),
      { wrapper: createWrapper }
    );

    // Initially should show server value
    expect(result.current.allocationState.currentAllocationCents).toBe(500);

    // After optimistic update, should show optimistic value
    result.current.setOptimisticAllocation(750);
    expect(result.current.allocationState.currentAllocationCents).toBe(750);
    expect(result.current.allocationState.isOptimistic).toBe(true);
  });

  it('should handle error states gracefully', () => {
    mockUsePageAllocation.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: jest.fn()
    });

    const { result } = renderHook(
      () => useAllocationState({ pageId: 'test-page' }),
      { wrapper: createWrapper }
    );

    // Should still provide a valid state even with errors
    expect(result.current.allocationState.isLoading).toBe(false);
    expect(result.current.allocationState.currentAllocationCents).toBe(0);
    expect(result.current.allocationState.isOptimistic).toBe(false);
  });

  it('should update lastUpdated timestamp', () => {
    mockUsePageAllocation.mockReturnValue({
      data: 500,
      isLoading: false,
      error: null,
      refetch: jest.fn()
    });

    const { result } = renderHook(
      () => useAllocationState({ pageId: 'test-page' }),
      { wrapper: createWrapper }
    );

    const initialTimestamp = result.current.allocationState.lastUpdated;
    expect(initialTimestamp).toBeInstanceOf(Date);

    // Apply optimistic update
    result.current.setOptimisticAllocation(750);

    const updatedTimestamp = result.current.allocationState.lastUpdated;
    expect(updatedTimestamp).toBeInstanceOf(Date);
    expect(updatedTimestamp.getTime()).toBeGreaterThanOrEqual(initialTimestamp.getTime());
  });
});
