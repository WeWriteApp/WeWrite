'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { formatUsdCents, centsToDollars } from '../../utils/formatCurrency';
import { USD_UI_TEXT } from '../../utils/usdConstants';
import { UsdBalance, UsdAllocation } from '../../types/database';
import { UsdAllocationBreakdown } from './UsdAllocationBreakdown';
import { useAuth } from '../../providers/AuthProvider';

interface EnhancedUsdAllocation {
  id: string;
  pageId: string;
  pageTitle: string;
  authorId: string;
  authorUsername: string;
  usdCents: number;
  month: string;
  resourceType: 'page' | 'user_bio' | 'user' | 'wewrite';
  resourceId: string;
}

interface UsdAllocationDisplayProps {
  subscriptionAmount: number;
  usdBalance: UsdBalance | null;
  billingCycleEnd?: string;
  className?: string;
}

export default function UsdAllocationDisplay({
  subscriptionAmount,
  usdBalance,
  billingCycleEnd,
  className = ""
}: UsdAllocationDisplayProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [allocations, setAllocations] = useState<EnhancedUsdAllocation[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  // Fetch allocations
  useEffect(() => {
    const fetchAllocations = async () => {
      if (!user?.uid) return;

      setLoadingAllocations(true);
      try {
        const response = await fetch('/api/usd/allocations');
        if (response.ok) {
          const data = await response.json();
          setAllocations(data.allocations || []);
        }
      } catch (error) {
        console.error('Error fetching USD allocations:', error);
      } finally {
        setLoadingAllocations(false);
      }
    };

    fetchAllocations();
  }, [user?.uid]);

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

  // Calculate funded vs unfunded USD
  let unfundedUsdCents: number;
  let fundedUsdCents: number;

  if (hasNoSubscription) {
    // No subscription: all allocated USD is unfunded
    unfundedUsdCents = allocatedUsdCents;
    fundedUsdCents = 0;
  } else if (isOverspent) {
    // Overspent: some allocated USD is unfunded
    unfundedUsdCents = Math.abs(availableUsdCents);
    fundedUsdCents = totalUsdCents;
  } else {
    // Normal case: all allocated USD is funded
    unfundedUsdCents = 0;
    fundedUsdCents = allocatedUsdCents;
  }

  // Progress bar value (capped at 100%)
  const progressValue = Math.min(allocationPercentage, 100);

  // Status determination
  let status: 'healthy' | 'warning' | 'fully-allocated' | 'overspent' | 'no-subscription';
  let statusColor: string;
  let statusText: string;

  if (hasNoSubscription) {
    status = 'no-subscription';
    statusColor = 'bg-orange-500';
    statusText = 'No Active Subscription';
  } else if (isOverspent) {
    status = 'overspent';
    statusColor = 'bg-red-500';
    statusText = 'Overspent';
  } else if (isFullyAllocated) {
    status = 'fully-allocated';
    statusColor = 'bg-blue-500';
    statusText = 'Fully Allocated';
  } else if (isNearlyFull) {
    status = 'warning';
    statusColor = 'bg-yellow-500';
    statusText = 'Nearly Full';
  } else {
    status = 'healthy';
    statusColor = 'bg-green-500';
    statusText = 'Healthy';
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2 px-3 sm:px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Summary
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Your monthly funding overview
            </CardDescription>
          </div>
          <Badge
            variant="secondary"
            className={`${statusColor} text-white border-0 self-start sm:self-auto text-xs`}
          >
            {statusText}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-3 sm:px-4 pb-3">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span>Allocated</span>
            <span className="font-medium">{Math.round(allocationPercentage)}%</span>
          </div>
          <Progress
            value={progressValue}
            className="h-2"
            indicatorClassName={
              status === 'overspent' ? 'bg-red-500' :
              status === 'warning' ? 'bg-yellow-500' :
              status === 'fully-allocated' ? 'bg-blue-500' :
              status === 'no-subscription' ? 'bg-orange-500' :
              'bg-green-500'
            }
          />
        </div>



        {/* Detailed Breakdown */}
        <div className="border-t pt-3 space-y-2 text-xs sm:text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Funded Allocations</span>
            <span className="font-semibold text-green-600 text-sm">
              {formatUsdCents(fundedUsdCents)}
            </span>
          </div>

          {unfundedUsdCents > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Unfunded Allocations</span>
              <span className="font-semibold text-orange-500 text-sm">
                {formatUsdCents(unfundedUsdCents)}
              </span>
            </div>
          )}
        </div>

        {/* Status Messages and Actions */}
        {hasNoSubscription && (
          <div className="bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium text-sm">No Active Subscription</span>
            </div>
            <p className="text-xs sm:text-sm text-orange-700 dark:text-orange-300 leading-relaxed">
              You have {formatUsdCents(allocatedUsdCents)} in unfunded allocations.
              Activate a subscription to fund these allocations.
            </p>
            <Button
              size="sm"
              onClick={() => router.push('/settings/fund-account')}
              className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto text-xs"
            >
              {USD_UI_TEXT.FUND_ACCOUNT}
            </Button>
          </div>
        )}

        {isOverspent && !hasNoSubscription && (
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium text-sm">Overspent</span>
            </div>
            <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 leading-relaxed">
              You've allocated {formatUsdCents(unfundedUsdCents)} more than your monthly budget.
              Consider upgrading your subscription or reducing allocations.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/settings/fund-account')}
                className="w-full sm:w-auto text-xs"
              >
                Upgrade Plan
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/settings/spend')}
                className="w-full sm:w-auto text-xs"
              >
                Manage Allocations
              </Button>
            </div>
          </div>
        )}

        {isFullyAllocated && !isOverspent && !hasNoSubscription && (
          <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Fully Allocated</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              You've allocated 100% of your monthly budget.
              You have {formatUsdCents(availableUsdCents)} remaining.
            </p>
          </div>
        )}

        {isNearlyFull && !isOverspent && !hasNoSubscription && (
          <div className="bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Nearly Full</span>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              You've allocated {Math.round(allocationPercentage)}% of your monthly budget.
              You have {formatUsdCents(availableUsdCents)} remaining.
            </p>
          </div>
        )}



        {/* Billing Cycle Info */}
        {billingCycleEnd && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Next billing cycle: {new Date(billingCycleEnd).toLocaleDateString()}
          </div>
        )}

        {/* USD Info */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
          <p>{USD_UI_TEXT.TOOLTIP_TEXT}</p>
        </div>
      </CardContent>
    </Card>
  );
}
