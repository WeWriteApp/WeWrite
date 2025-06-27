'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { DollarSign } from 'lucide-react';
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
        </CardTitle>
        <CardDescription>
          {isPreviewMode
            ? `Preview your token allocation for ${getCurrentMonth()}`
            : `Track your token usage for ${getCurrentMonth()}`
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Main Allocation Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalTokens}</div>
            <div className="text-sm text-muted-foreground">Monthly Allocation</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {isPreviewMode ? '0' : allocatedTokens}
            </div>
            <div className="text-sm text-muted-foreground">Allocated</div>
            <div className="text-xs text-muted-foreground">To creators</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {isPreviewMode ? totalTokens : availableTokens}
            </div>
            <div className="text-sm text-muted-foreground">Available</div>
            <div className="text-xs text-muted-foreground">To allocate</div>
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


      </CardContent>
    </Card>
  );
}
