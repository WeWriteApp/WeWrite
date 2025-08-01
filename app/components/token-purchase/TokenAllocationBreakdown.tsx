'use client';

/**
 * @deprecated This component is deprecated and will be removed in a future version.
 * Use UsdAllocationBreakdown instead for USD-based allocation breakdowns.
 *
 * Legacy token allocation breakdown - replaced by USD system.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Plus, Minus, ExternalLink, DollarSign, ArrowUpDown, Trash2, Clock, RotateCcw, X } from 'lucide-react';
import { TokenBalance } from '../../types/database';
import { useAuth } from '../../providers/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ui/use-toast';
import { useTokenIncrement } from '../../contexts/TokenIncrementContext';
// Note: triggerTokenBalanceRefresh is deprecated - use UsdBalanceContext refresh instead

// Custom Zero with diagonal line icon component
const ZeroWithCross = ({ className }: { className?: string }) => (
  <div className={`relative inline-flex items-center justify-center ${className}`}>
    <span className="text-xs font-bold">0</span>
    <div
      className="absolute w-2 h-px bg-current transform rotate-45"
      style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)' }}
    />
  </div>
);

interface PageAllocation {
  id: string;
  pageId: string;
  pageTitle: string;
  authorId: string;
  authorUsername: string;
  tokens: number;
  month: string;
  resourceType?: 'page' | 'user_bio' | 'user' | 'wewrite';
  resourceId?: string;
}

interface TokenBalance {
  totalTokens: number;
  allocatedTokens: number;
  availableTokens: number;
  lastUpdated: Date;
}

interface AllocationData {
  allocations: PageAllocation[];
  pagination?: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
    returned: number;
  };
  summary: {
    totalAllocations: number;
    totalTokensAllocated: number;
    balance: TokenBalance | null;
  };
}

interface TokenAllocationBreakdownProps {
  className?: string;
  onAllocationUpdate?: (allocationData: any) => void;
}

type SortOption = 'tokens-desc' | 'tokens-asc' | 'title-asc' | 'title-desc' | 'author-asc' | 'author-desc';

export default function TokenAllocationBreakdown({ className = "", onAllocationUpdate }: TokenAllocationBreakdownProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { incrementAmount } = useTokenIncrement();
  const [allocationData, setAllocationData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingAllocation, setUpdatingAllocation] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('tokens-desc');
  const [sortingDelayed, setSortingDelayed] = useState(false);
  const sortDelayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Optimistic UI state
  const [pendingChanges, setPendingChanges] = useState<Record<string, number>>({});
  const debounceTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Token input editing state
  const [editingTokens, setEditingTokens] = useState<Record<string, boolean>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user?.uid) {
      loadAllocations();
    }
  }, [user?.uid]);

  // Remove periodic sync to prevent jarring reloads
  // Data will be refreshed only when user performs actions or navigates back to page

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach(timer => {
        clearTimeout(timer);
      });

      // Cleanup sort delay timer
      if (sortDelayTimerRef.current) {
        clearTimeout(sortDelayTimerRef.current);
      }
    };
  }, []);

  // Store the stable sorted order that only updates when not delayed
  const [stableSortedOrder, setStableSortedOrder] = useState<PageAllocation[]>([]);

  // Effect to update stable sorted order only when sorting is not delayed
  useEffect(() => {
    if (!allocationData?.allocations || sortingDelayed) return;

    const allocations = [...allocationData.allocations];

    // Perform normal sorting
    let sorted;
    switch (sortBy) {
      case 'tokens-desc':
        sorted = allocations.sort((a, b) => b.tokens - a.tokens);
        break;
      case 'tokens-asc':
        sorted = allocations.sort((a, b) => a.tokens - b.tokens);
        break;
      case 'title-asc':
        sorted = allocations.sort((a, b) => a.pageTitle.localeCompare(b.pageTitle));
        break;
      case 'title-desc':
        sorted = allocations.sort((a, b) => b.pageTitle.localeCompare(a.pageTitle));
        break;
      case 'author-asc':
        sorted = allocations.sort((a, b) => a.authorUsername.localeCompare(b.authorUsername));
        break;
      case 'author-desc':
        sorted = allocations.sort((a, b) => b.authorUsername.localeCompare(a.authorUsername));
        break;
      default:
        sorted = allocations;
    }

    // Then separate active allocations from zero allocations
    // Active allocations come first, then zero allocations (previously pledged)
    const activeAllocations = sorted.filter(a => a.tokens > 0);
    const zeroAllocations = sorted.filter(a => a.tokens === 0);

    setStableSortedOrder([...activeAllocations, ...zeroAllocations]);
  }, [allocationData?.allocations, sortBy, sortingDelayed]);

  // Display allocations with updated token values but stable order during delays
  const sortedAllocations = useMemo(() => {
    if (!allocationData?.allocations) return [];

    if (stableSortedOrder.length === 0) {
      // Initial load - return current allocations with default sort
      const allocations = [...allocationData.allocations];
      const activeAllocations = allocations.filter(a => a.tokens > 0);
      const zeroAllocations = allocations.filter(a => a.tokens === 0);
      return [...activeAllocations.sort((a, b) => b.tokens - a.tokens), ...zeroAllocations];
    }

    // Update the stable order with current token values while maintaining position
    return stableSortedOrder.map(stableItem => {
      const currentItem = allocationData.allocations.find(a => a.pageId === stableItem.pageId);
      return currentItem || stableItem;
    }).filter(item => allocationData.allocations.some(a => a.pageId === item.pageId));
  }, [allocationData?.allocations, stableSortedOrder]);

  // Calculate maximum tokens for bar graph proportions
  const maxTokens = useMemo(() => {
    if (!allocationData?.allocations || allocationData.allocations.length === 0) return 1;
    const max = Math.max(...allocationData.allocations.map(a => a.tokens));
    return max > 0 ? max : 1; // Ensure we never have 0 as max to avoid division by zero
  }, [allocationData?.allocations]);

  // Calculate unfunded tokens for each allocation
  const unfundedTokensData = useMemo(() => {
    if (!allocationData?.summary.balance) return { unfundedByPage: {}, totalUnfunded: 0 };

    const availableTokens = allocationData.summary.balance.availableTokens;

    // If we have positive available tokens, nothing is unfunded
    if (availableTokens >= 0) {
      return { unfundedByPage: {}, totalUnfunded: 0 };
    }

    // Calculate total overspend
    const totalUnfunded = Math.abs(availableTokens);

    // Sort allocations by tokens (highest first) to determine which are unfunded
    const sortedByTokens = [...sortedAllocations]
      .filter(a => a.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens);

    const unfundedByPage: Record<string, number> = {};

    // New algorithm: Distribute unfunded tokens equally across highest pages
    // so that all pages end up with the same funded amount

    let remainingUnfunded = totalUnfunded;
    let currentIndex = 0;

    while (remainingUnfunded > 0 && currentIndex < sortedByTokens.length) {
      // Find all pages at the current highest level
      const currentHighest = sortedByTokens[currentIndex].tokens;
      const pagesAtCurrentLevel = [];

      for (let i = currentIndex; i < sortedByTokens.length; i++) {
        if (sortedByTokens[i].tokens === currentHighest) {
          pagesAtCurrentLevel.push(sortedByTokens[i]);
        } else {
          break;
        }
      }

      // Calculate how much to reduce from each page at this level
      const nextHighest = currentIndex + pagesAtCurrentLevel.length < sortedByTokens.length
        ? sortedByTokens[currentIndex + pagesAtCurrentLevel.length].tokens
        : 0;

      // Maximum we can reduce from each page at this level
      const maxReductionPerPage = currentHighest - nextHighest;
      const totalMaxReduction = maxReductionPerPage * pagesAtCurrentLevel.length;

      if (totalMaxReduction >= remainingUnfunded) {
        // We can distribute the remaining unfunded tokens equally across these pages
        const unfundedPerPage = Math.floor(remainingUnfunded / pagesAtCurrentLevel.length);
        const extraUnfunded = remainingUnfunded % pagesAtCurrentLevel.length;

        pagesAtCurrentLevel.forEach((allocation, index) => {
          const unfundedForThisPage = unfundedPerPage + (index < extraUnfunded ? 1 : 0);
          if (unfundedForThisPage > 0) {
            unfundedByPage[allocation.pageId] = (unfundedByPage[allocation.pageId] || 0) + unfundedForThisPage;
          }
        });

        remainingUnfunded = 0;
      } else {
        // Reduce all pages at this level to the next level
        pagesAtCurrentLevel.forEach(allocation => {
          unfundedByPage[allocation.pageId] = (unfundedByPage[allocation.pageId] || 0) + maxReductionPerPage;
        });

        remainingUnfunded -= totalMaxReduction;
        currentIndex += pagesAtCurrentLevel.length;
      }
    }

    return { unfundedByPage, totalUnfunded };
  }, [allocationData?.summary.balance, sortedAllocations]);

  const loadAllocations = async (loadMore = false) => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      // Calculate offset for pagination
      const offset = loadMore && allocationData ? allocationData.allocations.length : 0;
      const limit = 20;

      // Use API endpoint with pagination parameters
      const response = await fetch(`/api/tokens/allocations?limit=${limit}&offset=${offset}`);

      if (!response.ok) {
        throw new Error('Failed to fetch token allocations');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load allocations');
      }

      console.log(`📄 Loaded ${data.allocations.length} allocations (${loadMore ? 'load more' : 'initial'}), pagination:`, data.pagination);

      if (loadMore && allocationData) {
        // Append new allocations to existing ones, avoiding duplicates
        const existingIds = new Set(allocationData.allocations.map(a => a.id));
        const newAllocations = data.allocations.filter(a => !existingIds.has(a.id));

        setAllocationData({
          ...data,
          allocations: [...allocationData.allocations, ...newAllocations]
        });
      } else {
        // Replace with new data only if it's actually different
        if (!allocationData ||
            JSON.stringify(allocationData.allocations) !== JSON.stringify(data.allocations) ||
            allocationData.summary.totalTokensAllocated !== data.summary.totalTokensAllocated) {
          setAllocationData(data);
        }
      }

    } catch (error) {
      console.error('Error loading token allocations:', error);
      if (!loadMore) {
        setAllocationData({
          success: false,
          allocations: [],
          summary: { totalAllocations: 0, totalTokensAllocated: 0, balance: null },
          error: error instanceof Error ? error.message : 'Failed to load allocations'
        });
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Load more allocations
  const handleLoadMore = () => {
    loadAllocations(true);
  };

  // Debounced database update function
  const debouncedDatabaseUpdate = useCallback(async (pageId: string, finalTokens: number) => {
    if (!allocationData?.summary) return;

    // Check if the current allocation data is still valid by comparing with server
    const currentAllocation = allocationData.allocations.find(a => a.pageId === pageId);
    if (!currentAllocation) {
      console.warn('Allocation not found, but keeping optimistic updates');
      return;
    }

    try {
      const currentAllocation = allocationData.allocations.find(a => a.pageId === pageId);
      const currentTokens = currentAllocation?.tokens || 0;
      const totalChange = finalTokens - currentTokens;

      // Use different API endpoints based on resource type
      let response;
      if (currentAllocation?.resourceType === 'user') {
        // For user donations, use the allocate-user API
        response = await fetch('/api/tokens/allocate-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipientUserId: currentAllocation.authorId,
            tokens: finalTokens
          })
        });
      } else {
        // For page allocations, use the existing page-allocation API
        response = await fetch('/api/tokens/page-allocation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            pageId,
            tokenChange: totalChange
          })
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to allocate tokens');
      }

      const result = await response.json();

      if (result.success) {
        // Clear pending changes for this page - optimistic update is already correct
        setPendingChanges(prev => {
          const updated = { ...prev };
          delete updated[pageId];
          return updated;
        });
      } else {
        throw new Error(result.error || 'Failed to allocate tokens');
      }
    } catch (error) {
      console.error('Error allocating tokens:', error);

      // Don't reload data on error - keep user's optimistic updates
      // This allows overspending to persist even if server validation fails

      // Clear pending changes for this page
      setPendingChanges(prev => {
        const updated = { ...prev };
        delete updated[pageId];
        return updated;
      });

      // Only show error feedback for non-overspending errors
      if (!error.message?.includes('Insufficient tokens')) {
        toast({
          title: "Update Failed",
          description: error instanceof Error ? error.message : "Failed to update token allocation. Please try again.",
          variant: "destructive",
          duration: 5000
        });
      }
    }
  }, [allocationData]);

  const handleTokenAllocation = (pageId: string, change: number) => {
    if (!allocationData?.summary) return;

    const currentAllocation = allocationData.allocations.find(a => a.pageId === pageId);
    const currentTokens = currentAllocation?.tokens || 0;

    // Calculate the new allocation value, ensuring it doesn't go below 0
    const newAllocation = Math.max(0, currentTokens + change);

    // If the change would result in the same value, don't do anything
    if (newAllocation === currentTokens) return;

    // Calculate the actual change that will be applied (might be different due to Math.max)
    const actualChange = newAllocation - currentTokens;

    // Allow all changes - users can overspend and see unfunded tokens

    // Delay sorting to prevent items jumping during rapid clicks
    setSortingDelayed(true);

    // Clear existing sort delay timer
    if (sortDelayTimerRef.current) {
      clearTimeout(sortDelayTimerRef.current);
    }

    // Set new timer to re-enable sorting after 300ms of inactivity
    sortDelayTimerRef.current = setTimeout(() => {
      setSortingDelayed(false);
      sortDelayTimerRef.current = null;
    }, 300);

    // Update UI immediately (optimistic update)
    setAllocationData(prev => {
      if (!prev || !prev.allocations) return prev;

      const updatedData = {
        ...prev,
        allocations: prev.allocations.map(allocation =>
          allocation.pageId === pageId
            ? { ...allocation, tokens: newAllocation }
            : allocation
        ),
        summary: {
          ...prev.summary,
          totalTokensAllocated: prev.summary.totalTokensAllocated + actualChange,
          balance: prev.summary.balance ? {
            ...prev.summary.balance,
            availableTokens: prev.summary.balance.availableTokens - actualChange
          } : null
        }
      };

      // Notify parent component of the update (debounced to prevent excessive updates)
      if (onAllocationUpdate) {
        onAllocationUpdate(updatedData);
      }

      // Note: Global balance refresh is now handled automatically by UsdBalanceContext

      return updatedData;
    });

    // Track pending changes
    setPendingChanges(prev => ({
      ...prev,
      [pageId]: (prev[pageId] || 0) + actualChange
    }));

    // Clear existing timer for this page
    if (debounceTimersRef.current[pageId]) {
      clearTimeout(debounceTimersRef.current[pageId]);
    }

    // Set new timer for database update
    debounceTimersRef.current[pageId] = setTimeout(() => {
      debouncedDatabaseUpdate(pageId, newAllocation);
      delete debounceTimersRef.current[pageId];
    }, 700);
  };

  // Handle clicking on token number to edit
  const handleTokenClick = (pageId: string, currentTokens: number) => {
    // Check if there are any pending changes for this page
    const pendingChange = pendingChanges[pageId];
    if (pendingChange) {
      // Use the current optimistic value instead of the original value
      const optimisticTokens = currentTokens + pendingChange;
      setInputValues(prev => ({ ...prev, [pageId]: optimisticTokens.toString() }));
    } else {
      setInputValues(prev => ({ ...prev, [pageId]: currentTokens.toString() }));
    }
    setEditingTokens(prev => ({ ...prev, [pageId]: true }));
  };

  // Handle token input change
  const handleTokenInputChange = (pageId: string, value: string) => {
    setInputValues(prev => ({ ...prev, [pageId]: value }));
  };

  // Handle token input submit (Enter key or blur)
  const handleTokenInputSubmit = (pageId: string) => {
    const inputValue = inputValues[pageId];
    const newTokens = parseInt(inputValue) || 0;

    if (newTokens < 0) {
      // Reset to current value if negative
      const currentAllocation = allocationData?.allocations.find(a => a.pageId === pageId);
      setInputValues(prev => ({ ...prev, [pageId]: (currentAllocation?.tokens || 0).toString() }));
      return;
    }

    const currentAllocation = allocationData?.allocations.find(a => a.pageId === pageId);
    const currentTokens = currentAllocation?.tokens || 0;
    const change = newTokens - currentTokens;

    // Allow all token amounts - users can overspend

    // Apply the change
    if (change !== 0) {
      handleTokenAllocation(pageId, change);
    }

    // Exit editing mode
    setEditingTokens(prev => ({ ...prev, [pageId]: false }));
  };

  // Handle token input cancel (Escape key)
  const handleTokenInputCancel = (pageId: string) => {
    const currentAllocation = allocationData?.allocations.find(a => a.pageId === pageId);
    setInputValues(prev => ({ ...prev, [pageId]: (currentAllocation?.tokens || 0).toString() }));
    setEditingTokens(prev => ({ ...prev, [pageId]: false }));
  };

  // Handle zeroing out allocation
  const handleZeroAllocation = (pageId: string) => {
    if (!allocationData?.summary) return;

    const currentAllocation = allocationData.allocations.find(a => a.pageId === pageId);
    const currentTokens = currentAllocation?.tokens || 0;

    if (currentTokens > 0) {
      handleTokenAllocation(pageId, -currentTokens);
    }
  };

  // Handle deleting zero allocation
  const handleDeleteAllocation = async (pageId: string) => {
    try {
      const response = await fetch('/api/tokens/allocate', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resourceType: 'page',
          resourceId: pageId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete allocation');
      }

      // Remove from local state
      setAllocationData(prev => {
        if (!prev || !prev.allocations) return prev;

        return {
          ...prev,
          allocations: prev.allocations.filter(allocation => allocation.pageId !== pageId)
        };
      });

      // Clear any pending changes for this page
      setPendingChanges(prev => {
        const updated = { ...prev };
        delete updated[pageId];
        return updated;
      });

      // Clear editing state
      setEditingTokens(prev => {
        const updated = { ...prev };
        delete updated[pageId];
        return updated;
      });

      setInputValues(prev => {
        const updated = { ...prev };
        delete updated[pageId];
        return updated;
      });

      // Show success feedback
      toast({
        title: "Allocation Removed",
        description: "Token allocation removed successfully",
        duration: 3000
      });

    } catch (error) {
      console.error('Error deleting allocation:', error);

      // Show error feedback
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete allocation. Please try again.",
        variant: "destructive",
        duration: 5000
      });
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Token Allocation Breakdown
          </CardTitle>
          <CardDescription>
            Manage your monthly token allocations to creators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading allocations...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Never hide the breakdown once we have any data - always show the interface
  // Only show "no data" message on initial load when we truly have no data
  const shouldShowNoDataMessage = !loading && (!allocationData || allocationData.allocations.length === 0) && !user?.uid;

  if (shouldShowNoDataMessage) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Token Allocation Breakdown
          </CardTitle>
          <CardDescription>
            Manage your monthly token allocations to creators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No token balance found. Subscribe to start allocating tokens.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Breakdown by page
          {allocationData?.pagination?.total && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {allocationData.pagination.total} {allocationData.pagination.total === 1 ? 'page' : 'pages'}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Manage your monthly token allocations to creators
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Quick Stats Summary */}
        {allocationData?.summary && allocationData.summary.totalAllocations > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-4 text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                <strong className="text-foreground">{allocationData.summary.totalTokensAllocated}</strong> tokens allocated
              </span>
              <span className="text-muted-foreground">
                to <strong className="text-foreground">{allocationData.pagination?.total || allocationData.summary.totalAllocations}</strong> {(allocationData.pagination?.total || allocationData.summary.totalAllocations) === 1 ? 'page' : 'pages'}
              </span>
            </div>
            {allocationData.summary.balance && (
              <span className="text-muted-foreground">
                <strong className="text-foreground">{allocationData.summary.balance.availableTokens}</strong> tokens remaining
              </span>
            )}
          </div>
        )}

        {sortedAllocations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No token allocations yet
            </p>
            <p className="text-sm text-muted-foreground">
              Visit pages you want to support and use the pledge bar to allocate tokens.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sort Controls */}
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sort by:</span>
              {allocationData?.pagination?.hasMore && (
                <span className="text-xs text-muted-foreground ml-2">(affects loaded items only)</span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-48 justify-between">
                    {sortBy === 'tokens-desc' && 'Highest tokens first'}
                    {sortBy === 'tokens-asc' && 'Lowest tokens first'}
                    {sortBy === 'title-asc' && 'Page title (A-Z)'}
                    {sortBy === 'title-desc' && 'Page title (Z-A)'}
                    {sortBy === 'author-asc' && 'Author name (A-Z)'}
                    {sortBy === 'author-desc' && 'Author name (Z-A)'}
                    <ArrowUpDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => setSortBy('tokens-desc')}>
                    Highest tokens first
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('tokens-asc')}>
                    Lowest tokens first
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('title-asc')}>
                    Page title (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('title-desc')}>
                    Page title (Z-A)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('author-asc')}>
                    Author name (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('author-desc')}>
                    Author name (Z-A)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Animated Allocation List */}
            <motion.div layout className="space-y-3">
              <AnimatePresence mode="popLayout">
                {sortedAllocations.map((allocation, index) => {
                  const isZeroAllocation = allocation.tokens === 0;
                  const isEditing = editingTokens[allocation.pageId];

                  // Calculate percentage for progress bar (0-100%)
                  const barPercentage = maxTokens > 0 ? (allocation.tokens / maxTokens) * 100 : 0;

                  // Calculate funded vs unfunded portions
                  const unfundedTokens = unfundedTokensData.unfundedByPage[allocation.pageId] || 0;
                  const fundedTokens = allocation.tokens - unfundedTokens;
                  const fundedPercentage = maxTokens > 0 ? (fundedTokens / maxTokens) * 100 : 0;
                  const unfundedPercentage = maxTokens > 0 ? (unfundedTokens / maxTokens) * 100 : 0;

                  return (
                    <motion.div
                      key={allocation.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{
                        layout: { duration: 0.4, ease: "easeInOut" },
                        opacity: { duration: 0.3 },
                        y: { duration: 0.3 },
                        delay: index * 0.05 // Stagger effect
                      }}
                      className={`flex flex-col gap-3 p-4 border-theme-strong rounded-lg hover:bg-muted/50 hover-border-strong transition-colors ${
                        isZeroAllocation ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Main content row */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {allocation.resourceType === 'user' ? (
                              <Link
                                href={`/user/${allocation.authorId}`}
                                className="font-medium text-primary hover:underline truncate"
                              >
                                {allocation.authorUsername}'s profile
                              </Link>
                            ) : (
                              <Link
                                href={`/${allocation.pageId}`}
                                className="font-medium text-primary hover:underline truncate"
                              >
                                {allocation.pageTitle}
                              </Link>
                            )}
                            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            {allocation.resourceType === 'user' && (
                              <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                                User donation
                              </span>
                            )}
                            {isZeroAllocation && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                Previously pledged
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {allocation.resourceType === 'user' ? (
                              'Direct support to user'
                            ) : (
                              `by ${allocation.authorUsername}`
                            )}
                          </p>
                        </div>

                      <div className="flex items-center justify-between gap-4 sm:gap-6">
                        <div className="flex-1 text-right min-w-0">
                          {isEditing ? (
                            <div className="flex flex-col items-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                value={inputValues[allocation.pageId] || ''}
                                onChange={(e) => handleTokenInputChange(allocation.pageId, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleTokenInputSubmit(allocation.pageId);
                                  } else if (e.key === 'Escape') {
                                    handleTokenInputCancel(allocation.pageId);
                                  }
                                }}
                                onBlur={() => handleTokenInputSubmit(allocation.pageId)}
                                className="w-20 h-8 text-right text-sm"
                                autoFocus
                              />
                              <div className="text-xs text-muted-foreground">tokens</div>
                            </div>
                          ) : (
                            <div
                              className="cursor-pointer hover:bg-accent rounded px-2 py-1 transition-colors inline-block"
                              onClick={() => handleTokenClick(allocation.pageId, allocation.tokens)}
                            >
                              <div className="font-medium">
                                <span className={pendingChanges[allocation.pageId] ? 'opacity-60' : ''}>
                                  {allocation.tokens} tokens
                                </span>
                                {unfundedTokensData.unfundedByPage[allocation.pageId] && (
                                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                    {unfundedTokensData.unfundedByPage[allocation.pageId]} unfunded
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">per month</div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1 flex-shrink-0">
                          {/* Always show three buttons */}

                          {/* Minus Button - Allow reducing even when overspending */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTokenAllocation(allocation.pageId, -incrementAmount)}
                            disabled={allocation.tokens <= 0 || pendingChanges[allocation.pageId]}
                            className={`h-8 w-8 p-0 ${pendingChanges[allocation.pageId] ? 'opacity-50' : ''}`}
                            title={allocation.tokens <= 0 ? "Cannot go below zero" : `Remove ${incrementAmount} tokens`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>

                          {/* Plus Button - Always enabled, allow overspending */}
                          <Button
                            size="sm"
                            onClick={() => handleTokenAllocation(allocation.pageId, incrementAmount)}
                            disabled={pendingChanges[allocation.pageId]}
                            className={`h-8 w-8 p-0 ${pendingChanges[allocation.pageId] ? 'opacity-50' : ''}`}
                            title={`Add ${incrementAmount} tokens`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>

                          {/* Third Button - Zero or Delete */}
                          {isZeroAllocation ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteAllocation(allocation.pageId)}
                              disabled={pendingChanges[allocation.pageId]}
                              className={`h-8 w-8 p-0 text-destructive hover:text-destructive ${pendingChanges[allocation.pageId] ? 'opacity-50' : ''}`}
                              title="Remove from list"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleZeroAllocation(allocation.pageId)}
                              disabled={pendingChanges[allocation.pageId]}
                              className={`h-8 w-8 p-0 ${pendingChanges[allocation.pageId] ? 'opacity-50' : ''}`}
                              title="Zero out allocation"
                            >
                              <ZeroWithCross className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      </div>

                      {/* Progress bar row - separate from main content */}
                      <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div className="flex h-full gap-0.5">
                          {/* Funded tokens (solid blue with rounded caps) */}
                          {fundedPercentage > 0 && (
                            <div
                              className="bg-blue-600 transition-all duration-300 rounded-full"
                              style={{ width: `${fundedPercentage}%` }}
                            />
                          )}
                          {/* Unfunded tokens (solid orange with rounded caps) */}
                          {unfundedPercentage > 0 && (
                            <div
                              className="bg-orange-600 transition-all duration-300 rounded-full"
                              style={{ width: `${unfundedPercentage}%` }}
                            />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {/* Load More Button */}
            {allocationData?.pagination?.hasMore && (
              <div className="text-center py-4 border-t border-border/50 mt-4">
                <div className="text-sm text-muted-foreground mb-3">
                  Showing {allocationData.allocations.length} of {allocationData.pagination.total} pages you're pledging to
                </div>
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="min-w-[160px] hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      Loading more...
                    </>
                  ) : (
                    <>
                      Load 20 more pages
                      <span className="ml-2 text-xs opacity-70">
                        ({allocationData.pagination.total - allocationData.allocations.length} remaining)
                      </span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Show total count even when all loaded */}
            {allocationData?.pagination && !allocationData.pagination.hasMore && allocationData.pagination.total > 20 && (
              <div className="text-center py-4 border-t border-border/50 mt-4">
                <div className="text-sm text-muted-foreground">
                  ✅ Showing all {allocationData.pagination.total} pages you're pledging to
                </div>
              </div>
            )}


          </div>
        )}
      </CardContent>
    </Card>
  );
}