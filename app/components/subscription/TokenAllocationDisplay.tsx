'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
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
  // Calculate monthly allocation based on subscription amount
  const monthlyAllocation = calculateTokensForAmount(subscriptionAmount);
  
  // Get current usage data
  const totalTokens = tokenBalance?.totalTokens || monthlyAllocation;
  const allocatedTokens = tokenBalance?.allocatedTokens || 0;
  const availableTokens = tokenBalance?.availableTokens || monthlyAllocation;

  // Calculate percentages for progress bar
  const allocationPercentage = totalTokens > 0 ? (allocatedTokens / totalTokens) * 100 : 0;

  // Check if this is a preview mode (no actual token balance yet)
  const isPreviewMode = !tokenBalance;

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-primary" />
          Monthly Token Allocation
          {!isPreviewMode && (
            <Badge variant="secondary" className="ml-2 text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Pending
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {isPreviewMode
            ? `Preview your token allocation for ${getCurrentMonth()}`
            : `Track your pending token allocations for ${getCurrentMonth()}`
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Main Allocation Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-muted-foreground">{totalTokens}</div>
            <div className="text-sm text-muted-foreground">Monthly Allocation</div>
          </div>

          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-muted-foreground">
              {isPreviewMode ? '0' : allocatedTokens}
            </div>
            <div className="text-sm text-muted-foreground">Allocated (Pending)</div>
            <div className="text-xs text-muted-foreground">To creators</div>
          </div>

          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-green-600">
              {isPreviewMode ? totalTokens : availableTokens}
            </div>
            <div className="text-sm text-muted-foreground">Available to allocate</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Token Usage</span>
            <span className="font-medium">
              {isPreviewMode ? '0% allocated' : `${Math.round(allocationPercentage)}% allocated`}
            </span>
          </div>
          <Progress
            value={isPreviewMode ? 0 : allocationPercentage}
            className="h-3"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 tokens</span>
            <span>{totalTokens} tokens</span>
          </div>
        </div>

        {/* Warning for unallocated tokens */}
        {!isPreviewMode && availableTokens > 0 && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                  You have {availableTokens} unallocated tokens
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Tokens you don't allocate will be lost, so use them all up!
                </p>
              </div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}