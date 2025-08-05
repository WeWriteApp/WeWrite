"use client";

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../providers/AuthProvider';
import {
  AllocationState,
  UseAllocationStateReturn
} from '../types/allocation';
import { usePageAllocation } from './useAllocationQueries';
import { getLoggedOutPageAllocation, getUserPageAllocation } from '../utils/simulatedUsd';

/**
 * Custom hook for managing allocation state for a specific page
 *
 * Now powered by React Query for:
 * - Automatic caching and background refetching
 * - Built-in error handling and retries
 * - Optimistic updates with rollback
 * - Request deduplication
 * - Stale-while-revalidate caching
 */

interface UseAllocationStateOptions {
  pageId: string;
  enabled?: boolean;
}

export function useAllocationState({
  pageId,
  enabled = true
}: UseAllocationStateOptions): UseAllocationStateReturn {
  const { user } = useAuth();

  // State for optimistic updates
  const [optimisticAllocation, setOptimisticAllocation] = useState<number | null>(null);
  const [isOptimistic, setIsOptimistic] = useState(false);

  // Use React Query for data fetching
  const {
    data: serverAllocation = 0,
    isLoading,
    error,
    refetch
  } = usePageAllocation(pageId, enabled);

  // Calculate current allocation (optimistic, server, or fake value)
  const currentAllocationCents = useMemo(() => {
    if (optimisticAllocation !== null) {
      return optimisticAllocation;
    }

    // If user is not logged in, get fake allocation from localStorage
    if (!user?.uid) {
      return getLoggedOutPageAllocation(pageId);
    }

    // For logged in users, try server allocation first, then fake allocation
    if (serverAllocation > 0) {
      return serverAllocation;
    }

    // Check for fake allocation for logged in users without subscriptions
    return getUserPageAllocation(user.uid, pageId);
  }, [optimisticAllocation, serverAllocation, user?.uid, pageId]);

  // Create allocation state object
  const allocationState = useMemo((): AllocationState => ({
    currentAllocationCents,
    isLoading,
    isOptimistic,
    lastUpdated: new Date()
  }), [currentAllocationCents, isLoading, isOptimistic]);

  // Refresh allocation data
  const refreshAllocation = useCallback(async () => {
    // Clear optimistic state and refetch from server
    setOptimisticAllocation(null);
    setIsOptimistic(false);
    await refetch();
  }, [refetch]);

  // Optimistic update function
  const handleOptimisticUpdate = useCallback((cents: number) => {
    setOptimisticAllocation(cents);
    setIsOptimistic(true);
  }, []);

  return {
    allocationState,
    refreshAllocation,
    setOptimisticAllocation: handleOptimisticUpdate
  };
}
