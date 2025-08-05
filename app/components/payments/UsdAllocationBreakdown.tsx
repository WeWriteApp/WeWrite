'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
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

  // Sort allocations by amount (highest first)
  const sortedAllocations = [...allocations].sort((a, b) => b.usdCents - a.usdCents);
  
  // Calculate totals
  const totalAllocatedCents = allocations.reduce((sum, allocation) => sum + allocation.usdCents, 0);
  const unallocatedCents = Math.max(0, totalUsdCents - totalAllocatedCents);
  
  // Determine which allocations to show
  const visibleAllocations = showAll ? sortedAllocations : sortedAllocations.slice(0, maxVisible);
  const hasMore = sortedAllocations.length > maxVisible;

  // Get resource type label
  const getResourceTypeLabel = (resourceType: string) => {
    switch (resourceType) {
      case 'user':
        return 'User';
      case 'page':
        return 'Page';
      case 'wewrite':
        return 'WeWrite';
      default:
        return 'Unknown';
    }
  };

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

  // Summary info for non-card layout
  const summaryInfo = !showSectionHeader && (
    <div className="flex items-center justify-between mb-4 p-3 bg-muted/30 rounded-lg">
      <div>
        <p className="text-sm font-medium">
          {allocations.length} allocation{allocations.length !== 1 ? 's' : ''} • {formatUsdCents(totalAllocatedCents)} total
        </p>
      </div>
      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
        {((totalAllocatedCents / totalUsdCents) * 100).toFixed(1)}% allocated
      </Badge>
    </div>
  );

  const allocationsList = (
    <div className="space-y-2">
      {visibleAllocations.map((allocation) => {
        const percentage = totalUsdCents > 0 ? (allocation.usdCents / totalUsdCents) * 100 : 0;

        return (
          <div
            key={allocation.id}
            className="p-2 sm:p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors space-y-2"
          >
            {/* Top row: Resource info and amount */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                {/* Resource info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
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
                      <div className="flex items-center space-x-1">
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

                        {allocation.resourceType !== 'user' && (
                          <Badge variant="outline" className="text-xs self-start sm:self-auto">
                            {getResourceTypeLabel(allocation.resourceType)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amount and percentage */}
                  <div className="flex items-center space-x-1 text-xs sm:text-sm text-muted-foreground self-start sm:self-auto">
                    <span className="font-semibold text-sm">{formatUsdCents(allocation.usdCents)}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="text-xs">{percentage.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Middle row: Plus/Minus buttons and composition bar */}
                <div className="flex items-center space-x-2 sm:space-x-3">
                  {/* Plus/Minus buttons */}
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 sm:h-7 sm:w-7 p-0"
                      title="Decrease allocation"
                      onClick={() => onDecreaseAllocation?.(allocation)}
                      disabled={!onDecreaseAllocation}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 sm:h-7 sm:w-7 p-0"
                      title="Increase allocation"
                      onClick={() => onIncreaseAllocation?.(allocation)}
                      disabled={!onIncreaseAllocation}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Composition bar - styled like AllocationBar */}
                  <div className="flex-1 h-8 flex gap-1 items-center bg-muted/20 rounded-md p-1">
                    {/* Allocated portion */}
                    {percentage > 0 && (
                      <div
                        className="h-full bg-primary rounded-md transition-all duration-300 ease-out"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    )}
                    {/* Remaining portion */}
                    {percentage < 100 && (
                      <div
                        className="h-full bg-muted-foreground/10 rounded-md transition-all duration-300 ease-out"
                        style={{ width: `${100 - Math.min(percentage, 100)}%` }}
                      />
                    )}
                  </div>

                  {/* Actions - moved to same row on mobile */}
                  {showActions && onRemoveAllocation && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveAllocation(allocation)}
                      className="h-8 w-8 sm:h-8 sm:w-8 p-0 text-destructive hover:text-destructive flex-shrink-0"
                      title="Remove allocation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
  );

  const summarySection = (
    <div className="border-t pt-4 text-xs sm:text-sm text-muted-foreground">
      <p className="leading-relaxed">
        Funds are distributed to creators at the end of each month.
        You can modify allocations anytime before the monthly processing date.
      </p>
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
            <Badge variant="secondary" className="bg-green-100 text-green-800 self-start sm:self-auto text-xs">
              {((totalAllocatedCents / totalUsdCents) * 100).toFixed(1)}% allocated
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-3 sm:px-4 pb-3">
          {allocationsList}
          {summarySection}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {summaryInfo}
      {allocationsList}
      {summarySection}
    </div>
  );
}
