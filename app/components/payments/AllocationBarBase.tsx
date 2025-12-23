"use client";

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../providers/AuthProvider';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { useAllocationInterval } from '../../contexts/AllocationIntervalContext';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import {
  BaseAllocationProps,
  AllocationBarVariant,
  CompositionBarData,
  UseCompositionBarReturn
} from '../../types/allocation';
import { useAllocationState } from '../../hooks/useAllocationState';
import { useAllocationActions } from '../../hooks/useAllocationActions';
import { AllocationAmountDisplay } from './AllocationAmountDisplay';
import { AllocationIntervalModal } from './AllocationIntervalModal';
import { CompositionBar } from './CompositionBar';
import { usePillStyle } from '../../contexts/PillStyleContext';

/**
 * Base component for all allocation bars
 * 
 * This component provides the core allocation functionality that can be
 * extended by specific allocation bar implementations (floating, embedded, etc.)
 */

interface AllocationBarBaseProps extends BaseAllocationProps {
  variant: AllocationBarVariant;
  className?: string;
  showAmountDisplay?: boolean;
  showCompositionBar?: boolean;
  showControls?: boolean;
  buttonSize?: 'sm' | 'md' | 'lg';
  buttonVariant?: 'default' | 'outline' | 'ghost';
  disabled?: boolean;
}

// Hook for composition bar calculations with optimistic updates
function useCompositionBar(
  currentAllocationCents: number,
  usdBalance: any,
  optimisticAllocation?: number | null
): UseCompositionBarReturn {
  return useMemo(() => {
    if (!usdBalance) {
      return {
        compositionData: {
          otherPagesPercentage: 0,
          currentPageFundedPercentage: 0,
          currentPageOverfundedPercentage: 0,
          availablePercentage: 100,
          isOutOfFunds: false
        },
        isOutOfFunds: false,
        hasBalance: false
      };
    }

    const totalCents = usdBalance.totalUsdCents;

    // Use optimistic allocation for current page (if available)
    const currentPageCents = optimisticAllocation ?? currentAllocationCents;

    // Other pages allocation: reconcile allocated vs (total - available) to avoid stale data
    const otherFromAllocated = Math.max(0, usdBalance.allocatedUsdCents - currentPageCents);
    const otherFromBalances = Math.max(0, usdBalance.totalUsdCents - usdBalance.availableUsdCents - currentPageCents);
    const otherPagesCents = Math.max(otherFromAllocated, otherFromBalances);

    // Funds available for this page after other allocations
    const availableFundsForCurrentPage = Math.max(0, totalCents - otherPagesCents);

    // Split current page allocation into funded and overfunded portions
    const currentPageFundedCents = Math.min(currentPageCents, availableFundsForCurrentPage);
    const currentPageOverfundedCents = Math.max(0, currentPageCents - availableFundsForCurrentPage);

    // Available funds after accounting for funded portion of this page
    const optimisticAvailableCents = Math.max(0, totalCents - otherPagesCents - currentPageFundedCents);
    const isOutOfFunds = optimisticAvailableCents <= 0 && totalCents > 0;

    // Display proportions (include overfunded and available so slices remain consistent)
    const displayTotal = Math.max(
      otherPagesCents + currentPageFundedCents + currentPageOverfundedCents + optimisticAvailableCents,
      1
    );

    const otherPagesPercentage = displayTotal > 0 ? (otherPagesCents / displayTotal) * 100 : 0;
    const currentPageFundedPercentage = displayTotal > 0 ? (currentPageFundedCents / displayTotal) * 100 : 0;
    const currentPageOverfundedPercentage = displayTotal > 0 ? (currentPageOverfundedCents / displayTotal) * 100 : 0;
    const availablePercentage = displayTotal > 0 ? (optimisticAvailableCents / displayTotal) * 100 : 0;

    return {
      compositionData: {
        otherPagesPercentage,
        currentPageFundedPercentage,
        currentPageOverfundedPercentage,
        availablePercentage,
        isOutOfFunds
      },
      isOutOfFunds,
      hasBalance: totalCents > 0
    };
  }, [currentAllocationCents, usdBalance, optimisticAllocation]);
}

