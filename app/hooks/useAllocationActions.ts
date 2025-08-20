"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { useDemoBalance } from '../contexts/DemoBalanceContext';
import { useAllocationInterval } from '../contexts/AllocationIntervalContext';
import { useToast } from '../components/ui/use-toast';
import {
  UseAllocationActionsReturn,
  AllocationDirection,
  AllocationSource,
  AllocationError,
  ALLOCATION_ERROR_CODES,
  AllocationRequest
} from '../types/allocation';
import { useAllocationMutation } from './useAllocationQueries';
import { allocationBatcher } from '../utils/allocationBatching';
import {
  allocationErrorHandler,
  getUserFriendlyErrorMessage,
  getErrorRecoveryActions
} from '../utils/allocationErrorHandling';
import { showUsdAllocationNotification } from '../utils/usdNotifications';
import { allocateLoggedOutUsd, allocateUserUsd } from '../utils/simulatedUsd';

/**
 * Custom hook for handling allocation actions (increment/decrement)
 * 
 * This hook centralizes the logic for:
 * - Handling allocation changes with optimistic updates
 * - Batching API calls to prevent spam
 * - Error handling and rollback
 * - Integration with balance context
 * - Toast notifications
 */

interface UseAllocationActionsOptions {
  pageId: string;
  authorId: string;
  pageTitle: string;
  currentAllocationCents: number;
  source?: AllocationSource;
  onAllocationChange?: (newAllocationCents: number) => void;
  onOptimisticUpdate?: (cents: number) => void;
  batchDelayMs?: number;
  maxRetries?: number;
}

const DEFAULT_BATCH_DELAY = 500; // 500ms
const DEFAULT_MAX_RETRIES = 3;

