'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  FileText,
  Building2
} from 'lucide-react';
import { formatUsdCents } from '../../utils/formatCurrency';
import { UsdAllocation } from '../../types/database';
import { PillLink } from '../utils/PillLink';
import { ALLOCATION_BAR_STYLES } from '../../constants/allocation-styles';

// Enhanced allocation with page/user details
interface EnhancedUsdAllocation extends UsdAllocation {
  pageTitle?: string;
  authorUsername?: string;
  authorId?: string;
}

interface UsdAllocationBreakdownProps {
  allocations: EnhancedUsdAllocation[];
  totalUsdCents: number;
  onEditAllocation?: (allocation: EnhancedUsdAllocation) => void;
  onRemoveAllocation?: (allocation: EnhancedUsdAllocation) => void;
  onViewResource?: (allocation: EnhancedUsdAllocation) => void;
  onIncreaseAllocation?: (allocation: EnhancedUsdAllocation) => void;
  onDecreaseAllocation?: (allocation: EnhancedUsdAllocation) => void;
  className?: string;
  showActions?: boolean;
  maxVisible?: number;
  showSectionHeader?: boolean;
}

export function UsdAllocationBreakdown({
  allocations,
  totalUsdCents,
  onEditAllocation,
  onRemoveAllocation,
  onViewResource,
  onIncreaseAllocation,
  onDecreaseAllocation,
  className = '',
  showActions = true,
  maxVisible = 5,
  showSectionHeader = true
}: UsdAllocationBreakdownProps) {
  const [showAll, setShowAll] = useState(false);
  const [stableSortedOrder, setStableSortedOrder] = useState<string[]>([]);
  const sortTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to get the correct sort order
  const getSortedOrder = (allocs: EnhancedUsdAllocation[]) => {
    return [...allocs]
      .sort((a, b) => b.usdCents - a.usdCents)
      .map(a => a.id);
  };

  // Initialize stable order on first load
  useEffect(() => {
    if (allocations.length > 0 && stableSortedOrder.length === 0) {
      setStableSortedOrder(getSortedOrder(allocations));
    }
  }, [allocations, stableSortedOrder.length]);

  // Handle delayed sorting when allocations change
  useEffect(() => {
    if (stableSortedOrder.length === 0) return;

    const newSortOrder = getSortedOrder(allocations);
    const currentOrder = stableSortedOrder;

    // Check if order needs to change
    const orderChanged = !newSortOrder.every((id, index) => id === currentOrder[index]);

    if (orderChanged) {
      // Clear any existing timeout
      if (sortTimeoutRef.current) {
        clearTimeout(sortTimeoutRef.current);
      }

      // Set new timeout for delayed sorting
      sortTimeoutRef.current = setTimeout(() => {
        setStableSortedOrder(newSortOrder);
      }, 500); // 500ms delay
    }

    // Cleanup timeout on unmount
    return () => {
      if (sortTimeoutRef.current) {
        clearTimeout(sortTimeoutRef.current);
      }
    };
  }, [allocations, stableSortedOrder]);

  // Get sorted allocations using stable order
  const sortedAllocations = useMemo(() => {
    if (stableSortedOrder.length === 0) {
      // Fallback to immediate sort if no stable order yet
      return [...allocations].sort((a, b) => b.usdCents - a.usdCents);
    }

    // Sort according to stable order, with updated values
    const sorted = stableSortedOrder
      .map(id => allocations.find(a => a.id === id))
      .filter(Boolean) as EnhancedUsdAllocation[];

    // Add any new allocations that aren't in the stable order yet
    const newAllocations = allocations.filter(a => !stableSortedOrder.includes(a.id));
    return [...sorted, ...newAllocations];
  }, [allocations, stableSortedOrder]);
  
  // Calculate totals
  const totalAllocatedCents = allocations.reduce((sum, allocation) => sum + allocation.usdCents, 0);
  const unallocatedCents = Math.max(0, totalUsdCents - totalAllocatedCents);
  
  // Determine which allocations to show
  const visibleAllocations = showAll ? sortedAllocations : sortedAllocations.slice(0, maxVisible);
  const hasMore = sortedAllocations.length > maxVisible;



  // Handle empty state
  if (allocations.length === 0) {
    if (!showSectionHeader) {
      return (
        <div className={className}>
          <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-base font-medium mb-1">No allocations yet</p>
            <p className="text-sm px-2">
              Start supporting creators by allocating funds to their content
            </p>
          </div>
        </div>
      );
    }

    return (
      <Card className={className}>
        <CardHeader className="px-3 sm:px-4 pb-2">
          <CardTitle className="text-sm sm:text-base">Breakdown</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Your monthly fund allocations to creators
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3">
          <div className="text-center py-4 sm:py-6 text-muted-foreground">
            <FileText className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className="text-sm sm:text-base font-medium mb-1">No allocations yet</p>
            <p className="text-xs sm:text-sm px-2">
              Start supporting creators by allocating funds to their content
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const content = (
    <div className="space-y-3">
      {/* Summary info for non-card layout */}
      {!showSectionHeader && (
        <div className="flex items-center justify-between mb-4 p-3 bg-muted/30 rounded-lg">
          <div>
            <p className="text-sm font-medium">
              {allocations.length} allocation{allocations.length !== 1 ? 's' : ''} • {formatUsdCents(totalAllocatedCents)} total
            </p>
          </div>
        </div>
      )}

      {/* Allocation list */}
      <div className="space-y-2 transition-all duration-500 ease-in-out">
        {visibleAllocations.map((allocation) => {
          const percentage = totalUsdCents > 0 ? (allocation.usdCents / totalUsdCents) * 100 : 0;

          return (
            <div
              key={allocation.id}
              className="relative p-4 sm:p-6 wewrite-card border border-border rounded-xl hover:shadow-sm transition-all duration-500 ease-in-out space-y-4"
              style={{
                transform: 'translateZ(0)', // Force GPU acceleration for smooth animations
                willChange: 'transform, opacity'
              }}
            >
              {/* Top row: Resource info with trash icon in top right */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {allocation.resourceType === 'wewrite' ? (
                    <p className="font-medium truncate text-sm sm:text-base">WeWrite Platform</p>
                  ) : allocation.resourceType === 'user' ? (
                    <div className="flex items-center space-x-1">
                      <PillLink href={`/user/${allocation.authorUsername || allocation.resourceId}`}>
                        {allocation.authorUsername || allocation.resourceId}
                      </PillLink>
                      <span className="text-xs sm:text-sm text-muted-foreground">(User)</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 flex-wrap">
                      <PillLink href={`/${allocation.resourceId}`}>
                        {allocation.pageTitle || allocation.resourceId}
                      </PillLink>
                      {allocation.authorUsername && (
                        <>
                          <span className="text-xs sm:text-sm text-muted-foreground">by</span>
                          <PillLink href={`/user/${allocation.authorUsername}`}>
                            {allocation.authorUsername}
                          </PillLink>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Trash icon in top right */}
                {showActions && onRemoveAllocation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveAllocation(allocation)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive flex-shrink-0"
                    title="Remove allocation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Current allocation amount - centered above the bar */}
              <div className="text-center">
                <span className="text-lg font-semibold">{formatUsdCents(allocation.usdCents)}</span>
                <span className="text-xs text-muted-foreground ml-1">/mo</span>
              </div>

              {/* Three-part allocation bar with minus/plus buttons */}
              <div className="flex items-center gap-2">
                {/* Minus button on left */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  title="Decrease allocation"
                  onClick={() => onDecreaseAllocation?.(allocation)}
                  disabled={!onDecreaseAllocation}
                >
                  <Minus className="h-3 w-3" />
                </Button>

                {/* Three-part composition bar in middle */}
                <div className="flex-1 h-8 relative bg-muted/20 rounded-md overflow-hidden">
                  {/* Background composition bar with three sections */}
                  <div className="absolute inset-0 flex gap-1 p-1">
                    {/* Other allocations (left section) - muted */}
                    <div
                      className={`${ALLOCATION_BAR_STYLES.sections.other} rounded-sm`}
                      style={{ width: `${Math.max(0, (totalUsdCents - allocation.usdCents - (totalUsdCents - totalAllocatedCents)) / totalUsdCents * 100)}%` }}
                    />

                    {/* Current allocation (center section) - primary color */}
                    <div
                      className="bg-primary rounded-sm transition-all duration-300 ease-out"
                      style={{ width: `${(allocation.usdCents / totalUsdCents) * 100}%` }}
                    />

                    {/* Available funds (right section) - light */}
                    <div
                      className="bg-muted-foreground/10 rounded-sm transition-all duration-300 ease-out"
                      style={{ width: `${((totalUsdCents - totalAllocatedCents) / totalUsdCents) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Plus button on right */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  title="Increase allocation"
                  onClick={() => onIncreaseAllocation?.(allocation)}
                  disabled={!onIncreaseAllocation}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              </div>
            );
      })}

      {/* Show more/less button */}
      {hasMore && (
        <Button
          variant="ghost"
          onClick={() => setShowAll(!showAll)}
          className="w-full text-sm"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-4 w-4 mr-2" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-2" />
              Show {sortedAllocations.length - maxVisible} More
            </>
          )}
        </Button>
      )}

      {/* Unallocated funds */}
      {unallocatedCents > 0 && (
        <div className="border-t pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 p-3 sm:p-4 bg-muted/20 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 text-muted-foreground">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm sm:text-base">Unallocated Funds</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Available for allocation
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-semibold text-green-600 text-base sm:text-base">
                {formatUsdCents(unallocatedCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {((unallocatedCents / totalUsdCents) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Summary */}
      <div className="border-t pt-4 text-xs sm:text-sm text-muted-foreground">
        <p className="leading-relaxed">
          Funds are distributed to creators at the end of each month.
          You can modify allocations anytime before the monthly processing date.
        </p>
      </div>
    </div>
  );

  // Return with or without Card wrapper based on showSectionHeader
  if (showSectionHeader) {
    return (
      <Card className={className}>
        <CardHeader className="px-3 sm:px-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <div>
              <CardTitle className="text-sm sm:text-base">Breakdown</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {allocations.length} allocation{allocations.length !== 1 ? 's' : ''} • {formatUsdCents(totalAllocatedCents)} total
              </CardDescription>
            </div>

          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-3 sm:px-4 pb-3">
          {content}
        </CardContent>
      </Card>
    );
  }

  // Non-card version for section layout
  return <div className={className}>{content}</div>;
}
