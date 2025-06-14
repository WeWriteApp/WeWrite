/**
 * Token Allocation Dashboard
 * 
 * Allows users to view and manage their monthly token allocations
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { 
  Coins, 
  TrendingUp, 
  Users, 
  FileText, 
  Plus, 
  Minus,
  Calendar,
  Target
} from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { TokenBalance, TokenAllocation } from '../../types/database';
import { getCurrentMonth, isAllocationDeadlinePassed } from '../../utils/subscriptionTiers';

interface TokenAllocationDashboardProps {
  userId: string;
}

interface TokenData {
  balance: TokenBalance | null;
  allocations: TokenAllocation[];
  summary: {
    totalTokens: number;
    allocatedTokens: number;
    availableTokens: number;
    allocationCount: number;
  };
}

export function TokenAllocationDashboard({ userId }: TokenAllocationDashboardProps) {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTokenData();
  }, [userId]);

  const loadTokenData = async () => {
    try {
      const response = await fetch('/api/tokens/balance');
      if (response.ok) {
        const data = await response.json();
        setTokenData(data);
      } else {
        console.error('Failed to load token data');
      }
    } catch (error) {
      console.error('Error loading token data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateTokens = async (
    recipientUserId: string,
    resourceType: 'page' | 'group',
    resourceId: string,
    tokens: number
  ) => {
    setAllocating(`${resourceType}:${resourceId}`);
    
    try {
      const response = await fetch('/api/tokens/allocate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientUserId,
          resourceType,
          resourceId,
          tokens,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Tokens Allocated",
          description: `Successfully allocated ${tokens} tokens`,
        });
        
        // Reload token data
        await loadTokenData();
      } else {
        toast({
          title: "Allocation Failed",
          description: result.error || "Failed to allocate tokens",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error allocating tokens:', error);
      toast({
        title: "Allocation Error",
        description: "Failed to allocate tokens. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAllocating(null);
    }
  };

  const handleRemoveAllocation = async (
    resourceType: 'page' | 'group',
    resourceId: string
  ) => {
    setAllocating(`${resourceType}:${resourceId}`);
    
    try {
      const response = await fetch(
        `/api/tokens/allocate?resourceType=${resourceType}&resourceId=${resourceId}`,
        { method: 'DELETE' }
      );

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Allocation Removed",
          description: "Token allocation removed successfully",
        });
        
        // Reload token data
        await loadTokenData();
      } else {
        toast({
          title: "Removal Failed",
          description: result.error || "Failed to remove allocation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error removing allocation:', error);
      toast({
        title: "Removal Error",
        description: "Failed to remove allocation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAllocating(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!tokenData?.balance) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Coins className="h-5 w-5" />
            Token Allocation
          </CardTitle>
          <CardDescription>
            Subscribe to start allocating tokens to your favorite creators
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-4">
            With a WeWrite subscription, you'll receive monthly tokens to support creators.
            $1 = 10 tokens that you can allocate to pages and groups you love.
          </p>
          <Button asChild>
            <a href="/settings/subscription">Start Subscription</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { balance, allocations, summary } = tokenData;
  const allocationPercentage = summary.totalTokens > 0 
    ? (summary.allocatedTokens / summary.totalTokens) * 100 
    : 0;
  
  const currentMonth = getCurrentMonth();
  const deadlinePassed = isAllocationDeadlinePassed();

  return (
    <div className="space-y-6">
      {/* Token Balance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Token Balance - {currentMonth}
          </CardTitle>
          <CardDescription>
            Your monthly token allocation for supporting creators
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{summary.totalTokens}</div>
              <div className="text-sm text-muted-foreground">Total Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.allocatedTokens}</div>
              <div className="text-sm text-muted-foreground">Allocated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{summary.availableTokens}</div>
              <div className="text-sm text-muted-foreground">Available</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Allocation Progress</span>
              <span>{allocationPercentage.toFixed(1)}%</span>
            </div>
            <Progress value={allocationPercentage} className="h-2" />
          </div>

          {deadlinePassed && (
            <div className="bg-yellow-500/10 border-theme-medium rounded-lg p-3">
              <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Allocation Deadline Passed</span>
              </div>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                The allocation deadline for this month has passed. 
                Unallocated tokens will go to WeWrite at month end.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Allocations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Current Allocations
          </CardTitle>
          <CardDescription>
            Your token allocations for {currentMonth}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allocations.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">
                No token allocations yet this month
              </div>
              <p className="text-sm text-muted-foreground">
                Visit pages and groups to allocate your tokens to creators you want to support.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allocations.map((allocation) => (
                <div 
                  key={allocation.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {allocation.resourceType === 'page' ? (
                      <FileText className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Users className="h-5 w-5 text-green-500" />
                    )}
                    <div>
                      <div className="font-medium">
                        {allocation.resourceType === 'page' ? 'Page' : 'Group'}: {allocation.resourceId}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Recipient: {allocation.recipientUserId}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">
                      {allocation.tokens} tokens
                    </Badge>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveAllocation(
                        allocation.resourceType,
                        allocation.resourceId
                      )}
                      disabled={allocating === `${allocation.resourceType}:${allocation.resourceId}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allocation Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Allocation Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <p>• Allocate tokens to pages and groups you find valuable</p>
            <p>• You can modify allocations until the 28th of each month</p>
            <p>• Unallocated tokens automatically support WeWrite platform development</p>
            <p>• Creators can request payouts from their received tokens</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
