"use client";

/**
 * EmbeddedTokenAllocation Component
 *
 * A compact dollar allocation interface designed for embedding in activity cards.
 * Features:
 * - Plus/minus buttons for quick dollar allocation (in $0.10 increments)
 * - Visual composition bar showing allocation distribution
 * - Centered dollar amount display for THIS PAGE allocation
 * - Optimistic updates for responsive UX
 * - Handles authentication and balance states
 *
 * Note: Despite the name "TokenAllocation", this component now uses the USD system
 * internally but maintains backward compatibility with token-based calculations.
 */

import React, { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useAuth } from '../../providers/AuthProvider';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { formatUsdCents, centsToDollars } from '../../utils/formatCurrency';
import { useRouter } from 'next/navigation';
import { useToast } from '../ui/use-toast';
import { getNextMonthlyProcessingDate } from '../../utils/subscriptionTiers';

interface EmbeddedTokenAllocationProps {
  pageId: string;
  authorId: string;
  pageTitle?: string;
  className?: string;
  source?: 'HomePage' | 'ContentPage';
}

export function EmbeddedTokenAllocation({
  pageId,
  authorId,
  pageTitle,
  className,
  source = 'HomePage'
}: EmbeddedTokenAllocationProps) {
  const { user } = useAuth();
  const { usdBalance, isLoading: usdLoading, updateOptimisticBalance } = useUsdBalance();
  const router = useRouter();
  const { toast } = useToast();

  const [currentPageAllocation, setCurrentPageAllocation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to show USD allocation notification
  const showUsdAllocationNotification = (usdCents: number) => {
    const nextProcessingDate = getNextMonthlyProcessingDate();
    const formattedDate = nextProcessingDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });

    toast({
      title: `${formatUsdCents(usdCents)} allocated!`,
      description: `Your allocation isn't final until ${formattedDate} when monthly processing occurs. You can adjust it anytime before then.`,
      duration: 6000, // Show for 6 seconds
    });
  };

  // Load current page allocation only
  useEffect(() => {
    if (!user || !pageId) return;

    const loadPageAllocation = async () => {
      try {
        const response = await fetch(`/api/usd/pledge-bar-data?pageId=${pageId}`);
        if (response.ok) {
          const result = await response.json();
          const data = result.data;
          // Convert USD cents to tokens for backward compatibility
          const usdCents = data.currentPageAllocationCents || 0;
          const tokens = Math.floor(centsToDollars(usdCents) * 10);
          setCurrentPageAllocation(tokens);
        }
      } catch (error) {
        console.error('Error loading page allocation:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPageAllocation();
  }, [user, pageId]);

  // Handle USD allocation change
  const handleTokenChange = async (change: number, event: React.MouseEvent) => {
    // Prevent event bubbling to parent card
    event.stopPropagation();
    event.preventDefault();

    if (!user || !pageId) return;

    const newAllocation = Math.max(0, currentPageAllocation + change);

    // Convert tokens to USD cents for API call
    const newAllocationCents = Math.floor((newAllocation / 10) * 100);
    const changeCents = Math.floor((change / 10) * 100);

    // Optimistic updates
    const previousAllocation = currentPageAllocation;
    setCurrentPageAllocation(newAllocation);
    updateOptimisticBalance(changeCents);

    // No need to set updating state - buttons stay enabled

    try {
      const response = await fetch('/api/usd/page-allocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientUserId: authorId,
          resourceType: 'page',
          resourceId: pageId,
          usdCents: newAllocationCents,
          source: source // Track where allocation came from
        })
      });

      if (!response.ok) {
        // Rollback on error
        setCurrentPageAllocation(previousAllocation);
        updateOptimisticBalance(-changeCents);
        const errorData = await response.json();
        toast({
          title: "Allocation Failed",
          description: errorData.error || "Failed to allocate tokens",
          variant: "destructive"
        });
        return;
      }

      const result = await response.json();

      // Show notification for USD allocation (only for positive changes)
      if (change > 0) {
        showUsdAllocationNotification(Math.abs(changeCents));
      }

      // Update current page allocation with server response
      if (result.currentAllocationCents !== undefined) {
        // Convert USD cents back to tokens for display
        const tokens = Math.floor(centsToDollars(result.currentAllocationCents) * 10);
        setCurrentPageAllocation(tokens);
      }

      // Log analytics event
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'token_allocated', {
          event_category: 'tokens',
          event_label: source,
          value: Math.abs(change),
          custom_parameters: {
            page_id: pageId,
            allocation_source: source,
            new_total: newAllocation
          }
        });
      }

    } catch (error) {
      // Rollback on error
      setCurrentPageAllocation(previousAllocation);
      updateOptimisticBalance(-changeCents);
      console.error('Error allocating tokens:', error);
      toast({
        title: "Allocation Error",
        description: "Failed to allocate tokens. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle click when not logged in
  const handleLoginRequired = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    router.push('/auth/login');
  };

  // Handle click when out of tokens
  const handleOutOfTokens = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    router.push('/settings/spend');
  };

  if (!user) {
    return (
      <div
        className={cn(
          "flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30 cursor-pointer hover:bg-muted/70 transition-colors",
          className
        )}
        onClick={handleLoginRequired}
      >
        <span className="text-xs text-muted-foreground">Login to support this page</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || usdLoading || !usdBalance) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="h-8 w-8 bg-muted animate-pulse rounded" />
        <div className="flex-1 h-8 bg-muted animate-pulse rounded" />
        <div className="h-8 w-8 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  // Convert USD balance to tokens for backward compatibility
  const totalTokens = Math.floor(centsToDollars(usdBalance.totalUsdCents) * 10);
  const allocatedTokens = Math.floor(centsToDollars(usdBalance.allocatedUsdCents) * 10);
  const availableTokens = totalTokens - allocatedTokens;

  // Calculate token distribution exactly like PledgeBar
  const otherPagesTokens = Math.max(0, allocatedTokens - currentPageAllocation);
  const isOutOfTokens = availableTokens <= 0;

  // Calculate percentages for the composition bar (order: other, this, available)
  const otherPagesPercentage = totalTokens > 0 ? (otherPagesTokens / totalTokens) * 100 : 0;
  const currentPagePercentage = totalTokens > 0 ? (currentPageAllocation / totalTokens) * 100 : 0;
  const availablePercentage = totalTokens > 0 ? (availableTokens / totalTokens) * 100 : 0;

  // Convert current page allocation from tokens to dollars for display
  const currentPageDollars = currentPageAllocation / 10;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Minus button on left */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 hover:bg-destructive/20 flex-shrink-0"
        onClick={(e) => handleTokenChange(-1, e)}
        disabled={false}
      >
        <Minus className="h-4 w-4" />
      </Button>

      {/* Composition bar with centered dollar amount */}
      <div className="flex-1 h-8 relative">
        {/* Background composition bar */}
        <div className="absolute inset-0 flex gap-1">
          {/* Other pages (spent elsewhere) - left side */}
          {otherPagesTokens > 0 && (
            <div
              className="bg-muted-foreground/30 rounded-md"
              style={{ width: `${otherPagesPercentage}%` }}
            />
          )}

          {/* Current page (spent here) - center, primary color */}
          {currentPageAllocation > 0 && (
            <div
              className="bg-primary rounded-md"
              style={{ width: `${currentPagePercentage}%` }}
            />
          )}

          {/* Available tokens - right side */}
          {availableTokens > 0 && (
            <div
              className="bg-muted-foreground/10 rounded-md"
              style={{ width: `${availablePercentage}%` }}
            />
          )}
        </div>

        {/* Centered dollar amount overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-foreground bg-background/80 px-2 py-1 rounded backdrop-blur-sm">
            ${currentPageDollars.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Plus button on right */}
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-8 p-0 flex-shrink-0"
        onClick={(e) => isOutOfTokens ? handleOutOfTokens(e) : handleTokenChange(1, e)}
        disabled={false}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
