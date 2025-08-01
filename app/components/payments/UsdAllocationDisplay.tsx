'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { formatUsdCents, centsToDollars } from '../../utils/formatCurrency';
import { USD_UI_TEXT } from '../../utils/usdConstants';
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
  billingCycleEnd,
  className = ""
}: UsdAllocationDisplayProps) {
  const router = useRouter();

  // Get current usage data
  const totalUsdCents = usdBalance?.totalUsdCents || (subscriptionAmount * 100);
  const allocatedUsdCents = usdBalance?.allocatedUsdCents || 0;

  // Special case: if subscription amount is 0, treat all allocated USD as unfunded
  const hasNoSubscription = subscriptionAmount === 0;

  // Calculate available USD as total minus allocated (can be negative)
  const availableUsdCents = totalUsdCents - allocatedUsdCents;

  // Check for overspending (or no subscription at all)
  const isOverspent = availableUsdCents < 0 || hasNoSubscription;

  // Add warning state for high allocation (95% threshold)
  const allocationPercentage = totalUsdCents > 0 ? (allocatedUsdCents / totalUsdCents) * 100 : 0;
  const isNearlyFull = allocationPercentage >= 95 && totalUsdCents > 0 && !hasNoSubscription;

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
  let status: 'healthy' | 'warning' | 'overspent' | 'no-subscription';
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Monthly Fund Allocation
            </CardTitle>
            <CardDescription>
              Track your monthly creator funding allocation
            </CardDescription>
          </div>
          <Badge 
            variant="secondary" 
            className={`${statusColor} text-white border-0`}
          >
            {statusText}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Allocated</span>
            <span>{Math.round(allocationPercentage)}%</span>
          </div>
          <Progress 
            value={progressValue} 
            className="h-2"
            indicatorClassName={
              status === 'overspent' ? 'bg-red-500' :
              status === 'warning' ? 'bg-yellow-500' :
              status === 'no-subscription' ? 'bg-orange-500' :
              'bg-green-500'
            }
          />
        </div>

        {/* Allocation Breakdown */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground">Total Monthly</div>
            <div className="font-semibold text-lg">
              {formatUsdCents(totalUsdCents)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Available</div>
            <div className={`font-semibold text-lg ${
              isOverspent ? 'text-red-500' : 'text-green-600'
            }`}>
              {formatUsdCents(availableUsdCents)}
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="border-t pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Funded Allocations</span>
            <span className="font-medium text-green-600">
              {formatUsdCents(fundedUsdCents)}
            </span>
          </div>
          
          {unfundedUsdCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unfunded Allocations</span>
              <span className="font-medium text-orange-500">
                {formatUsdCents(unfundedUsdCents)}
              </span>
            </div>
          )}
        </div>

        {/* Status Messages and Actions */}
        {hasNoSubscription && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">No Active Subscription</span>
            </div>
            <p className="text-sm text-orange-700">
              You have {formatUsdCents(allocatedUsdCents)} in unfunded allocations. 
              Activate a subscription to fund these allocations.
            </p>
            <Button 
              size="sm" 
              onClick={() => router.push('/settings/fund-account')}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {USD_UI_TEXT.FUND_ACCOUNT}
            </Button>
          </div>
        )}

        {isOverspent && !hasNoSubscription && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Overspent</span>
            </div>
            <p className="text-sm text-red-700">
              You've allocated {formatUsdCents(unfundedUsdCents)} more than your monthly budget. 
              Consider upgrading your subscription or reducing allocations.
            </p>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => router.push('/settings/fund-account')}
              >
                Upgrade Plan
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => router.push('/settings/spend')}
              >
                Manage Allocations
              </Button>
            </div>
          </div>
        )}

        {isNearlyFull && !isOverspent && !hasNoSubscription && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-yellow-800">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Nearly Full</span>
            </div>
            <p className="text-sm text-yellow-700">
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
