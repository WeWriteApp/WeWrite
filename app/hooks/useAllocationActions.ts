"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
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
  const { usdBalance, updateOptimisticBalance, isFakeBalance, hasActiveSubscription, refreshFakeBalance } = useUsdBalance();
  const { allocationIntervalCents } = useAllocationInterval();
  const { toast } = useToast();

  const [error, setError] = useState<string | null>(null);

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
    console.log('[AllocationActions] processBatchedChange called:', {
      changeCents,
      pageId,
      authorId,
      pageTitle,
      currentAllocationCents,
      isFakeBalance,
      userId: user?.uid,
      timestamp: new Date().toISOString()
    });

    if (changeCents === 0) {
      console.log('[AllocationActions] No pending changes, skipping batch processing');
      return;
    }

    // Clear the batch
    console.log('[AllocationActions] Clearing batch');
    clearBatch();
    setError(null);

    try {
      // Handle fake balance allocations
      if (isFakeBalance) {
        console.log('[AllocationActions] Processing fake balance allocation:', {
          changeCents,
          pageId,
          pageTitle,
          isLoggedOut: !user?.uid
        });

        // Use simulated USD allocation functions
        if (!user?.uid) {
          // Logged out user
          const result = allocateLoggedOutUsd(pageId, pageTitle, currentAllocationCents + changeCents);
          if (result.success) {
            // Refresh the fake balance from localStorage to update the context
            refreshFakeBalance();
            onAllocationChange?.(currentAllocationCents + changeCents);
            showUsdAllocationNotification(
              changeCents,
              pageTitle,
              currentAllocationCents + changeCents
            );
          } else {
            throw new Error(result.error || 'Fake allocation failed');
          }
        } else {
          // Logged in user without subscription
          const result = allocateUserUsd(user.uid, pageId, pageTitle, currentAllocationCents + changeCents);
          if (result.success) {
            // Refresh the fake balance from localStorage to update the context
            refreshFakeBalance();
            onAllocationChange?.(currentAllocationCents + changeCents);
            showUsdAllocationNotification(
              changeCents,
              pageTitle,
              currentAllocationCents + changeCents
            );
          } else {
            throw new Error(result.error || 'Fake allocation failed');
          }
        }
        return;
      }

      // Real allocation for users with subscriptions
      console.log('[AllocationActions] Processing real allocation for subscribed user');
      const request: AllocationRequest = {
        pageId,
        changeCents,
        source
      };

      console.log('[AllocationActions] Making API request:', request);
      // Use enhanced batcher for intelligent request batching
      const result = await allocationBatcher.batchRequest(request, 'normal');

      console.log('[AllocationActions] API response:', result);
      if (result.success) {
        console.log('[AllocationActions] Real allocation successful');
        // Update the actual allocation
        onAllocationChange?.(result.currentAllocation);

        // Show success notification
        showUsdAllocationNotification(
          changeCents,
          pageTitle,
          result.currentAllocation
        );
      } else {
        console.error('[AllocationActions] Real allocation failed:', result.error);
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
        // TODO: Send to analytics service
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

  // Handle allocation change with direction
  const handleAllocationChange = useCallback((
    direction: AllocationDirection,
    event: React.MouseEvent
  ) => {
    console.log('[AllocationActions] handleAllocationChange called:', {
      direction,
      pageId,
      authorId,
      currentAllocationCents,
      allocationIntervalCents,
      source,
      userId: user?.uid,
      hasUsdBalance: !!usdBalance,
      isFakeBalance,
      timestamp: new Date().toISOString()
    });

    // Prevent event propagation
    event.stopPropagation();
    event.preventDefault();
    event.nativeEvent.stopImmediatePropagation();

    if (!user || !pageId) {
      console.error('[AllocationActions] Missing user or pageId:', { user: !!user, pageId });
      return;
    }

    // Check if user is trying to allocate to their own page
    if (user.uid === authorId) {
      console.log('[AllocationActions] User trying to allocate to own page');
      toast({
        title: "Cannot allocate to your own page",
        description: "You cannot allocate funds to pages you created.",
        variant: "destructive",
      });
      return;
    }

    const changeCents = direction * allocationIntervalCents;
    const newAllocationCents = Math.max(0, currentAllocationCents + changeCents);

    console.log('[AllocationActions] Calculated allocation change:', {
      changeCents,
      newAllocationCents,
      currentAllocationCents,
      direction,
      allocationIntervalCents
    });

    // Check for sufficient funds (for positive allocations)
    if (changeCents > 0 && usdBalance) {
      console.log('[AllocationActions] Checking funds:', {
        changeCents,
        availableUsdCents: usdBalance.availableUsdCents,
        hasSufficientFunds: changeCents <= usdBalance.availableUsdCents
      });

      if (changeCents > usdBalance.availableUsdCents) {
        console.log('[AllocationActions] Insufficient funds');
        toast({
          title: "Insufficient funds",
          description: "You don't have enough available funds for this allocation.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      console.log('[AllocationActions] Applying optimistic updates:', {
        isFakeBalance,
        newAllocationCents
      });

      // Immediate optimistic updates
      if (isFakeBalance) {
        // For fake balance, we'll refresh after the allocation is saved
        console.log('[AllocationActions] Applying fake balance optimistic update');
        onOptimisticUpdate?.(newAllocationCents);
      } else {
        // For real balance, use optimistic updates
        console.log('[AllocationActions] Applying real balance optimistic update');
        updateOptimisticBalance(changeCents);
        onOptimisticUpdate?.(newAllocationCents);
      }

      // Add to pending batch
      pendingChangeCents.current += changeCents;
      console.log('[AllocationActions] Updated pending changes:', pendingChangeCents.current);

      // Clear existing timeout and set new one
      if (batchTimeoutRef.current) {
        console.log('[AllocationActions] Clearing existing batch timeout');
        clearTimeout(batchTimeoutRef.current);
      }

      console.log('[AllocationActions] Setting batch timeout for', batchDelayMs, 'ms');
      batchTimeoutRef.current = setTimeout(() => {
        console.log('[AllocationActions] Batch timeout triggered, processing changes');
        processBatchedChange();
      }, batchDelayMs);

      setError(null);
      console.log('[AllocationActions] handleAllocationChange completed successfully');
    } catch (error) {
      console.error('[AllocationActions] Error in handleAllocationChange:', error);
      setError('Failed to process allocation change');
      // Rollback optimistic update
      onOptimisticUpdate?.(currentAllocationCents);
    }
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

    // Check for sufficient funds
    if (changeCents > 0 && usdBalance) {
      if (changeCents > usdBalance.availableUsdCents) {
        toast({
          title: "Insufficient funds",
          description: "You don't have enough available funds for this allocation.",
          variant: "destructive",
        });
        return;
      }
    }

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
        // TODO: Send to analytics service
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
    handleDirectAllocation,
    isProcessing: allocationMutation.isPending,
    error
  };
}
