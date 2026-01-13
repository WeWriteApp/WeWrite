"use client";

/**
 * EmbeddedAllocationBar Component
 *
 * A compact allocation interface designed for embedding in cards and other components.
 * This is the embedded version of AllocationControls, meant to be used in:
 * - Random pages cards
 * - Search result cards  
 * - Any other card-based layouts
 * 
 * Features:
 * - Plus/minus buttons for quick dollar allocation
 * - Visual composition bar showing allocation distribution
 * - Centered dollar amount display for current page allocation
 * - Optimistic updates for responsive UX
 * - Batched API calls to prevent spam
 * - Handles authentication and balance states
 */

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { useAuth } from '../../providers/AuthProvider';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useDemoBalance, useShouldUseDemoBalance } from '../../contexts/DemoBalanceContext';
import { useAllocationInterval } from '../../contexts/AllocationIntervalContext';
import { useRouter } from 'next/navigation';
import { useToast } from '../ui/use-toast';
import { cn } from '../../lib/utils';
import { AllocationIntervalModal } from './AllocationIntervalModal';
import { AllocationAmountDisplay } from './AllocationAmountDisplay';
import { useAllocationState } from '../../hooks/useAllocationState';
import { useAllocationActions } from '../../hooks/useAllocationActions';
import { EmbeddedAllocationBarProps, CompositionBarData } from '../../types/allocation';
import { UsdAllocationModal } from './UsdAllocationModal';
import { CompositionBar } from './CompositionBar';

