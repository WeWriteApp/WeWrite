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
  maxVisible = 5
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
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Breakdown</CardTitle>
          <CardDescription>
            Your monthly fund allocations to creators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No allocations yet</p>
            <p className="text-sm">
              Start supporting creators by allocating funds to their content
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Breakdown</CardTitle>
            <CardDescription>
              {allocations.length} allocation{allocations.length !== 1 ? 's' : ''} • {formatUsdCents(totalAllocatedCents)} total
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            {((totalAllocatedCents / totalUsdCents) * 100).toFixed(1)}% allocated
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Allocation list */}
        <div className="space-y-3">
          {visibleAllocations.map((allocation) => {
            const percentage = totalUsdCents > 0 ? (allocation.usdCents / totalUsdCents) * 100 : 0;
            
            return (
              <div
                key={allocation.id}
                className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors space-y-3"
              >
                {/* Top row: Resource info and amount */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* Resource info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        {allocation.resourceType === 'wewrite' ? (
                          <p className="font-medium truncate">WeWrite Platform</p>
                        ) : allocation.resourceType === 'user' ? (
                          <div className="flex items-center space-x-2">
                            <PillLink href={`/user/${allocation.authorUsername || allocation.resourceId}`}>
                              {allocation.authorUsername || allocation.resourceId}
                            </PillLink>
                            <span className="text-sm text-muted-foreground">User</span>
                          </div>
                        ) : (
                          <PillLink href={`/${allocation.resourceId}`}>
                            {allocation.pageTitle || allocation.resourceId}
                          </PillLink>
                        )}

                        {allocation.resourceType !== 'user' && (
                          <Badge variant="outline" className="text-xs">
                            {getResourceTypeLabel(allocation.resourceType)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amount and percentage */}
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <span className="font-medium">{formatUsdCents(allocation.usdCents)}</span>
                    <span>•</span>
                    <span>{percentage.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Middle row: Plus/Minus buttons and composition bar */}
                <div className="flex items-center space-x-3">
                  {/* Plus/Minus buttons */}
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title="Decrease allocation"
                      onClick={() => onDecreaseAllocation?.(allocation)}
                      disabled={!onDecreaseAllocation}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title="Increase allocation"
                      onClick={() => onIncreaseAllocation?.(allocation)}
                      disabled={!onIncreaseAllocation}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Composition bar */}
                  <div className="flex-1 relative h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-in-out"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Bottom row: Actions */}
                {showActions && onRemoveAllocation && (
                  <div className="flex items-center justify-end space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveAllocation(allocation)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="Remove allocation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Show more/less button */}
        {hasMore && (
          <Button
            variant="ghost"
            onClick={() => setShowAll(!showAll)}
            className="w-full"
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
            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">Unallocated Funds</p>
                  <p className="text-sm text-muted-foreground">
                    Available for allocation
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600">
                  {formatUsdCents(unallocatedCents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {((unallocatedCents / totalUsdCents) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="border-t pt-4 text-sm text-muted-foreground">
          <p>
            Funds are distributed to creators at the end of each month. 
            You can modify allocations anytime before the monthly processing date.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
