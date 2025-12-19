'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { PieChart, PieChartSegment } from '../ui/pie-chart';
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
  const availableUsdCents = Math.max(0, totalUsdCents - allocatedUsdCents);

  // Check for overspending (or no subscription at all)
  const isOverspent = (totalUsdCents - allocatedUsdCents) < 0 || hasNoSubscription;

  // Add warning state for high allocation (90% threshold for "Nearly Full", 100% for "Fully Allocated")
  const allocationPercentage = totalUsdCents > 0 ? (allocatedUsdCents / totalUsdCents) * 100 : 0;
  const isNearlyFull = allocationPercentage >= 90 && allocationPercentage < 100 && totalUsdCents > 0 && !hasNoSubscription;

  // Determine allocated color based on status
  let allocatedColor = 'stroke-primary';
  let allocatedBgColor = 'bg-primary';
  let allocatedTextColor = 'text-primary';

  if (hasNoSubscription) {
    allocatedColor = 'stroke-orange-500';
    allocatedBgColor = 'bg-orange-500';
    allocatedTextColor = 'text-orange-500';
  } else if (isOverspent) {
    allocatedColor = 'stroke-red-500';
    allocatedBgColor = 'bg-red-500';
    allocatedTextColor = 'text-red-500';
  } else if (isNearlyFull) {
    allocatedColor = 'stroke-yellow-500';
    allocatedBgColor = 'bg-yellow-500';
    allocatedTextColor = 'text-yellow-500';
  }

  // Build segments for pie chart - allocated first, then available
  const segments: PieChartSegment[] = [
    {
      id: 'allocated',
      value: allocatedUsdCents,
      label: 'Allocated',
      color: allocatedColor,
      bgColor: allocatedBgColor,
      textColor: allocatedTextColor,
    },
    {
      id: 'available',
      value: availableUsdCents,
      label: 'Available',
      color: 'stroke-green-500',
      bgColor: 'bg-green-500',
      textColor: 'text-green-500',
    },
  ];

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <PieChart
          segments={segments}
          size={120}
          strokeWidth={16}
          showPercentage={true}
          centerLabel="allocated"
          formatValue={(value) => formatUsdCents(value)}
          showTotal={true}
          totalLabel="Monthly budget"
        />
      </CardContent>
    </Card>
  );
}
