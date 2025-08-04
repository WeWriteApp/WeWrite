"use client";

/**
 * AllocationControls Component
 *
 * A compact dollar allocation interface designed for embedding in activity cards.
 * Features:
 * - Plus/minus buttons for quick dollar allocation (configurable increments)
 * - Visual composition bar showing allocation distribution
 * - Centered dollar amount display for current page allocation
 * - Optimistic updates for responsive UX
 * - Batched API calls to prevent spam
 * - Handles authentication and balance states
 */

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useToast } from '../ui/use-toast';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { useAllocationInterval } from '../../contexts/AllocationIntervalContext';
import { showUsdAllocationNotification } from '../../utils/usdNotifications';
import { getNextMonthlyProcessingDate } from '../../utils/subscriptionTiers';
import { AllocationIntervalModal } from './AllocationIntervalModal';
import { AllocationAmountDisplay } from './AllocationAmountDisplay';

interface AllocationControlsProps {
  pageId: string;
  authorId: string;
  pageTitle?: string;
  className?: string;
  source?: 'HomePage' | 'ContentPage';
}

export function AllocationControls({
  pageId,
  authorId,
  pageTitle,
  className,
  source = 'HomePage'
}: AllocationControlsProps) {
  const { user } = useAuth();
  const { usdBalance, isLoading: usdLoading, updateOptimisticBalance } = useUsdBalance();
  const { allocationIntervalCents, isLoading: intervalLoading } = useAllocationInterval();
  const router = useRouter();
  const { toast } = useToast();

  const [currentPageAllocationCents, setCurrentPageAllocationCents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showIntervalModal, setShowIntervalModal] = useState(false);
  
  // Batching state for API calls
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Long press handling
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressing = useRef(false);

  // 🚨 CRITICAL: Request deduplication to prevent API spam
  const requestCache = useRef(new Map<string, Promise<any>>());

  // Load current page allocation only
  useEffect(() => {
    if (!user || !pageId) return;

    const loadPageAllocation = async () => {
      try {
        // 🚨 CRITICAL: Deduplicate requests to prevent massive read costs
        const cacheKey = `pledge-bar-data:${pageId}`;

        if (requestCache.current.has(cacheKey)) {
          console.log('🚀 DEDUPLICATION: Using existing request for', pageId);
          const result = await requestCache.current.get(cacheKey);
          const allocationCents = result.data?.currentAllocation || 0;
          setCurrentPageAllocationCents(allocationCents);
          return;
        }

        const requestPromise = fetch(`/api/usd/pledge-bar-data?pageId=${pageId}`)
          .then(response => response.ok ? response.json() : Promise.reject(response));

        requestCache.current.set(cacheKey, requestPromise);

        // Clean up cache after request completes
        requestPromise.finally(() => {
          setTimeout(() => requestCache.current.delete(cacheKey), 1000);
        });

        const result = await requestPromise;
        const allocationCents = result.data?.currentAllocation || 0;
        setCurrentPageAllocationCents(allocationCents);
      } catch (error) {
        console.error('Error loading page allocation:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPageAllocation();
  }, [user, pageId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  // Batched API call function
  const flushPendingChanges = async (finalAllocationCents: number, previousAllocationCents: number) => {
    try {
      const usdCentsChange = finalAllocationCents - previousAllocationCents;
      
      const response = await fetch('/api/usd/allocate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId: pageId,
          usdCentsChange: usdCentsChange
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast({
          title: "Allocation Failed",
          description: errorData.error || "Failed to sync allocation",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Failed to sync allocation:', error);
      toast({
        title: "Sync Failed",
        description: "Your allocation will be retried",
        variant: "destructive"
      });
    }
  };

  // Handle USD allocation change with TRUE optimistic updates
  const handleAllocationChange = (direction: 1 | -1, event: React.MouseEvent) => {
    // CRITICAL: Prevent ALL event propagation immediately
    event.stopPropagation();
    event.preventDefault();
    event.nativeEvent.stopImmediatePropagation();

    if (!user || !pageId) return;

    // Use the user's configured allocation interval
    const changeCents = direction * allocationIntervalCents;

    // Calculate new allocation directly in cents
    const previousAllocationCents = currentPageAllocationCents;
    const newAllocationCents = Math.max(0, previousAllocationCents + changeCents);

    // INSTANT optimistic updates - UI is ALWAYS responsive
    setCurrentPageAllocationCents(newAllocationCents);
    updateOptimisticBalance(changeCents);

    // Batch API calls - clear existing timeout and set new one
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    batchTimeoutRef.current = setTimeout(() => {
      flushPendingChanges(newAllocationCents, previousAllocationCents);
      batchTimeoutRef.current = null;
    }, 500); // Batch changes for 500ms
  };

  // Handle click when not logged in
  const handleLoginRequired = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    router.push('/auth/login');
  };

  // Handle click when out of funds
  const handleOutOfFunds = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setShowIntervalModal(true);
  };

  // Long press handlers for quick allocation
  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    isLongPressing.current = false;
    
    longPressTimer.current = setTimeout(() => {
      isLongPressing.current = true;
      setShowIntervalModal(true);
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Handle button click (only if not long pressing)
  const handleButtonClick = (direction: 1 | -1, event: React.MouseEvent) => {
    if (isLongPressing.current) {
      isLongPressing.current = false;
      return;
    }
    handleAllocationChange(direction, event);
  };

  // Show loading state while data loads
  if (isLoading || usdLoading || intervalLoading) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
        <div className="flex-1 h-8 bg-muted rounded animate-pulse" />
        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3 text-xs"
          onClick={handleLoginRequired}
        >
          Login to allocate funds
        </Button>
      </div>
    );
  }

  // Work directly with USD cents - no conversion needed
  const totalCents = usdBalance.totalUsdCents;
  const allocatedCents = usdBalance.allocatedUsdCents;
  const availableCents = totalCents - allocatedCents;

  // Calculate USD distribution for composition bar
  const otherPagesCents = Math.max(0, allocatedCents - currentPageAllocationCents);
  const isOutOfFunds = availableCents <= 0;

  // Calculate percentages for the composition bar (order: other, this, available)
  const otherPagesPercentage = totalCents > 0 ? (otherPagesCents / totalCents) * 100 : 0;
  const currentPagePercentage = totalCents > 0 ? (currentPageAllocationCents / totalCents) * 100 : 0;
  const availablePercentage = totalCents > 0 ? (availableCents / totalCents) * 100 : 0;

  // Convert current page allocation from cents to dollars for display
  const currentPageDollars = currentPageAllocationCents / 100;

  return (
    <div className={cn("w-full", className)}>
      {/* Allocation amount display above the controls */}
      <AllocationAmountDisplay
        allocationCents={currentPageAllocationCents}
      />

      <div className="flex items-center gap-3">
        {/* Minus button on left */}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 hover:bg-destructive/20 active:scale-95 transition-all duration-150 flex-shrink-0"
          onClick={(e) => handleButtonClick(-1, e)}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          disabled={false}
        >
          <Minus className="h-4 w-4" />
        </Button>

      {/* Composition bar with centered dollar amount */}
      <div
        className="flex-1 h-8 relative"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        {/* Background composition bar with smooth transitions */}
        <div className="absolute inset-0 flex gap-1">
          {/* Other pages (spent elsewhere) - left side */}
          {otherPagesCents > 0 && (
            <div
              className="bg-muted-foreground/30 rounded-md transition-all duration-300 ease-out"
              style={{ width: `${otherPagesPercentage}%` }}
            />
          )}

          {/* Current page (spent here) - center, primary color */}
          {currentPageAllocationCents > 0 && (
            <div
              className="bg-primary rounded-md transition-all duration-300 ease-out"
              style={{ width: `${currentPagePercentage}%` }}
            />
          )}

          {/* Available funds - right side */}
          {availableCents > 0 && (
            <div
              className="bg-muted-foreground/10 rounded-md transition-all duration-300 ease-out"
              style={{ width: `${availablePercentage}%` }}
            />
          )}
        </div>

      </div>

        {/* Plus button on right */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 active:scale-95 transition-all duration-150 flex-shrink-0"
          onClick={(e) => isOutOfFunds ? handleOutOfFunds(e) : handleButtonClick(1, e)}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          disabled={false}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Allocation Interval Modal */}
      <AllocationIntervalModal
        isOpen={showIntervalModal}
        onClose={() => setShowIntervalModal(false)}
      />
    </div>
  );
}

// Export with old name for backward compatibility
export { AllocationControls as EmbeddedTokenAllocation };
