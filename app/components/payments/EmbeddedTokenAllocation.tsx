"use client";

/**
 * @deprecated This component is deprecated and will be removed in a future version.
 * Use UsdPledgeBar or UsdAllocationModal instead for USD-based allocations.
 *
 * Legacy embedded token allocation - replaced by USD system.
 */

import React, { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useAuth } from '../../providers/AuthProvider';
import { useTokenBalanceContext } from '../../contexts/TokenBalanceContext';
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
  const { tokenBalance, isLoading: tokenLoading, updateOptimisticBalance } = useTokenBalanceContext();
  const router = useRouter();
  const { toast } = useToast();

  const [currentPageAllocation, setCurrentPageAllocation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to show token allocation notification
  const showTokenAllocationNotification = (tokenAmount: number) => {
    const nextProcessingDate = getNextMonthlyProcessingDate();
    const formattedDate = nextProcessingDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });

    toast({
      title: `${tokenAmount} token${tokenAmount === 1 ? '' : 's'} allocated!`,
      description: `Your allocation isn't final until ${formattedDate} when monthly processing occurs. You can adjust it anytime before then.`,
      duration: 6000, // Show for 6 seconds
    });
  };

  // Load current page allocation only
  useEffect(() => {
    if (!user || !pageId) return;

    const loadPageAllocation = async () => {
      try {
        const response = await fetch(`/api/tokens/pledge-bar-data?pageId=${pageId}`);
        if (response.ok) {
          const result = await response.json();
          const data = result.data;
          setCurrentPageAllocation(data.currentPageAllocation || 0);
        }
      } catch (error) {
        console.error('Error loading page allocation:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPageAllocation();
  }, [user, pageId]);

  // Handle token allocation change
  const handleTokenChange = async (change: number, event: React.MouseEvent) => {
    // Prevent event bubbling to parent card
    event.stopPropagation();
    event.preventDefault();

    if (!user || !pageId) return;

    const newAllocation = Math.max(0, currentPageAllocation + change);

    // Optimistic updates
    const previousAllocation = currentPageAllocation;
    setCurrentPageAllocation(newAllocation);
    updateOptimisticBalance(change);

    // No need to set updating state - buttons stay enabled

    try {
      const response = await fetch('/api/tokens/pending-allocations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientUserId: authorId,
          resourceType: 'page',
          resourceId: pageId,
          tokens: newAllocation,
          source: source // Track where allocation came from
        })
      });

      if (!response.ok) {
        // Rollback on error
        setCurrentPageAllocation(previousAllocation);
        updateOptimisticBalance(-change);
        const errorData = await response.json();
        toast({
          title: "Allocation Failed",
          description: errorData.error || "Failed to allocate tokens",
          variant: "destructive"
        });
        return;
      }

      const result = await response.json();

      // Show notification for token allocation (only for positive changes)
      if (change > 0) {
        showTokenAllocationNotification(Math.abs(change));
      }

      // Update current page allocation with server response
      if (result.currentAllocation !== undefined) {
        setCurrentPageAllocation(result.currentAllocation);
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
      updateOptimisticBalance(-change);
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

  if (isLoading || tokenLoading || !tokenBalance) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="h-8 w-8 bg-muted animate-pulse rounded" />
        <div className="flex-1 h-8 bg-muted animate-pulse rounded" />
        <div className="h-8 w-8 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const { totalTokens, allocatedTokens, availableTokens } = tokenBalance;

  // Calculate token distribution exactly like PledgeBar
  const otherPagesTokens = Math.max(0, allocatedTokens - currentPageAllocation);
  const isOutOfTokens = availableTokens <= 0;

  // Calculate percentages for the composition bar (order: other, this, available)
  const otherPagesPercentage = totalTokens > 0 ? (otherPagesTokens / totalTokens) * 100 : 0;
  const currentPagePercentage = totalTokens > 0 ? (currentPageAllocation / totalTokens) * 100 : 0;
  const availablePercentage = totalTokens > 0 ? (availableTokens / totalTokens) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Token controls - Minus button on left */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 hover:bg-destructive/20 flex-shrink-0"
        onClick={(e) => handleTokenChange(-1, e)}
        disabled={false}
      >
        <Minus className="h-4 w-4" />
      </Button>

      {/* Token composition bar - matches PledgeBar style */}
      <div className="flex-1 h-8 flex gap-1">
        {/* Other pages (spent elsewhere) - left side */}
        {otherPagesTokens > 0 && (
          <div
            className="bg-muted-foreground/30 flex items-center justify-center rounded-md"
            style={{ width: `${otherPagesPercentage}%`, minWidth: '20px' }}
          >
            <span className="text-white text-xs font-medium">
              {Math.round(otherPagesTokens)}
            </span>
          </div>
        )}

        {/* Current page (spent here) - center, primary color */}
        {currentPageAllocation > 0 && (
          <div
            className="bg-primary flex items-center justify-center rounded-md"
            style={{ width: `${currentPagePercentage}%`, minWidth: '20px' }}
          >
            <span className="text-white text-xs font-medium">
              {Math.round(currentPageAllocation)}
            </span>
          </div>
        )}

        {/* Available tokens - right side */}
        {availableTokens > 0 && (
          <div
            className="bg-muted-foreground/10 flex items-center justify-center rounded-md"
            style={{ width: `${availablePercentage}%`, minWidth: '20px' }}
          >
            <span className="text-muted-foreground text-xs font-medium">
              {Math.round(availableTokens)}
            </span>
          </div>
        )}
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
