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
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useDemoBalance, useShouldUseDemoBalance } from '../../contexts/DemoBalanceContext';
import { useAllocationInterval } from '../../contexts/AllocationIntervalContext';
import { AllocationIntervalModal } from './AllocationIntervalModal';
import { AllocationAmountDisplay } from './AllocationAmountDisplay';
import { useAllocationState } from '../../hooks/useAllocationState';
import { useAllocationActions } from '../../hooks/useAllocationActions';
import { AllocationControlsProps, CompositionBarData } from '../../types/allocation';
import { getLoggedOutPageAllocation, getUserPageAllocation } from '../../utils/simulatedUsd';

export function AllocationControls({
  pageId,
  authorId,
  pageTitle = '',
  className,
  source = 'ActivityCard'
}: AllocationControlsProps) {
  const { user } = useAuth();
  const { usdBalance, isLoading: usdLoading } = useUsdBalance();
  const { hasActiveSubscription } = useSubscription();
  const shouldUseDemoBalance = useShouldUseDemoBalance(hasActiveSubscription);
  const { demoBalance } = useDemoBalance();
  const { allocationIntervalCents, isLoading: intervalLoading } = useAllocationInterval();
  const router = useRouter();
  const { toast } = useToast();

  const [showIntervalModal, setShowIntervalModal] = useState(false);

  // Long press handling
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressing = useRef(false);

  // Check if current user is the page owner
  const isPageOwner = user?.uid === authorId;

  // Use our shared hooks
  const { allocationState, refreshAllocation, setOptimisticAllocation } = useAllocationState({
    pageId,
    enabled: !isPageOwner // Enable for both logged-in and logged-out users
  });

  const { handleAllocationChange, isProcessing } = useAllocationActions({
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
      // For demo balance: balance data is NOT optimistically updated
      // So we need to calculate optimistic values manually
      const originalAllocatedCents = currentBalance.allocatedUsdCents;
      const originalAvailableCents = currentBalance.availableUsdCents;

      // Calculate what the original allocation for this page was
      // We can get this from the demo balance localStorage
      const originalCurrentPageCents = !user?.uid ?
        getLoggedOutPageAllocation(pageId) :
        getUserPageAllocation(user.uid, pageId);

      const otherPagesCents = Math.max(0, originalAllocatedCents - originalCurrentPageCents);

      // Split current page allocation into funded and overfunded portions
      const availableFundsForCurrentPage = Math.max(0, totalCents - otherPagesCents);
      const currentPageFundedCents = Math.min(currentPageCents, availableFundsForCurrentPage);
      const currentPageOverfundedCents = Math.max(0, currentPageCents - availableFundsForCurrentPage);

      // Calculate available funds correctly:
      // Available = Total - Other Pages - Current Page Funded (overfunded doesn't consume available funds)
      const optimisticAvailableCents = Math.max(0, totalCents - otherPagesCents - currentPageFundedCents);
      const isOutOfFunds = optimisticAvailableCents <= 0 && totalCents > 0;

      // For display purposes, show all sections proportionally
      // The display total should be the subscription amount plus any overspent amount
      const displayTotal = totalCents + currentPageOverfundedCents;

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

      const otherPagesCents = Math.max(0, allocatedCents - currentPageCents);

      // Split current page allocation into funded and overfunded portions
      const availableFundsForCurrentPage = Math.max(0, totalCents - otherPagesCents);
      const currentPageFundedCents = Math.min(currentPageCents, availableFundsForCurrentPage);
      const currentPageOverfundedCents = Math.max(0, currentPageCents - availableFundsForCurrentPage);

      // Calculate available funds correctly:
      // Available = Total - Other Pages - Current Page Funded (overfunded doesn't consume available funds)
      const recalculatedAvailableCents = Math.max(0, totalCents - otherPagesCents - currentPageFundedCents);
      const isOutOfFunds = recalculatedAvailableCents <= 0 && totalCents > 0;

      // For display purposes, show all sections proportionally
      // The display total should be the subscription amount plus any overspent amount
      const displayTotal = totalCents + currentPageOverfundedCents;

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

  // Handle click when not logged in
  const handleLoginRequired = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    router.push('/auth/login');
  };

  // Handle click when out of funds - trigger allocation to show modal
  const handleOutOfFunds = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    // Trigger the insufficient funds modal by attempting an allocation
    const changeAmount = allocationIntervalCents;
    handleAllocationChange(changeAmount, event);
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
    // Use the user's configured increment amount
    const changeAmount = direction * allocationIntervalCents;
    handleAllocationChange(changeAmount, event);
  };

  // Don't render for page owners
  if (isPageOwner) {
    return null;
  }

  // Show loading state while data loads
  // For demo balance users, don't wait for USD balance loading
  const isLoadingCriticalData = allocationState.isLoading || (shouldUseDemoBalance ? false : usdLoading) || intervalLoading;
  if (isLoadingCriticalData) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
        <div className="flex-1 h-8 bg-muted rounded animate-pulse" />
        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  // For logged-out users, we now allow them to use demo balance
  // Only show login prompt if demo balance is not available
  if (!user && !shouldUseDemoBalance) {
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

  return (
    <div className={cn("w-full", className)}>
      {/* Allocation amount display above the controls */}
      <AllocationAmountDisplay
        allocationCents={allocationState.currentAllocationCents}
        availableBalanceCents={(shouldUseDemoBalance ? demoBalance : usdBalance)?.availableUsdCents || 0}
        variant="page"
      />

      <div className="flex items-center gap-3">
        {/* Minus button on left - now outline for consistency */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0"
          onClick={(e) => handleButtonClick(-1, e)}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          disabled={isProcessing || allocationState.currentAllocationCents <= 0}
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
          {compositionData.otherPagesPercentage > 0 && (
            <div
              className="bg-muted-foreground/30 rounded-md transition-all duration-300 ease-out"
              style={{ width: `${compositionData.otherPagesPercentage}%` }}
            />
          )}

          {/* Current page - funded portion */}
          {compositionData.currentPageFundedPercentage > 0 && (
            <div
              className="bg-primary rounded-md transition-all duration-300 ease-out"
              style={{ width: `${compositionData.currentPageFundedPercentage}%` }}
            />
          )}

          {/* Current page - overfunded portion */}
          {compositionData.currentPageOverfundedPercentage > 0 && (
            <div
              className="bg-orange-500 rounded-md transition-all duration-300 ease-out"
              style={{ width: `${compositionData.currentPageOverfundedPercentage}%` }}
            />
          )}

          {/* Available funds - right side */}
          {compositionData.availablePercentage > 0 && (
            <div
              className="bg-muted-foreground/10 rounded-md transition-all duration-300 ease-out"
              style={{ width: `${compositionData.availablePercentage}%` }}
            />
          )}
        </div>

      </div>

        {/* Plus button on right */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0"
          onClick={(e) => compositionData.isOutOfFunds ? handleOutOfFunds(e) : handleButtonClick(1, e)}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          disabled={isProcessing}
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