export function EmbeddedAllocationBar({
  pageId,
  authorId,
  pageTitle,
  className,
  source = 'EmbeddedCard',
  overrideIntervalCents,
  disableDetailModal = false,
  disableLongPress = false,
  highlightPlusButton = false,
  enableBarClickZones = false
}: EmbeddedAllocationBarProps) {
  const { user } = useAuth();
  const { usdBalance, isLoading: usdLoading } = useUsdBalance();
  const { hasActiveSubscription } = useSubscription();
  const shouldUseDemoBalance = useShouldUseDemoBalance(hasActiveSubscription);
  const { demoBalance } = useDemoBalance();
  const { allocationIntervalCents, isLoading: intervalLoading } = useAllocationInterval();
  const router = useRouter();
  const { toast } = useToast();

  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [minusButtonPressed, setMinusButtonPressed] = useState(false);
  const [plusButtonPressed, setPlusButtonPressed] = useState(false);
  const [minusButtonHovered, setMinusButtonHovered] = useState(false);
  const [plusButtonHovered, setPlusButtonHovered] = useState(false);

  // Game-like animation state for allocation increases
  const [showParticles, setShowParticles] = useState(false);
  const [showPulse, setShowPulse] = useState(false);

  // Long press handling
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressing = useRef(false);

  // Don't show for page owners
  const isPageOwner = user?.uid === authorId;

  // Use our shared hooks
  const { allocationState, refreshAllocation, setOptimisticAllocation } = useAllocationState({
    pageId,
    enabled: !isPageOwner // Enable for both logged-in and logged-out users
  });

  const {
    handleAllocationChange,
    isProcessing,
    error,
    clearError
  } = useAllocationActions({
    pageId,
    authorId,
    pageTitle,
    currentAllocationCents: allocationState.currentAllocationCents,
    source,
    onAllocationChange: (newAllocationCents) => {
      // Refresh the allocation state when allocation changes
      refreshAllocation();
    },
    onOptimisticUpdate: setOptimisticAllocation
  });

  // Calculate composition bar data with optimistic updates
  const getCompositionData = (): CompositionBarData => {
    // Use demo balance for logged-out users or users without subscriptions
    const currentBalance = shouldUseDemoBalance ? demoBalance : usdBalance;

    if (!currentBalance) {
      return {
        otherPagesPercentage: 0,
        currentPageFundedPercentage: 0,
        currentPageOverfundedPercentage: 0,
        availablePercentage: 100,
        isOutOfFunds: false
      };
    }

    const totalCents = currentBalance.totalUsdCents;
    const currentPageCents = allocationState.currentAllocationCents;

    if (shouldUseDemoBalance) {
      // For demo balance: we need to calculate the bar segments correctly
      // The key insight: "other pages" should NEVER change when we allocate to "this page"
      //
      // The context's allocatedUsdCents includes ALL allocations (other pages + this page).
      // To get "other pages", we subtract the current page's allocation (using optimistic value).
      const contextAllocatedCents = currentBalance.allocatedUsdCents;

      // Calculate other pages as: total allocated (from context) minus CURRENT (optimistic) this page value
      // This ensures "other pages" remains constant when we change "this page" allocation
      const otherPagesCents = Math.max(0, contextAllocatedCents - currentPageCents);

      // Split current page allocation into funded and overfunded portions
      const availableFundsForCurrentPage = Math.max(0, totalCents - otherPagesCents);
      const currentPageFundedCents = Math.min(currentPageCents, availableFundsForCurrentPage);
      const currentPageOverfundedCents = Math.max(0, currentPageCents - availableFundsForCurrentPage);

      // Calculate available funds correctly:
      // Available = Total - Other Pages - Current Page Funded (overfunded doesn't consume available funds)
      const optimisticAvailableCents = Math.max(0, totalCents - otherPagesCents - currentPageFundedCents);
      const isOutOfFunds = optimisticAvailableCents <= 0 && totalCents > 0;

      // For display purposes, show all sections proportionally and ensure slices sum correctly.
      const displayTotal = Math.max(
        otherPagesCents + currentPageFundedCents + currentPageOverfundedCents + optimisticAvailableCents,
        1
      );

      const otherPagesPercentage = displayTotal > 0 ? (otherPagesCents / displayTotal) * 100 : 0;
      const currentPageFundedPercentage = displayTotal > 0 ? (currentPageFundedCents / displayTotal) * 100 : 0;
      const currentPageOverfundedPercentage = displayTotal > 0 ? (currentPageOverfundedCents / displayTotal) * 100 : 0;
      const availablePercentage = displayTotal > 0 ? (optimisticAvailableCents / displayTotal) * 100 : 0;

      return {
        otherPagesPercentage,
        currentPageFundedPercentage,
        currentPageOverfundedPercentage,
        availablePercentage,
        isOutOfFunds
      };
    } else {
      // For real balance: balance data IS optimistically updated
      // So we can use the balance data directly
      const allocatedCents = currentBalance.allocatedUsdCents;
      const availableCents = currentBalance.availableUsdCents;

      const otherFromAllocated = Math.max(0, allocatedCents - currentPageCents);
      const otherFromBalances = Math.max(0, totalCents - availableCents - currentPageCents);
      const otherPagesCents = Math.max(otherFromAllocated, otherFromBalances);

      // Split current page allocation into funded and overfunded portions
      const availableFundsForCurrentPage = Math.max(0, totalCents - otherPagesCents);
      const currentPageFundedCents = Math.min(currentPageCents, availableFundsForCurrentPage);
      const currentPageOverfundedCents = Math.max(0, currentPageCents - availableFundsForCurrentPage);

      // Calculate available funds correctly:
      // Available = Total - Other Pages - Current Page Funded (overfunded doesn't consume available funds)
      const recalculatedAvailableCents = Math.max(0, totalCents - otherPagesCents - currentPageFundedCents);
      const isOutOfFunds = recalculatedAvailableCents <= 0 && totalCents > 0;

      // For display purposes, show all sections proportionally and ensure slices sum correctly.
      const displayTotal = Math.max(
        otherPagesCents + currentPageFundedCents + currentPageOverfundedCents + recalculatedAvailableCents,
        1
      );

      const otherPagesPercentage = displayTotal > 0 ? (otherPagesCents / displayTotal) * 100 : 0;
      const currentPageFundedPercentage = displayTotal > 0 ? (currentPageFundedCents / displayTotal) * 100 : 0;
      const currentPageOverfundedPercentage = displayTotal > 0 ? (currentPageOverfundedCents / displayTotal) * 100 : 0;
      const availablePercentage = displayTotal > 0 ? (recalculatedAvailableCents / displayTotal) * 100 : 0;

      return {
        otherPagesPercentage,
        currentPageFundedPercentage,
        currentPageOverfundedPercentage,
        availablePercentage,
        isOutOfFunds
      };
    }
  };

  const compositionData = getCompositionData();
  const otherWidth = compositionData.otherPagesPercentage > 0
    ? `max(${compositionData.otherPagesPercentage}%, 4px)`
    : '0%';

  const handleModalAllocationChange = async (newAllocationCents: number) => {
    const delta = newAllocationCents - allocationState.currentAllocationCents;
    setOptimisticAllocation(newAllocationCents);
    if (delta !== 0) {
      await handleAllocationChange(delta, undefined as any);
    }
  };

  // Use override interval if provided, otherwise use user's configured interval
  const effectiveIntervalCents = overrideIntervalCents ?? allocationIntervalCents;

  const handleButtonClick = (direction: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLongPressing.current) {
      isLongPressing.current = false;
      return;
    }

    // Trigger game-like animations for increases
    if (direction > 0) {
      setShowPulse(true);
      setShowParticles(true);
      // Reset animations after they complete
      setTimeout(() => setShowPulse(false), 600);
      setTimeout(() => setShowParticles(false), 1000);
    }

    // Allow all users (including page owners) to allocate
    // Use our shared allocation change handler - it handles both logged-in and logged-out users
    // Use effective interval (override or user's configured amount)
    const changeAmount = direction * effectiveIntervalCents;
    handleAllocationChange(changeAmount, e);
  };

  // Long press handlers
  const closeIntervalModal = () => {
    isLongPressing.current = false;
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    setShowIntervalModal(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Skip long-press behavior if disabled
    if (disableLongPress) return;

    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressing.current = true;
      setShowIntervalModal(true);
    }, 500);
  };

  const handleMouseUp = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    isLongPressing.current = false;
  };

  const handleOutOfFunds = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Trigger the insufficient funds modal by attempting an allocation
    const changeAmount = allocationIntervalCents;
    handleAllocationChange(changeAmount, e);
  };

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  // Don't render for page owners or when loading critical data
  // For demo balance users, don't wait for USD balance loading
  const isLoadingCriticalData = shouldUseDemoBalance ? intervalLoading : (usdLoading && intervalLoading);
  if (isPageOwner || isLoadingCriticalData) {
    return null;
  }

  // Show loading state while data loads
  if (allocationState.isLoading || usdLoading || intervalLoading) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
        <div className="flex-1 h-8 bg-muted rounded animate-pulse" />
        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  // For logged-out users, we'll use demo balance - no need to show login prompt

  return (
    <div className={cn("w-full", className)}>
      {/* Allocation amount display above the controls */}
      <AllocationAmountDisplay
        allocationCents={allocationState.currentAllocationCents}
        availableBalanceCents={(shouldUseDemoBalance ? demoBalance : usdBalance)?.availableUsdCents || 0}
        variant="page"
        isOverBudget={compositionData.currentPageOverfundedPercentage > 0}
      />

      <div className="flex items-center gap-3">
        {/* Minus button on left - now outline for consistency */}
        <Button
          size="sm"
          variant="secondary"
          className={cn(
            "h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0 border border-neutral-20",
            minusButtonPressed && "scale-95",
            minusButtonHovered && "bg-secondary/80"
          )}
          onClick={(e) => handleButtonClick(-1, e)}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          disabled={isProcessing || allocationState.currentAllocationCents <= 0}
        >
          <Icon name="Minus" size={16} />
        </Button>

        {/* Composition bar with centered dollar amount */}
        <CompositionBar
          data={compositionData}
          showPulse={showPulse}
          showParticles={showParticles}
          onPulseComplete={() => setShowPulse(false)}
          onParticlesComplete={() => setShowParticles(false)}
          size="sm"
          className={enableBarClickZones ? "cursor-pointer" : undefined}
          clickable={enableBarClickZones || !disableDetailModal}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();

            // Handle click zones if enabled
            if (enableBarClickZones) {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const halfWidth = rect.width / 2;

              if (clickX < halfWidth) {
                // Left half - trigger minus
                setMinusButtonPressed(true);
                setTimeout(() => setMinusButtonPressed(false), 150);
                if (allocationState.currentAllocationCents > 0) {
                  handleButtonClick(-1, e);
                }
              } else {
                // Right half - trigger plus
                setPlusButtonPressed(true);
                setTimeout(() => setPlusButtonPressed(false), 150);
                if (!compositionData.isOutOfFunds) {
                  handleButtonClick(1, e);
                } else {
                  handleOutOfFunds(e);
                }
              }
              return;
            }

            // Only open modal if not disabled
            if (!disableDetailModal) {
              setShowAllocationModal(true);
            }
          }}
        />

        {/* Plus button on right */}
        <Button
          size="sm"
          variant="secondary"
          className={cn(
            "h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0 border border-neutral-20",
            highlightPlusButton && "ring-4 ring-primary/40 animate-pulse border-primary",
            plusButtonPressed && "scale-95",
            plusButtonHovered && "bg-secondary/80"
          )}
          onClick={(e) => compositionData.isOutOfFunds ? handleOutOfFunds(e) : handleButtonClick(1, e)}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          disabled={isProcessing}
        >
          <Icon name="Plus" size={16} />
        </Button>
      </div>

      {/* Allocation Interval Modal */}
      <AllocationIntervalModal
        isOpen={showIntervalModal}
        onClose={closeIntervalModal}
      />

      <UsdAllocationModal
        isOpen={showAllocationModal}
        onClose={() => setShowAllocationModal(false)}
        pageId={pageId}
        pageTitle={pageTitle}
        authorId={authorId}
        currentAllocation={allocationState.currentAllocationCents}
        onAllocationChange={handleModalAllocationChange}
      />

    </div>
  );
}
