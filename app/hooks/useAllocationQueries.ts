"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { 
  AllocationRequest, 
  AllocationResponse, 
  PageAllocationResponse,
  AllocationError,
  ALLOCATION_ERROR_CODES 
} from '../types/allocation';
import { getLoggedOutPageAllocation, allocateLoggedOutUsd } from '../utils/simulatedUsd';
import { getCacheConfig } from '../utils/reactQueryConfig';

/**
 * React Query hooks for allocation data management
 * 
 * These hooks provide:
 * - Automatic caching and background refetching
 * - Optimistic updates with rollback on failure
 * - Proper error handling and retry logic
 * - Integration with existing allocation system
 */

// Query key factories for allocation data
export const allocationQueryKeys = {
  all: ['allocations'] as const,
  page: (pageId: string, userId?: string) => ['allocations', 'page', pageId, userId] as const,
  user: (userId: string) => ['allocations', 'user', userId] as const,
  userPage: (userId: string, pageId: string) => ['allocations', 'user', userId, 'page', pageId] as const,
};

/**
 * Hook to fetch current allocation for a specific page
 */
export function usePageAllocation(pageId: string, enabled: boolean = true) {
  const { user } = useAuth();
  const cacheConfig = getCacheConfig('user');

  return useQuery({
    queryKey: allocationQueryKeys.page(pageId, user?.uid),
    queryFn: async (): Promise<number> => {
      if (!pageId) {
        throw new AllocationError(
          'Page ID is required',
          ALLOCATION_ERROR_CODES.INVALID_AMOUNT
        );
      }

      if (!user?.uid) {
        // Return simulated allocation for logged-out users
        return getLoggedOutPageAllocation(pageId);
      }

      try {
        const response = await fetch(`/api/usd/allocate?pageId=${pageId}`, {
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new AllocationError(
              'Authentication required',
              ALLOCATION_ERROR_CODES.UNAUTHORIZED
            );
          }
          if (response.status === 404) {
            throw new AllocationError(
              'Page not found',
              ALLOCATION_ERROR_CODES.PAGE_NOT_FOUND
            );
          }
          if (response.status === 429) {
            throw new AllocationError(
              'Too many requests',
              ALLOCATION_ERROR_CODES.RATE_LIMITED,
              true
            );
          }
          throw new AllocationError(
            `HTTP ${response.status}: ${response.statusText}`,
            ALLOCATION_ERROR_CODES.NETWORK_ERROR,
            true
          );
        }

        const data: PageAllocationResponse = await response.json();
        return data.currentAllocation || 0;
      } catch (error) {
        if (error instanceof AllocationError) {
          throw error;
        }
        throw new AllocationError(
          'Network request failed',
          ALLOCATION_ERROR_CODES.NETWORK_ERROR,
          true
        );
      }
    },
    enabled: enabled && !!pageId,
    staleTime: cacheConfig.staleTime,
    gcTime: cacheConfig.gcTime,
    retry: (failureCount, error) => {
      // Retry only for retryable errors and up to 3 times
      if (error instanceof AllocationError && error.retryable && failureCount < 3) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to mutate allocation data with optimistic updates
 */
export function useAllocationMutation() {
  const { user } = useAuth();
  const { updateOptimisticBalance } = useUsdBalance();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: AllocationRequest): Promise<AllocationResponse> => {
      if (!user?.uid) {
        // Handle logged-out users with simulated allocation
        const newAllocation = allocateLoggedOutUsd(request.pageId, request.changeCents);
        return {
          success: true,
          currentAllocation: newAllocation
        };
      }

      try {
        const response = await fetch('/api/usd/allocate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new AllocationError(
              'Authentication required',
              ALLOCATION_ERROR_CODES.UNAUTHORIZED
            );
          }
          if (response.status === 400) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.code === 'INSUFFICIENT_FUNDS') {
              throw new AllocationError(
                'Insufficient funds',
                ALLOCATION_ERROR_CODES.INSUFFICIENT_FUNDS
              );
            }
            throw new AllocationError(
              errorData.message || 'Invalid request',
              ALLOCATION_ERROR_CODES.INVALID_AMOUNT
            );
          }
          if (response.status === 429) {
            throw new AllocationError(
              'Too many requests',
              ALLOCATION_ERROR_CODES.RATE_LIMITED,
              true
            );
          }
          throw new AllocationError(
            `HTTP ${response.status}: ${response.statusText}`,
            ALLOCATION_ERROR_CODES.NETWORK_ERROR,
            true
          );
        }

        const data: AllocationResponse = await response.json();
        return data;
      } catch (error) {
        if (error instanceof AllocationError) {
          throw error;
        }
        throw new AllocationError(
          'Network request failed',
          ALLOCATION_ERROR_CODES.NETWORK_ERROR,
          true
        );
      }
    },
    onMutate: async (request) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: allocationQueryKeys.page(request.pageId, user?.uid) 
      });

      // Snapshot the previous value
      const previousAllocation = queryClient.getQueryData<number>(
        allocationQueryKeys.page(request.pageId, user?.uid)
      );

      // Optimistically update the cache
      queryClient.setQueryData<number>(
        allocationQueryKeys.page(request.pageId, user?.uid),
        (old) => Math.max(0, (old || 0) + request.changeCents)
      );

      // Update balance optimistically
      updateOptimisticBalance(request.changeCents);

      // Return a context object with the snapshotted value
      return { previousAllocation, request };
    },
    onError: (error, request, context) => {
      // Rollback the optimistic update
      if (context?.previousAllocation !== undefined) {
        queryClient.setQueryData(
          allocationQueryKeys.page(request.pageId, user?.uid),
          context.previousAllocation
        );
      }

      // Rollback balance update
      updateOptimisticBalance(-request.changeCents);
    },
    onSuccess: (data, request) => {
      // Update the cache with the actual server response
      queryClient.setQueryData(
        allocationQueryKeys.page(request.pageId, user?.uid),
        data.currentAllocation
      );

      // Invalidate related queries to ensure consistency
      queryClient.invalidateQueries({ 
        queryKey: allocationQueryKeys.user(user?.uid || '') 
      });
    },
    onSettled: (data, error, request) => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ 
        queryKey: allocationQueryKeys.page(request.pageId, user?.uid) 
      });
    },
  });
}

/**
 * Hook to prefetch allocation data for a page
 */
export function usePrefetchAllocation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cacheConfig = getCacheConfig('user');

  return {
    prefetchPageAllocation: async (pageId: string) => {
      await queryClient.prefetchQuery({
        queryKey: allocationQueryKeys.page(pageId, user?.uid),
        queryFn: async () => {
          if (!user?.uid) {
            return getLoggedOutPageAllocation(pageId);
          }

          const response = await fetch(`/api/usd/allocate?pageId=${pageId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch allocation');
          }
          const data = await response.json();
          return data.currentAllocation || 0;
        },
        staleTime: cacheConfig.staleTime,
        gcTime: cacheConfig.gcTime,
      });
    }
  };
}

/**
 * Hook to invalidate allocation cache
 */
export function useInvalidateAllocation() {
  const queryClient = useQueryClient();

  return {
    invalidatePageAllocation: (pageId: string, userId?: string) => {
      queryClient.invalidateQueries({ 
        queryKey: allocationQueryKeys.page(pageId, userId) 
      });
    },
    invalidateUserAllocations: (userId: string) => {
      queryClient.invalidateQueries({ 
        queryKey: allocationQueryKeys.user(userId) 
      });
    },
    invalidateAllAllocations: () => {
      queryClient.invalidateQueries({ 
        queryKey: allocationQueryKeys.all 
      });
    }
  };
}
