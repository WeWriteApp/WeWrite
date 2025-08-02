'use client';

/**
 * @deprecated This component is deprecated and will be removed in a future version.
 * Use UsdAllocationDisplay instead for USD-based allocation displays.
 *
 * Legacy token allocation display - replaced by USD system.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { TokenBalance } from '../../types/database';
import { calculateTokensForAmount, getCurrentMonth } from '../../utils/subscriptionTiers';

interface TokenAllocationDisplayProps {
  subscriptionAmount: number;
  tokenBalance: TokenBalance | null;
  billingCycleEnd?: string;
  className?: string;
}

export default function TokenAllocationDisplay({
  subscriptionAmount,
  tokenBalance,
  billingCycleEnd,
  className = ""
}: TokenAllocationDisplayProps) {
  const router = useRouter();

  // Calculate monthly allocation based on subscription amount
  const monthlyAllocation = calculateTokensForAmount(subscriptionAmount);

  // Get current usage data
  const totalTokens = tokenBalance?.totalTokens || monthlyAllocation;
  const allocatedTokens = tokenBalance?.allocatedTokens || 0;

  // Special case: if subscription amount is 0, treat all allocated tokens as unfunded
  const hasNoSubscription = subscriptionAmount === 0;

  // Calculate available tokens as total minus allocated (can be negative)
  const availableTokens = totalTokens - allocatedTokens;

  // Check for overspending (or no subscription at all)
  const isOverspent = availableTokens < 0 || hasNoSubscription;

  // ENHANCEMENT: Add warning state for high allocation (same as homepage pie chart - 95% threshold)
  const allocationPercentage = totalTokens > 0 ? (allocatedTokens / totalTokens) * 100 : 0;
  const isNearlyFull = allocationPercentage >= 95 && totalTokens > 0 && !hasNoSubscription;

  // Calculate funded vs unfunded tokens
  let unfundedTokens: number;
  let fundedTokens: number;

  if (hasNoSubscription) {
    // If no subscription, all allocated tokens are unfunded
    unfundedTokens = allocatedTokens;
    fundedTokens = 0;
  } else {
    // Normal overspending logic
    unfundedTokens = isOverspent ? Math.abs(availableTokens) : 0;
    fundedTokens = allocatedTokens - unfundedTokens;
  }

  // Calculate percentages for progress bar
  let fundedPercentage: number;
  let unfundedPercentage: number;

  if (hasNoSubscription && allocatedTokens > 0) {
    // When no subscription, show all allocated tokens as 100% unfunded
    allocationPercentage = 100;
    fundedPercentage = 0;
    unfundedPercentage = 100;
  } else if (totalTokens > 0) {
    // Normal calculation when there's a subscription
    allocationPercentage = Math.min((allocatedTokens / totalTokens) * 100, 100);
    fundedPercentage = (fundedTokens / totalTokens) * 100;
    unfundedPercentage = (unfundedTokens / totalTokens) * 100;
  } else {
    // No tokens at all
    allocationPercentage = 0;
    fundedPercentage = 0;
    unfundedPercentage = 0;
  }

  // Check if this is a preview mode (no actual token balance yet)
  const isPreviewMode = !tokenBalance;

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-primary" />
          Monthly Token Allocation
        </CardTitle>
        <CardDescription>
          {getCurrentMonth()} token allocation
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Overspending/No Subscription Warning with Buy Tokens Button */}
        {!isPreviewMode && isOverspent && (
          <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-theme-medium rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <p className="font-medium text-orange-800 dark:text-orange-200">
                {hasNoSubscription
                  ? `You've allocated ${allocatedTokens} tokens but have no subscription.`
                  : `You've allocated ${Math.abs(availableTokens)} more tokens than your subscription provides.`
                }
              </p>
            </div>
            <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
              {hasNoSubscription
                ? 'All your allocations are unfunded. Purchase a subscription to fund them.'
                : 'The highest allocations will be unfunded until you upgrade your subscription.'
              }
            </p>
            {(() => {
              const tokensToFund = hasNoSubscription ? allocatedTokens : Math.abs(availableTokens);
              // Calculate tokens needed in 100-token increments
              const tokensNeeded = Math.ceil(tokensToFund / 100) * 100;
              const dollarAmount = tokensNeeded / 10; // 100 tokens = $10

              return (
                <Button
                  onClick={() => router.push('/settings/subscription')}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  size="sm"
                >
                  {hasNoSubscription
                    ? `Get ${tokensNeeded} tokens (${dollarAmount}/mo subscription)`
                    : `Buy ${tokensNeeded} more tokens (${dollarAmount}/mo)`
                  }
                </Button>
              );
            })()}
          </div>
        )}

        {/* Main Allocation Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          <div className="text-center">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-muted-foreground">
              {hasNoSubscription ? 0 : totalTokens}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Tokens per month</div>
          </div>

          <div className="text-center">
            <div className={`text-xl sm:text-2xl md:text-3xl font-bold ${isOverspent ? 'text-orange-600' : 'text-primary'}`}>
              {isPreviewMode ? '0' : allocatedTokens}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Allocated</div>
          </div>

          <div className="text-center">
            <div className={`text-xl sm:text-2xl md:text-3xl font-bold ${
              isPreviewMode ? 'text-green-600' :
              isOverspent ? 'text-orange-600' :
              'text-green-600'
            }`}>
              {isPreviewMode ? totalTokens :
               hasNoSubscription ? allocatedTokens :
               Math.abs(availableTokens)}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {isPreviewMode ? 'Available' :
               hasNoSubscription ? 'Unfunded tokens' :
               isOverspent ? 'Unfunded tokens' : 'Available'}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Token Usage</span>
            <span className={`font-medium ${isOverspent ? 'text-orange-600' : ''}`}>
              {isPreviewMode ? '0% allocated' :
               hasNoSubscription ? `${allocatedTokens} tokens allocated (no subscription)` :
               isOverspent ? `${Math.round(allocationPercentage)}% allocated (overspent)` :
               `${Math.round(allocationPercentage)}% allocated`}
            </span>
          </div>

          {/* Custom progress bar with funded/unfunded split */}
          <div className="w-full h-3 bg-muted/30 rounded-full overflow-hidden">
            <div className="flex h-full gap-0.5">
              {/* Funded tokens (blue normally, orange when nearly full - same as homepage pie chart) */}
              {fundedPercentage > 0 && (
                <div
                  className={`${isNearlyFull ? 'bg-orange-500' : 'bg-blue-600'} transition-all duration-300 rounded-full`}
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

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 tokens</span>
            <span>{hasNoSubscription ? `${allocatedTokens} tokens` : `${totalTokens} tokens`}</span>
          </div>
        </div>

        {/* Buy More Tokens Button */}
        <div className="pt-4 border-t border-border/20">
          <Button
            onClick={() => {
              // Navigate to subscription page with slider opened (same as "change plan" button)
              router.push('/settings/subscription?showTierSelector=true');
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
            size="sm"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Buy More Tokens
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}