export function useAllocationActions({
  pageId,
  authorId,
  pageTitle,
  currentAllocationCents,
  source = 'FloatingBar',
  onAllocationChange,
  onOptimisticUpdate,
  batchDelayMs = DEFAULT_BATCH_DELAY,
  maxRetries = DEFAULT_MAX_RETRIES
}: UseAllocationActionsOptions): UseAllocationActionsReturn {
  const { user } = useAuth();
  const { usdBalance, updateOptimisticBalance, hasActiveSubscription } = useUsdBalance();
  const { isDemoBalance, demoBalance, refreshDemoBalance } = useDemoBalance();
  const { allocationIntervalCents } = useAllocationInterval();
  const { toast } = useToast();

  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Batching state
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangeCents = useRef(0);

  // Use React Query mutation for allocation changes
  const allocationMutation = useAllocationMutation();

  // Clear any pending batched requests
  const clearBatch = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    pendingChangeCents.current = 0;
  }, []);

  // Process batched allocation change using enhanced batching system
  const processBatchedChange = useCallback(async () => {
    const changeCents = pendingChangeCents.current;
    if (changeCents === 0) return;

    // Clear the batch
    clearBatch();
    setError(null);

    try {
      // Handle demo balance allocations
      if (isDemoBalance) {
        // Use simulated USD allocation functions
        const newAllocationCents = currentAllocationCents + changeCents;
        const result = !user?.uid
          ? allocateLoggedOutUsd(pageId, pageTitle, newAllocationCents)
          : allocateUserUsd(user.uid, pageId, pageTitle, newAllocationCents);

        if (result.success) {
          // Refresh the demo balance from localStorage to update the context
          refreshDemoBalance();
          onAllocationChange?.(newAllocationCents);
          showUsdAllocationNotification(changeCents, pageTitle, newAllocationCents);
        } else {
          throw new Error(result.error || 'Demo allocation failed');
        }
        return;
      }

      // Real allocation for users with subscriptions
      const request: AllocationRequest = {
        pageId,
        changeCents,
        source
      };

      // Use enhanced batcher for intelligent request batching
      const result = await allocationBatcher.batchRequest(request, 'normal');

      if (result.success) {
        // Update the actual allocation
        onAllocationChange?.(result.currentAllocation);

        // Show success notification
        showUsdAllocationNotification(
          changeCents,
          pageTitle,
          result.currentAllocation
        );
      } else {
        throw new AllocationError(
          result.error || 'Allocation failed',
          ALLOCATION_ERROR_CODES.NETWORK_ERROR
        );
      }
    } catch (error) {
      console.error('Allocation error:', error);

      // Use comprehensive error handling
      const errorContext = {
        pageId,
        userId: user?.uid,
        changeCents,
        source,
        timestamp: new Date()
      };

      const errorResult = allocationErrorHandler.handleError(error as Error, errorContext);

      setError(errorResult.userMessage);

      if (errorResult.showToUser) {
        toast({
          title: "Allocation Failed",
          description: errorResult.userMessage,
          variant: "destructive",
        });
      }

      // Report to analytics if needed
      if (errorResult.reportToAnalytics) {
        const analyticsData = allocationErrorHandler.createErrorAnalytics(error as Error, errorContext);
        console.log('Error analytics:', analyticsData);
      }
    }
  }, [
    clearBatch,
    pageId,
    source,
    onAllocationChange,
    pageTitle,
    toast
  ]);

  // Handle allocation change with amount
  const handleAllocationChange = useCallback(async (
    amount: number,
    event?: React.MouseEvent
  ) => {
    // Prevent event propagation if event is provided
    if (event) {
      event.stopPropagation();
      event.preventDefault();
      event.nativeEvent.stopImmediatePropagation();
    }

    // For demo balance, allow logged-out users. For real balance, require user.
    if (!pageId) return;
    if (!isDemoBalance && !user) return;

    // Check if user is trying to allocate to their own page (only for logged-in users)
    if (user && user.uid === authorId) {
      toast({
        title: "Cannot allocate to your own page",
        description: "You cannot allocate funds to pages you created.",
        variant: "destructive",
      });
      return;
    }

    // Use the amount directly (can be positive or negative)
    const newAllocationCents = Math.max(0, currentAllocationCents + amount);
    const changeCents = amount; // The amount parameter is the change in cents

    // Allow over-allocation - the server will handle budget checks and show modal if needed

    // Immediate optimistic updates for both demo and real balance
    if (isDemoBalance) {
      // For demo balance, call the optimistic update callback directly
      // since we don't have a central balance state to update
      onOptimisticUpdate?.(newAllocationCents);
    } else {
      // For real balance, use optimistic updates
      updateOptimisticBalance(changeCents);
      onOptimisticUpdate?.(newAllocationCents);
    }

    // Add to pending batch
    pendingChangeCents.current += changeCents;

    // Clear existing timeout and set new one
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    batchTimeoutRef.current = setTimeout(() => {
      processBatchedChange();
    }, batchDelayMs);

    setError(null);
  }, [
    user, 
    pageId, 
    authorId, 
    allocationIntervalCents, 
    currentAllocationCents, 
    usdBalance, 
    updateOptimisticBalance, 
    onOptimisticUpdate, 
    batchDelayMs, 
    processBatchedChange, 
    toast
  ]);

  // Handle direct allocation (for specific amounts)
  const handleDirectAllocation = useCallback((cents: number) => {
    if (!user || !pageId) return;

    if (user.uid === authorId) {
      toast({
        title: "Cannot allocate to your own page",
        description: "You cannot allocate funds to pages you created.",
        variant: "destructive",
      });
      return;
    }

    const changeCents = cents - currentAllocationCents;
    
    if (changeCents === 0) return;

    // Allow over-allocation - the server will handle budget checks and show modal if needed

    // Immediate optimistic updates
    updateOptimisticBalance(changeCents);
    onOptimisticUpdate?.(cents);

    // Clear any pending batch and execute with high priority
    clearBatch();

    // Use high priority batching for direct allocations
    const request: AllocationRequest = {
      pageId,
      changeCents,
      source
    };

    allocationBatcher.batchRequest(request, 'high').then(result => {
      if (result.success) {
        onAllocationChange?.(result.currentAllocation);
        showUsdAllocationNotification(changeCents, pageTitle, result.currentAllocation);
      } else {
        throw new Error(result.error || 'Allocation failed');
      }
    }).catch(error => {
      console.error('Direct allocation error:', error);

      // Rollback optimistic updates
      updateOptimisticBalance(-changeCents);
      onOptimisticUpdate?.(currentAllocationCents);

      // Use comprehensive error handling
      const errorContext = {
        pageId,
        userId: user?.uid,
        changeCents,
        source,
        timestamp: new Date()
      };

      const errorResult = allocationErrorHandler.handleError(error as Error, errorContext);

      setError(errorResult.userMessage);

      if (errorResult.showToUser) {
        toast({
          title: "Allocation Failed",
          description: errorResult.userMessage,
          variant: "destructive",
        });
      }

      // Report to analytics if needed
      if (errorResult.reportToAnalytics) {
        const analyticsData = allocationErrorHandler.createErrorAnalytics(error as Error, errorContext);
        console.log('Error analytics:', analyticsData);
      }
    });

    setError(null);
  }, [
    user,
    pageId,
    authorId,
    currentAllocationCents,
    source,
    usdBalance,
    updateOptimisticBalance,
    onOptimisticUpdate,
    onAllocationChange,
    pageTitle,
    clearBatch,
    toast
  ]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      clearBatch();
    };
  }, [clearBatch]);

  return {
    handleAllocationChange,
    isProcessing: allocationMutation.isPending,
    error,
    clearError
  };
}
