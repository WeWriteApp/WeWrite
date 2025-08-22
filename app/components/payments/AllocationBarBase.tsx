"use client";

import React, { useMemo, useState } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { useAllocationInterval } from '../../contexts/AllocationIntervalContext';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Plus, Minus } from 'lucide-react';
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
import { ParticleAnimation, PulseAnimation } from '../ui/ParticleAnimation';
import { ALLOCATION_BAR_STYLES } from '../../constants/allocation-styles';

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
  onLongPress?: () => void;
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

    // CRITICAL FIX: Avoid double-counting optimistic updates
    // The global balance might already include optimistic updates, so we need to work backwards
    // to get the original state and then apply only the page-specific optimistic allocation

    // Use optimistic allocation for current page (if available)
    const currentPageCents = optimisticAllocation ?? currentAllocationCents;
    const originalCurrentPageCents = currentAllocationCents; // Original page allocation before optimistic updates

    // Calculate the change in current page allocation
    const pageAllocationChange = currentPageCents - originalCurrentPageCents;

    // Calculate other pages allocation from the current global state
    // If we have an optimistic page allocation, we need to account for it
    const currentGlobalAllocatedCents = usdBalance.allocatedUsdCents;
    const otherPagesCents = Math.max(0, currentGlobalAllocatedCents - originalCurrentPageCents);

    // Calculate available funds for current page (funds not allocated to other pages)
    const availableFundsForCurrentPage = Math.max(0, totalCents - otherPagesCents);

    // Split current page allocation into funded and overfunded portions
    // The funded portion cannot exceed available funds for this page
    const currentPageFundedCents = Math.min(currentPageCents, availableFundsForCurrentPage);
    const currentPageOverfundedCents = Math.max(0, currentPageCents - availableFundsForCurrentPage);

    // Calculate available funds correctly with optimistic updates:
    // Available = Total - Other Pages - Current Page Funded
    // Note: overfunded amounts don't consume available funds (they're "borrowed" from future budget)
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
  disabled = false,
  onLongPress
}: AllocationBarBaseProps) {
  const { user } = useAuth();
  const { usdBalance } = useUsdBalance();
  const { allocationIntervalCents, isLoading: intervalLoading } = useAllocationInterval();
  const router = useRouter();

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

  // Wrapper for allocation change that triggers animations
  const handleAllocationChangeWithAnimation = (amount: number, event?: React.MouseEvent) => {
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
          variant="outline"
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
              "h-8 w-8 p-0 active:scale-95 transition-all duration-150 flex-shrink-0 bg-secondary hover:bg-secondary/80 border-2 border-neutral-20",
              buttonVariant === 'ghost' && "hover:bg-destructive/20"
            )}
            onClick={(e) => handleAllocationChangeWithAnimation(-1, e)}
            disabled={disabled || isProcessing || allocationState.currentAllocationCents <= 0}
          >
            <Minus className="h-4 w-4" />
          </Button>

          {/* Composition bar */}
          {showCompositionBar && (
            <div className="flex-1 h-8 relative bg-muted rounded-lg">
              <div className="absolute inset-0 flex gap-1 p-1">
                {/* Other pages (spent elsewhere) - use neutral color system */}
                {compositionData.otherPagesPercentage > 0 && (
                  <div
                    className={ALLOCATION_BAR_STYLES.sections.other}
                    style={{ width: `${compositionData.otherPagesPercentage}%` }}
                  />
                )}

                {/* Current page - funded portion with game-like animations */}
                {compositionData.currentPageFundedPercentage > 0 && (
                  <div
                    className={cn(
                      "bg-primary rounded-md transition-all duration-300 ease-out relative overflow-hidden",
                      showPulse && "animate-allocation-pulse"
                    )}
                    style={{ width: `${compositionData.currentPageFundedPercentage}%` }}
                  >
                    {/* Pulse animation overlay */}
                    <PulseAnimation
                      trigger={showPulse}
                      onComplete={() => setShowPulse(false)}
                      className="bg-primary rounded-md"
                      intensity={1.05}
                    />

                    {/* Particle animation */}
                    <ParticleAnimation
                      trigger={showParticles}
                      onComplete={() => setShowParticles(false)}
                      particleCount={6}
                      duration={800}
                      color="hsl(var(--primary))"
                    />
                  </div>
                )}

                {/* Current page - overfunded portion */}
                {compositionData.currentPageOverfundedPercentage > 0 && (
                  <div
                    className={ALLOCATION_BAR_STYLES.sections.overspent}
                    style={{ width: `${compositionData.currentPageOverfundedPercentage}%` }}
                  />
                )}

                {/* Available funds - use neutral color system */}
                {compositionData.availablePercentage > 0 && (
                  <div
                    className="bg-muted rounded-md transition-all duration-300 ease-out"
                    style={{ width: `${compositionData.availablePercentage}%` }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Plus button */}
          <Button
            size={buttonSize}
            variant={buttonVariant}
            className="h-8 w-8 p-0 active:scale-95 transition-all duration-150 flex-shrink-0 bg-secondary hover:bg-secondary/80 border-2 border-neutral-20"
            onClick={(e) => handleAllocationChangeWithAnimation(allocationIntervalCents, e)}
            disabled={disabled || isProcessing}
            onContextMenu={onLongPress ? (e) => {
              e.preventDefault();
              onLongPress();
            } : undefined}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-center text-sm text-destructive mt-2">
          {error}
        </div>
      )}

    </div>
  );
}
