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
import { useAllocationInterval } from '../../contexts/AllocationIntervalContext';
import { useRouter } from 'next/navigation';
import { useToast } from '../ui/use-toast';
import { cn } from '../../lib/utils';
import { AllocationIntervalModal } from './AllocationIntervalModal';
import { AllocationAmountDisplay } from './AllocationAmountDisplay';
import { useAllocationState } from '../../hooks/useAllocationState';
import { useAllocationActions } from '../../hooks/useAllocationActions';
import { logAllocationEvent } from '../../utils/debugStateChanges';
import { EmbeddedAllocationBarProps, CompositionBarData } from '../../types/allocation';

export function EmbeddedAllocationBar({
  pageId,
  authorId,
  pageTitle,
  className,
  source = 'EmbeddedCard'
}: EmbeddedAllocationBarProps) {
  const { user } = useAuth();
  const { usdBalance, isLoading: usdLoading } = useUsdBalance();
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
  const { allocationState, setOptimisticAllocation } = useAllocationState({
    pageId,
    enabled: !isPageOwner // Enable for both logged-in and logged-out users
  });

  const { handleAllocationChange, isProcessing } = useAllocationActions({
    pageId,
    authorId,
    pageTitle,
    currentAllocationCents: allocationState.currentAllocationCents,
    source,
    onOptimisticUpdate: setOptimisticAllocation
  });

  // Calculate composition bar data
  const getCompositionData = (): CompositionBarData => {
    if (!usdBalance) {
      return {
        otherPagesPercentage: 0,
        currentPagePercentage: 0,
        availablePercentage: 100,
        isOutOfFunds: false
      };
    }

    const totalCents = usdBalance.totalUsdCents;
    const allocatedCents = usdBalance.allocatedUsdCents;
    const availableCents = usdBalance.availableUsdCents;

    const otherPagesCents = Math.max(0, allocatedCents - allocationState.currentAllocationCents);
    const isOutOfFunds = availableCents <= 0 && totalCents > 0;

    // Calculate percentages for composition bar
    const otherPagesPercentage = totalCents > 0 ? (otherPagesCents / totalCents) * 100 : 0;
    const currentPagePercentage = totalCents > 0 ? (allocationState.currentAllocationCents / totalCents) * 100 : 0;
    const availablePercentage = totalCents > 0 ? Math.max(0, (availableCents / totalCents) * 100) : 0;

    return {
      otherPagesPercentage,
      currentPagePercentage,
      availablePercentage,
      isOutOfFunds
    };
  };

  const compositionData = getCompositionData();

  const handleButtonClick = (direction: number, e: React.MouseEvent) => {
    logAllocationEvent('EmbeddedBar_ButtonClick', {
      pageId,
      authorId,
      direction,
      isPageOwner,
      hasUser: !!user,
      currentAllocation: allocationState.currentAllocationCents
    });

    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      logAllocationEvent('EmbeddedBar_RedirectToLogin', { pageId });
      router.push('/auth/login');
      return;
    }

    if (isPageOwner) {
      logAllocationEvent('EmbeddedBar_PageOwnerBlocked', { pageId, authorId });
      return;
    }

    // Use our shared allocation change handler
    logAllocationEvent('EmbeddedBar_HandleAllocationChange', {
      pageId,
      direction,
      currentAllocation: allocationState.currentAllocationCents
    });
    handleAllocationChange(direction as 1 | -1, e);
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
    router.push('/settings/fund-account');
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
  if (isPageOwner || (usdLoading && intervalLoading)) {
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

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3 text-xs"
          onClick={() => router.push('/auth/login')}
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
        availableBalanceCents={usdBalance?.availableUsdCents || 0}
        variant="page"
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

            {/* Current page (spent here) - center, primary color */}
            {compositionData.currentPagePercentage > 0 && (
              <div
                className={cn(
                  "rounded-md transition-all duration-300 ease-out",
                  compositionData.isOutOfFunds ? "bg-orange-500" : "bg-primary"
                )}
                style={{ width: `${compositionData.currentPagePercentage}%` }}
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
          className="h-8 w-8 p-0 active:scale-95 transition-all duration-150 flex-shrink-0"
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
