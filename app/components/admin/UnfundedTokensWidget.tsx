"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Coins, Users, UserX } from 'lucide-react';
import { useUnfundedLoggedOutTokens, useUnfundedLoggedInTokens } from '../../hooks/useTokenAnalytics';
import { type DateRange } from './DateRangeFilter';
import { type GlobalAnalyticsFilters } from './GlobalAnalyticsFilters';

interface UnfundedTokensWidgetProps {
  dateRange: DateRange;
  globalFilters: GlobalAnalyticsFilters;
  className?: string;
}

export function UnfundedLoggedOutTokensWidget({
  dateRange,
  globalFilters,
  className = ''
}: UnfundedTokensWidgetProps) {
  const isCumulative = globalFilters.timeDisplayMode === 'cumulative';
  const { data, loading, error } = useUnfundedLoggedOutTokens(dateRange, isCumulative);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatTokens = (tokens: number) => {
    return new Intl.NumberFormat('en-US').format(tokens);
  };

  if (loading) {
    return (
      <Card className={`wewrite-card ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-orange-600" />
            Unfunded: Logged Out Users
          </CardTitle>
          <CardDescription>
            Token allocations from logged-out users (not yet funded)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-muted rounded"></div>
              <div className="h-16 bg-muted rounded"></div>
              <div className="h-16 bg-muted rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`wewrite-card ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-orange-600" />
            Unfunded: Logged Out Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>Error loading unfunded tokens data</p>
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`wewrite-card ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="h-5 w-5 text-orange-600" />
          Unfunded: Logged Out Users
        </CardTitle>
        <CardDescription>
          Token allocations from logged-out users (stored in localStorage, not yet funded)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Main Value */}
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {formatCurrency(data.totalUsdValue)}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatTokens(data.totalTokens)} tokens allocated
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-800">
                {formatTokens(data.totalTokens)}
              </div>
              <div className="text-xs text-orange-600">Total Tokens</div>
            </div>
            
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-800">
                {formatCurrency(data.totalUsdValue)}
              </div>
              <div className="text-xs text-orange-600">USD Value</div>
            </div>
            
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-800">
                {data.allocations.toLocaleString()}
              </div>
              <div className="text-xs text-orange-600">Allocations</div>
            </div>
          </div>

          {/* Info Note */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Note:</strong> These tokens are allocated by logged-out users and stored in localStorage. 
            They become funded when users create accounts and subscribe.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function UnfundedLoggedInTokensWidget({
  dateRange,
  globalFilters,
  className = ''
}: UnfundedTokensWidgetProps) {
  const isCumulative = globalFilters.timeDisplayMode === 'cumulative';
  const { data, loading, error } = useUnfundedLoggedInTokens(dateRange, isCumulative);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatTokens = (tokens: number) => {
    return new Intl.NumberFormat('en-US').format(tokens);
  };

  if (loading) {
    return (
      <Card className={`wewrite-card ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-600" />
            Unfunded: Logged In Users
          </CardTitle>
          <CardDescription>
            Token allocations from logged-in users without subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-muted rounded"></div>
              <div className="h-16 bg-muted rounded"></div>
              <div className="h-16 bg-muted rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`wewrite-card ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-600" />
            Unfunded: Logged In Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>Error loading unfunded tokens data</p>
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`wewrite-card ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-amber-600" />
          Unfunded: Logged In Users
        </CardTitle>
        <CardDescription>
          Token allocations from logged-in users without active subscriptions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Main Value */}
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600">
              {formatCurrency(data.totalUsdValue)}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatTokens(data.totalTokens)} tokens allocated
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-lg font-bold text-amber-800">
                {formatTokens(data.totalTokens)}
              </div>
              <div className="text-xs text-amber-600">Total Tokens</div>
            </div>
            
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-lg font-bold text-amber-800">
                {formatCurrency(data.totalUsdValue)}
              </div>
              <div className="text-xs text-amber-600">USD Value</div>
            </div>
            
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-lg font-bold text-amber-800">
                {data.allocations.toLocaleString()}
              </div>
              <div className="text-xs text-amber-600">Allocations</div>
            </div>
          </div>

          {/* Info Note */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Note:</strong> These tokens are allocated by logged-in users who don't have active subscriptions. 
            They become funded when users subscribe.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
