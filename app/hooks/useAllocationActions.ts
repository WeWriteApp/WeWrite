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
  AllocationRequest,
  AllocationResponse
} from '../types/allocation';
import { allocateLoggedOutUsd } from '../utils/simulatedUsd';
import { showUsdAllocationNotification } from '../utils/usdNotifications';

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
  const { usdBalance, updateOptimisticBalance } = useUsdBalance();
  const { allocationIntervalCents } = useAllocationInterval();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Batching state
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangeCents = useRef(0);
  const retryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear any pending batched requests
  const clearBatch = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    pendingChangeCents.current = 0;
  }, []);

  // Execute the actual API call
  const executeAllocationChange = useCallback(async (
    changeCents: number,
    signal?: AbortSignal
  ): Promise<AllocationResponse> => {
    if (!user?.uid) {
      // Handle logged-out users with simulated allocation
      const newAllocation = allocateLoggedOutUsd(pageId, changeCents);
      return {
        success: true,
        currentAllocation: newAllocation
      };
    }

    const request: AllocationRequest = {
      pageId,
      changeCents,
      source
    };

    try {
      const response = await fetch('/api/usd/allocate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal
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
      if (error.name === 'AbortError') {
        throw error;
      }
      throw new AllocationError(
        'Network request failed',
        ALLOCATION_ERROR_CODES.NETWORK_ERROR,
        true
      );
    }
  }, [user?.uid, pageId, source]);

  // Process batched allocation change
  const processBatchedChange = useCallback(async () => {
    const changeCents = pendingChangeCents.current;
    if (changeCents === 0) return;

    // Clear the batch
    clearBatch();
    setIsProcessing(true);
    setError(null);

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const result = await executeAllocationChange(changeCents, abortControllerRef.current.signal);
      
      if (result.success) {
        // Update the actual allocation
        onAllocationChange?.(result.currentAllocation);
        
        // Show success notification
        showUsdAllocationNotification(
          changeCents,
          pageTitle,
          result.currentAllocation
        );

        retryCountRef.current = 0;
      } else {
        throw new AllocationError(
          result.error || 'Allocation failed',
          ALLOCATION_ERROR_CODES.NETWORK_ERROR
        );
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return; // Request was cancelled
      }

      console.error('Allocation error:', error);

      // Handle retries for retryable errors
      if (error instanceof AllocationError && error.retryable && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.pow(2, retryCountRef.current) * 1000; // Exponential backoff
        
        setTimeout(() => {
          pendingChangeCents.current = changeCents; // Restore the pending change
          processBatchedChange();
        }, delay);
        return;
      }

      // Rollback optimistic updates
      updateOptimisticBalance(-changeCents);
      onOptimisticUpdate?.(currentAllocationCents);

      // Show error message
      const errorMessage = error instanceof AllocationError 
        ? error.message 
        : 'Failed to update allocation';
      
      setError(errorMessage);
      toast({
        title: "Allocation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    clearBatch, 
    executeAllocationChange, 
    onAllocationChange, 
    pageTitle, 
    maxRetries, 
    updateOptimisticBalance, 
    onOptimisticUpdate, 
    currentAllocationCents, 
    toast
  ]);

  // Handle allocation change with direction
  const handleAllocationChange = useCallback((
    direction: AllocationDirection, 
    event: React.MouseEvent
  ) => {
    // Prevent event propagation
    event.stopPropagation();
    event.preventDefault();
    event.nativeEvent.stopImmediatePropagation();

    if (!user || !pageId) return;

    // Check if user is trying to allocate to their own page
    if (user.uid === authorId) {
      toast({
        title: "Cannot allocate to your own page",
        description: "You cannot allocate funds to pages you created.",
        variant: "destructive",
      });
      return;
    }

    const changeCents = direction * allocationIntervalCents;
    const newAllocationCents = Math.max(0, currentAllocationCents + changeCents);

    // Check for sufficient funds (for positive allocations)
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
    onOptimisticUpdate?.(newAllocationCents);

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

    // Clear any pending batch and execute immediately
    clearBatch();
    pendingChangeCents.current = changeCents;
    processBatchedChange();

    setError(null);
  }, [
    user, 
    pageId, 
    authorId, 
    currentAllocationCents, 
    usdBalance, 
    updateOptimisticBalance, 
    onOptimisticUpdate, 
    clearBatch, 
    processBatchedChange, 
    toast
  ]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      clearBatch();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [clearBatch]);

  return {
    handleAllocationChange,
    handleDirectAllocation,
    isProcessing,
    error
  };
}
