'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Plus, Minus, ExternalLink, Coins, ArrowUpDown } from 'lucide-react';
import { TokenBalance } from '../../types/database';
import { useAuth } from '../../providers/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';

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
  summary: {
    totalAllocations: number;
    totalTokensAllocated: number;
    balance: TokenBalance | null;
  };
}

interface TokenAllocationBreakdownProps {
  className?: string;
}

type SortOption = 'tokens-desc' | 'tokens-asc' | 'title-asc' | 'title-desc' | 'author-asc' | 'author-desc';

export default function TokenAllocationBreakdown({ className = "" }: TokenAllocationBreakdownProps) {
  const { user } = useAuth();
  const [allocationData, setAllocationData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingAllocation, setUpdatingAllocation] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('tokens-desc');

  useEffect(() => {
    loadAllocations();
  }, []);

  // Memoized sorted allocations to trigger animations when sort changes
  const sortedAllocations = useMemo(() => {
    if (!allocationData?.allocations) return [];

    const allocations = [...allocationData.allocations];

    switch (sortBy) {
      case 'tokens-desc':
        return allocations.sort((a, b) => b.tokens - a.tokens);
      case 'tokens-asc':
        return allocations.sort((a, b) => a.tokens - b.tokens);
      case 'title-asc':
        return allocations.sort((a, b) => a.pageTitle.localeCompare(b.pageTitle));
      case 'title-desc':
        return allocations.sort((a, b) => b.pageTitle.localeCompare(a.pageTitle));
      case 'author-asc':
        return allocations.sort((a, b) => a.authorUsername.localeCompare(b.authorUsername));
      case 'author-desc':
        return allocations.sort((a, b) => b.authorUsername.localeCompare(a.authorUsername));
      default:
        return allocations;
    }
  }, [allocationData?.allocations, sortBy]);

  const loadAllocations = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      // Use API endpoint instead of direct client-side calls
      const response = await fetch('/api/tokens/allocations');

      if (!response.ok) {
        throw new Error('Failed to fetch token allocations');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load allocations');
      }

      setAllocationData(data);

    } catch (error) {
      console.error('Error loading token allocations:', error);
      setAllocationData({
        success: false,
        allocations: [],
        summary: { totalAllocations: 0, totalTokensAllocated: 0, balance: null },
        error: error instanceof Error ? error.message : 'Failed to load allocations'
      });
    } finally {
      setLoading(false);
    }
  };


  const handleTokenAllocation = async (pageId: string, change: number) => {
    if (!allocationData?.summary.balance || updatingAllocation) return;

    const currentAllocation = allocationData.allocations.find(a => a.pageId === pageId);
    const currentTokens = currentAllocation?.tokens || 0;
    const newAllocation = Math.max(0, currentTokens + change);
    
    // Validate allocation
    const maxAllocation = allocationData.summary.balance.availableTokens + currentTokens;
    if (newAllocation > maxAllocation) {
      console.log('Insufficient tokens available');
      return;
    }

    setUpdatingAllocation(pageId);
    try {
      const response = await fetch('/api/tokens/pledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId,
          tokenChange: change
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to allocate tokens');
      }

      const result = await response.json();

      if (result.success) {
        // Reload allocations to get updated data
        await loadAllocations();
      } else {
        throw new Error(result.error || 'Failed to allocate tokens');
      }

    } catch (error) {
      console.error('Error allocating tokens:', error);
    } finally {
      setUpdatingAllocation(null);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
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
            <Coins className="h-5 w-5" />
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
          <Coins className="h-5 w-5" />
          Token Allocation Breakdown
        </CardTitle>
        <CardDescription>
          Manage your monthly token allocations to creators
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
                {sortedAllocations.map((allocation, index) => (
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
                    className="flex items-center justify-between p-4 border-theme-strong rounded-lg hover:bg-muted/50 hover-border-strong transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/${allocation.pageId}`}
                          className="font-medium text-primary hover:underline truncate"
                        >
                          {allocation.pageTitle}
                        </Link>
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        by {allocation.authorUsername}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right">
                        <div className="font-medium">{allocation.tokens} tokens</div>
                        <div className="text-xs text-muted-foreground">per month</div>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTokenAllocation(allocation.pageId, -1)}
                          disabled={updatingAllocation === allocation.pageId || allocation.tokens <= 0}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleTokenAllocation(allocation.pageId, 1)}
                          disabled={updatingAllocation === allocation.pageId || (summary.balance?.availableTokens || 0) <= 0}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

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
