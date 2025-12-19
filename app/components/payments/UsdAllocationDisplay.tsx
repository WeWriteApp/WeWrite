'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { formatUsdCents } from '../../utils/formatCurrency';
import { UsdBalance } from '../../types/database';

interface UsdAllocationDisplayProps {
  subscriptionAmount: number;
  usdBalance: UsdBalance | null;
  billingCycleEnd?: string;
  className?: string;
}

export default function UsdAllocationDisplay({
  subscriptionAmount,
  usdBalance,
  className = ""
}: UsdAllocationDisplayProps) {
  // Get current usage data
  const totalUsdCents = usdBalance?.totalUsdCents || (subscriptionAmount * 100);
  const allocatedUsdCents = usdBalance?.allocatedUsdCents || 0;

  // Special case: if subscription amount is 0, treat all allocated USD as unfunded
  const hasNoSubscription = subscriptionAmount === 0;

  // Calculate available USD as total minus allocated (can be negative)
  const availableUsdCents = totalUsdCents - allocatedUsdCents;

  // Check for overspending (or no subscription at all)
  const isOverspent = availableUsdCents < 0 || hasNoSubscription;

  // Add warning state for high allocation (90% threshold for "Nearly Full", 100% for "Fully Allocated")
  const allocationPercentage = totalUsdCents > 0 ? (allocatedUsdCents / totalUsdCents) * 100 : 0;
  const isNearlyFull = allocationPercentage >= 90 && allocationPercentage < 100 && totalUsdCents > 0 && !hasNoSubscription;
  const isFullyAllocated = allocationPercentage >= 100 && totalUsdCents > 0 && !hasNoSubscription;

  // Progress bar value (capped at 100%)
  const progressValue = Math.min(allocationPercentage, 100);

  // Status determination for progress bar color
  let status: 'healthy' | 'warning' | 'fully-allocated' | 'overspent' | 'no-subscription';

  if (hasNoSubscription) {
    status = 'no-subscription';
  } else if (isOverspent) {
    status = 'overspent';
  } else if (isFullyAllocated) {
    status = 'fully-allocated';
  } else if (isNearlyFull) {
    status = 'warning';
  } else {
    status = 'healthy';
  }

  return (
    <Card className={className}>
      <CardContent className="space-y-4 p-4">
        {/* Progress Bar - no percentage label */}
        <Progress
          value={progressValue}
          className="h-3"
          indicatorClassName={
            status === 'overspent' ? 'bg-red-500' :
            status === 'warning' ? 'bg-yellow-500' :
            status === 'fully-allocated' ? 'bg-primary' :
            status === 'no-subscription' ? 'bg-orange-500' :
            'bg-primary'
          }
        />

        {/* Vertical Key List */}
        <div className="space-y-2">
          {/* Allocated - primary color */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary flex-shrink-0" />
              <span className="text-sm">Allocated</span>
            </div>
            <span className="font-medium text-sm text-primary tabular-nums">{formatUsdCents(allocatedUsdCents)}</span>
          </div>

          {/* Available to spend - grey */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-muted flex-shrink-0" />
              <span className="text-sm">Available to spend</span>
            </div>
            <span className="font-medium text-sm text-muted-foreground tabular-nums">{formatUsdCents(Math.max(0, availableUsdCents))}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