export function AllocationBarBase({
  pageId,
  authorId,
  pageTitle,
  variant,
  source,
  className,
  showAmountDisplay = true,
  showCompositionBar = true,
  showControls = true,
  buttonSize = 'sm',
  buttonVariant = 'outline',
  disabled = false
}: AllocationBarBaseProps) {
  const { user } = useAuth();
  const { usdBalance } = useUsdBalance();
  const { allocationIntervalCents, isLoading: intervalLoading } = useAllocationInterval();
  const router = useRouter();

  // Get UI style for shiny mode
  let isShinyMode = false;
  try {
    const pillStyleContext = usePillStyle();
    isShinyMode = pillStyleContext?.isShinyUI ?? false;
  } catch {
    isShinyMode = false;
  }

  // Check if current user is the page owner
  const isPageOwner = !!(user && authorId && user.uid === authorId);

  // Use allocation state hook
  const { allocationState, setOptimisticAllocation } = useAllocationState({
    pageId,
    enabled: !isPageOwner
  });

  // Use allocation actions hook
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
    onOptimisticUpdate: setOptimisticAllocation
  });

  // Use composition bar hook with optimistic allocation
  const { compositionData, isOutOfFunds, hasBalance } = useCompositionBar(
    allocationState.currentAllocationCents,
    usdBalance,
    allocationState.isOptimistic ? allocationState.currentAllocationCents : null
  );

  // Game-like animation state for allocation increases
  const [showParticles, setShowParticles] = useState(false);
  const [showPulse, setShowPulse] = useState(false);

  // Long press handling for interval modal
  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressing = useRef(false);

  // Long press handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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

  const closeIntervalModal = () => {
    isLongPressing.current = false;
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    setShowIntervalModal(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  // Wrapper for allocation change that triggers animations
  const handleAllocationChangeWithAnimation = (amount: number, event?: React.MouseEvent) => {
    // Skip if long pressing
    if (isLongPressing.current) {
      isLongPressing.current = false;
      return;
    }

    // Trigger game-like animations for increases
    if (amount > 0) {
      setShowPulse(true);
      setShowParticles(true);
      // Reset animations after they complete
      setTimeout(() => setShowPulse(false), 600);
      setTimeout(() => setShowParticles(false), 1000);
    }

    // Call the original handler
    return handleAllocationChange(amount, event);
  };

  // Don't render for page owners or when loading critical data
  if (isPageOwner || (allocationState.isLoading && intervalLoading)) {
    return null;
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <Button
          size={buttonSize}
          variant="secondary"
          className="h-8 px-3 text-xs"
          onClick={() => router.push('/auth/login')}
        >
          Login to allocate funds
        </Button>
      </div>
    );
  }

  // Loading state
  if (allocationState.isLoading || intervalLoading) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
        <div className="flex-1 h-8 bg-muted rounded animate-pulse" />
        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Allocation amount display */}
      {showAmountDisplay && (
        <AllocationAmountDisplay
          allocationCents={allocationState.currentAllocationCents}
          availableBalanceCents={usdBalance?.availableUsdCents || 0}
          variant={variant === 'user' ? 'user' : 'page'}
          isOverBudget={compositionData.currentPageOverfundedPercentage > 0}
        />
      )}

      {/* Out of funds message */}
      {isOutOfFunds && (
        <div className="text-center text-sm text-error font-medium mb-2">
          Out of funds
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className="flex items-center gap-3">
          {/* Minus button */}
          <Button
            size={buttonSize}
            variant={buttonVariant}
            className={cn(
              "h-8 w-8 p-0 active:scale-95 transition-all duration-150 flex-shrink-0 bg-secondary hover:bg-secondary/80 border border-neutral-20",
              buttonVariant === 'ghost' && "hover:bg-destructive/20"
            )}
            onClick={(e) => handleAllocationChangeWithAnimation(-allocationIntervalCents, e)}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            disabled={disabled || isProcessing || allocationState.currentAllocationCents <= 0}
          >
            <Icon name="Minus" size={16} />
          </Button>

          {/* Composition bar */}
          {showCompositionBar && (
            <div className="flex-1 h-8 relative bg-muted rounded-lg p-1">
              <CompositionBar
                data={compositionData}
                showPulse={showPulse}
                showParticles={showParticles}
                onPulseComplete={() => setShowPulse(false)}
                onParticlesComplete={() => setShowParticles(false)}
                size="md"
                isShinyMode={isShinyMode}
                className="h-full"
              />
            </div>
          )}

          {/* Plus button */}
          <Button
            size={buttonSize}
            variant={buttonVariant}
            className="h-8 w-8 p-0 active:scale-95 transition-all duration-150 flex-shrink-0 bg-secondary hover:bg-secondary/80 border border-neutral-20"
            onClick={(e) => handleAllocationChangeWithAnimation(allocationIntervalCents, e)}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            disabled={disabled || isProcessing}
          >
            <Icon name="Plus" size={16} />
          </Button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-center text-sm text-destructive mt-2">
          {error}
        </div>
      )}

      {/* Allocation Interval Modal */}
      <AllocationIntervalModal
        isOpen={showIntervalModal}
        onClose={closeIntervalModal}
      />
    </div>
  );
}
