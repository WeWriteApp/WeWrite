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

interface EmbeddedAllocationBarProps {
  pageId: string;
  authorId: string;
  pageTitle: string;
  className?: string;
  source?: string;
}

export function EmbeddedAllocationBar({
  pageId,
  authorId,
  pageTitle,
  className,
  source = 'EmbeddedCard'
}: EmbeddedAllocationBarProps) {
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
  const pendingChangeCents = useRef(0);

  // Long press handling
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressing = useRef(false);

  // Don't show for page owners
  const isPageOwner = user?.uid === authorId;

  // Fetch current allocation for this page
  useEffect(() => {
    if (!pageId || !user?.uid || isPageOwner) {
      setIsLoading(false);
      return;
    }

    const fetchAllocation = async () => {
      try {
        const response = await fetch(`/api/usd/allocation?pageId=${pageId}&userId=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentPageAllocationCents(data.allocationCents || 0);
        }
      } catch (error) {
        console.error('Error fetching allocation:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllocation();
  }, [pageId, user?.uid, isPageOwner]);

  // Handle allocation changes with batching
  const handleAllocationChange = async (changeCents: number) => {
    if (!user?.uid || isPageOwner) return;

    // Optimistic update
    setCurrentPageAllocationCents(prev => Math.max(0, prev + changeCents));
    updateOptimisticBalance(changeCents);

    // Add to pending changes
    pendingChangeCents.current += changeCents;

    // Clear existing timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    // Set new timeout to batch the API call
    batchTimeoutRef.current = setTimeout(async () => {
      const totalChangeCents = pendingChangeCents.current;
      pendingChangeCents.current = 0;

      try {
        const response = await fetch('/api/usd/allocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId,
            changeCents: totalChangeCents,
            pageTitle,
            authorId,
            source
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update allocation');
        }
      } catch (error) {
        console.error('Error updating allocation:', error);
        // Revert optimistic update on error
        setCurrentPageAllocationCents(prev => Math.max(0, prev - totalChangeCents));
        updateOptimisticBalance(-totalChangeCents);
        
        toast({
          title: "Error",
          description: "Failed to update allocation. Please try again.",
          variant: "destructive",
        });
      }
    }, 500); // 500ms debounce
  };

  const handleButtonClick = (direction: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      router.push('/auth/login');
      return;
    }

    if (isPageOwner) return;

    const changeCents = direction * (allocationIntervalCents || 100); // Default to $1.00
    handleAllocationChange(changeCents);
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
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
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
          onClick={() => router.push('/auth/login')}
        >
          Login to allocate funds
        </Button>
      </div>
    );
  }

  // Work directly with USD cents - no conversion needed
  const totalCents = usdBalance?.totalUsdCents || 0;
  const allocatedCents = usdBalance?.allocatedUsdCents || 0;
  const availableCents = totalCents - allocatedCents;

  // Calculate USD distribution for composition bar
  const otherPagesCents = Math.max(0, allocatedCents - currentPageAllocationCents);
  const isOutOfFunds = availableCents <= 0;

  // Calculate percentages for the composition bar (order: other, this, available)
  const otherPagesPercentage = totalCents > 0 ? (otherPagesCents / totalCents) * 100 : 0;
  const currentPagePercentage = totalCents > 0 ? (currentPageAllocationCents / totalCents) * 100 : 0;
  const availablePercentage = totalCents > 0 ? (availableCents / totalCents) * 100 : 0;

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
