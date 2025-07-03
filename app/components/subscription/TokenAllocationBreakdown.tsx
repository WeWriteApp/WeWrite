'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Plus, Minus, ExternalLink, DollarSign, ArrowUpDown, Trash2, Clock } from 'lucide-react';
import { TokenBalance } from '../../types/database';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ui/use-toast';
import { useTokenIncrement } from '../../contexts/TokenIncrementContext';

interface PageAllocation {
  id: string;
  pageId: string;
  pageTitle: string;
  authorId: string;
  authorUsername: string;
  tokens: number;
  month: string;
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
  const { currentAccount, isAuthenticated } = useCurrentAccount();
  const { toast } = useToast();
  const { incrementAmount } = useTokenIncrement();
  const [allocationData, setAllocationData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingAllocation, setUpdatingAllocation] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('tokens-desc');

  // Optimistic UI state
  const [pendingChanges, setPendingChanges] = useState<Record<string, number>>({});
  const debounceTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Token input editing state
  const [editingTokens, setEditingTokens] = useState<Record<string, boolean>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAllocations();
  }, []);

  // Periodic state synchronization to handle edge cases
  useEffect(() => {
    if (!currentAccount?.uid) return;

    // Set up periodic refresh to catch any state drift
    const syncInterval = setInterval(() => {
      // Only sync if there are no pending changes to avoid conflicts
      if (Object.keys(pendingChanges).length === 0) {
        loadAllocations();
      }
    }, 30000); // Sync every 30 seconds when idle

    return () => clearInterval(syncInterval);
  }, [currentAccount?.uid, pendingChanges]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach(timer => {
        clearTimeout(timer);
      });
    };
  }, []);

  // Memoized sorted allocations to trigger animations when sort changes
  const sortedAllocations = useMemo(() => {
    if (!allocationData?.allocations) return [];

    const allocations = [...allocationData.allocations];

    // First sort by the selected criteria
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

    return [...activeAllocations, ...zeroAllocations];
  }, [allocationData?.allocations, sortBy]);

  // Calculate maximum tokens for bar graph proportions
  const maxTokens = useMemo(() => {
    if (!allocationData?.allocations || allocationData.allocations.length === 0) return 1;
    const max = Math.max(...allocationData.allocations.map(a => a.tokens));
    return max > 0 ? max : 1; // Ensure we never have 0 as max to avoid division by zero
  }, [allocationData?.allocations]);

  const loadAllocations = async (loadMore = false) => {
    if (!currentAccount?.uid) {
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

      if (loadMore && allocationData) {
        // Append new allocations to existing ones
        setAllocationData({
          ...data,
          allocations: [...allocationData.allocations, ...data.allocations]
        });
      } else {
        // Replace with new data
        setAllocationData(data);
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
    if (!allocationData?.summary.balance) return;

    // Check if the current allocation data is still valid by comparing with server
    const currentAllocation = allocationData.allocations.find(a => a.pageId === pageId);
    if (!currentAllocation) {
      console.warn('Allocation not found, refreshing data');
      await loadAllocations();
      return;
    }

    try {
      const currentAllocation = allocationData.allocations.find(a => a.pageId === pageId);
      const currentTokens = currentAllocation?.tokens || 0;
      const totalChange = finalTokens - currentTokens;

      const response = await fetch('/api/tokens/page-allocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageId,
          tokenChange: totalChange
        })
      });

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

      // Revert optimistic update on error by reloading fresh data
      await loadAllocations();

      // Clear pending changes for this page
      setPendingChanges(prev => {
        const updated = { ...prev };
        delete updated[pageId];
        return updated;
      });

      // Show error feedback to user
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update token allocation. Please try again.",
        variant: "destructive",
        duration: 5000
      });
    }
  }, [allocationData]);

  const handleTokenAllocation = (pageId: string, change: number) => {
    if (!allocationData?.summary.balance) return;

    const currentAllocation = allocationData.allocations.find(a => a.pageId === pageId);
    const currentTokens = currentAllocation?.tokens || 0;
    const pendingChange = pendingChanges[pageId] || 0;
    const currentWithPending = currentTokens + pendingChange;
    const newAllocation = Math.max(0, currentWithPending + change);

    // Validate allocation
    const maxAllocation = allocationData.summary.balance.availableTokens + currentTokens;
    if (newAllocation > maxAllocation) {
      console.log('Insufficient tokens available');
      return;
    }

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
          totalTokensAllocated: prev.summary.totalTokensAllocated + change,
          balance: prev.summary.balance ? {
            ...prev.summary.balance,
            availableTokens: prev.summary.balance.availableTokens - change
          } : null
        }
      };

      // Notify parent component of the update
      if (onAllocationUpdate) {
        onAllocationUpdate(updatedData);
      }

      return updatedData;
    });

    // Track pending changes
    setPendingChanges(prev => ({
      ...prev,
      [pageId]: (prev[pageId] || 0) + change
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

    // Validate against available tokens
    if (change > 0 && allocationData?.summary.balance) {
      const maxAllocation = allocationData.summary.balance.availableTokens + currentTokens;
      if (newTokens > maxAllocation) {
        // Reset to max possible value
        setInputValues(prev => ({ ...prev, [pageId]: maxAllocation.toString() }));
        return;
      }
    }

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

  if (!allocationData || !allocationData.summary.balance) {
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

  const { summary } = allocationData;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Breakdown by page
        </CardTitle>
        <CardDescription>
          {allocationData?.pagination?.total ? (
            `Manage your monthly token allocations to creators (${allocationData.pagination.total} pages)`
          ) : (
            'Manage your monthly token allocations to creators'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
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

                  // Calculate percentage for background bar (0-100%)
                  const barPercentage = maxTokens > 0 ? (allocation.tokens / maxTokens) * 100 : 0;

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
                      className={`relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-theme-strong rounded-lg hover:bg-muted/50 hover-border-strong transition-colors overflow-hidden ${
                        isZeroAllocation ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Subtle background bar */}
                      <div
                        className="absolute inset-0 bg-gradient-to-r from-accent/10 to-accent/5 transition-all duration-300"
                        style={{
                          width: `${barPercentage}%`,
                          opacity: isZeroAllocation ? 0.3 : 0.6
                        }}
                      />

                      {/* Content overlay */}
                      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/${allocation.pageId}`}
                              className="font-medium text-primary hover:underline truncate"
                            >
                              {allocation.pageTitle}
                            </Link>
                            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            {isZeroAllocation && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                Previously pledged
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            by {allocation.authorUsername}
                          </p>
                        </div>

                      <div className="flex items-center gap-3 sm:ml-4">
                        <div className="text-right">
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
                              className="cursor-pointer hover:bg-accent rounded px-2 py-1 transition-colors"
                              onClick={() => handleTokenClick(allocation.pageId, allocation.tokens)}
                            >
                              <div className="font-medium">
                                {allocation.tokens} tokens
                                {pendingChanges[allocation.pageId] && (
                                  <span className="ml-1 text-xs text-blue-500">
                                    (saving...)
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">per month</div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1">
                          {isZeroAllocation ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteAllocation(allocation.pageId)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTokenAllocation(allocation.pageId, -incrementAmount)}
                                disabled={allocation.tokens <= 0}
                                className="h-8 w-8 p-0"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleTokenAllocation(allocation.pageId, incrementAmount)}
                                disabled={(summary.balance?.availableTokens || 0) <= 0}
                                className="h-8 w-8 p-0"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {/* Load More Button */}
            {allocationData?.pagination?.hasMore && (
              <div className="text-center py-4">
                <div className="text-sm text-muted-foreground mb-3">
                  Showing {allocationData.allocations.length} of {allocationData.pagination.total} pages
                </div>
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="min-w-[140px]"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load 20 more'
                  )}
                </Button>
              </div>
            )}

            {/* Show total count even when all loaded */}
            {allocationData?.pagination && !allocationData.pagination.hasMore && allocationData.pagination.total > 20 && (
              <div className="text-center py-2">
                <div className="text-sm text-muted-foreground">
                  Showing all {allocationData.pagination.total} pages
                </div>
              </div>
            )}

            {/* Total Summary */}
            <div className="border-t-only pt-4 mt-6">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">Total Allocated:</span>
                <span className="font-medium">{summary.totalTokensAllocated} tokens</span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground mt-1">
                <span>Available:</span>
                <span>{summary.balance?.availableTokens || 0} tokens</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}