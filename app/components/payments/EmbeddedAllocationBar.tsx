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
import { Button } from '../ui/button';
import { Plus, Minus } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { ALLOCATION_BAR_STYLES } from '../../constants/allocation-styles';
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
import { getLoggedOutPageAllocation, getUserPageAllocation } from '../../utils/simulatedUsd';

export function EmbeddedAllocationBar({
  pageId,
  authorId,
  pageTitle,
  className,
  source = 'EmbeddedCard'
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

  const handleButtonClick = (direction: number, e: React.MouseEvent) => {
    console.log('🔵 EmbeddedAllocationBar: Button clicked!', { direction, pageId, authorId });
    e.preventDefault();
    e.stopPropagation();

    // Allow all users (including page owners) to allocate
    // Use our shared allocation change handler - it handles both logged-in and logged-out users
    // Use the user's configured increment amount
    const changeAmount = direction * allocationIntervalCents;
    console.log('🔵 EmbeddedAllocationBar: Calling handleAllocationChange', { changeAmount, pageId });
    handleAllocationChange(changeAmount, e);
  };

  // Long press handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressing.current = true;
      setShowIntervalModal(true);
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
    isLongPressing.current = false;
  };

  const handleMouseLeave = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
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
      />

      <div className="flex items-center gap-3">
        {/* Minus button on left - now outline for consistency */}
        <Button
          size="sm"
          variant="secondary"
          className="h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0 border-2 border-neutral-20"
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
                className={ALLOCATION_BAR_STYLES.sections.other}
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
          variant="secondary"
          className="h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0 border-2 border-neutral-20"
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
