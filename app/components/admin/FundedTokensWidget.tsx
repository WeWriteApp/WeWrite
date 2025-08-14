"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { DollarSign, TrendingUp } from 'lucide-react';
import { useFundedTokens, useSubscriptionRevenue, useWriterPayouts } from '../../hooks/useTokenAnalytics';
import { type DateRange } from './DateRangeFilter';
import { type GlobalAnalyticsFilters } from './GlobalAnalyticsFilters';

interface TokenWidgetProps {
  dateRange: DateRange;
  globalFilters: GlobalAnalyticsFilters;
  className?: string;
}

export function FundedTokensWidget({
  dateRange,
  globalFilters,
  className = ''
}: TokenWidgetProps) {
  const isCumulative = globalFilters.timeDisplayMode === 'cumulative';
  const { data, loading, error } = useFundedTokens(dateRange, isCumulative);

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
            <DollarSign className="h-5 w-5 text-green-600" />
            Funded Token Allocations
          </CardTitle>
          <CardDescription>
            Token allocations backed by active subscriptions
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
            <DollarSign className="h-5 w-5 text-green-600" />
            Funded Token Allocations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>Error loading funded tokens data</p>
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
          <DollarSign className="h-5 w-5 text-green-600" />
          Funded Token Allocations
        </CardTitle>
        <CardDescription>
          Token allocations backed by active subscriptions (real money)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Main Value */}
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(data.totalUsdValue)}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatTokens(data.totalTokens)} tokens allocated
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-800">
                {formatTokens(data.totalTokens)}
              </div>
              <div className="text-xs text-green-600">Total Tokens</div>
            </div>
            
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-800">
                {formatCurrency(data.totalUsdValue)}
              </div>
              <div className="text-xs text-green-600">USD Value</div>
            </div>
            
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-800">
                {data.allocations.toLocaleString()}
              </div>
              <div className="text-xs text-green-600">Allocations</div>
            </div>
          </div>

          {/* Info Note */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Note:</strong> These tokens are backed by real subscription payments and represent 
            actual money that will be paid out to writers.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SubscriptionRevenueWidget({
  dateRange,
  globalFilters,
  className = ''
}: TokenWidgetProps) {
  const isCumulative = globalFilters.timeDisplayMode === 'cumulative';
  const { data, loading, error } = useSubscriptionRevenue(dateRange, isCumulative);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className={`wewrite-card ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-600" />
            Total Subscription Revenue
          </CardTitle>
          <CardDescription>
            Revenue from all subscription payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded"></div>
            <div className="h-8 bg-muted rounded"></div>
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
            <DollarSign className="h-5 w-5 text-blue-600" />
            Total Subscription Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>Error loading subscription revenue data</p>
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
          <DollarSign className="h-5 w-5 text-blue-600" />
          Total Subscription Revenue
        </CardTitle>
        <CardDescription>
          Total revenue from all subscription payments in selected period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Main Value */}
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">
              {formatCurrency(data)}
            </div>
            <div className="text-sm text-muted-foreground">
              Total subscription revenue
            </div>
          </div>

          {/* Info Note */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Note:</strong> This includes all subscription payments from users, which funds 
            the token allocation system and writer payouts.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WriterPayoutsWidget({
  dateRange,
  globalFilters,
  className = ''
}: TokenWidgetProps) {
  const isCumulative = globalFilters.timeDisplayMode === 'cumulative';
  const { data, loading, error } = useWriterPayouts(dateRange, isCumulative);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className={`wewrite-card ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            Total Paid to Writers
          </CardTitle>
          <CardDescription>
            Total amount paid out to content creators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded"></div>
            <div className="h-8 bg-muted rounded"></div>
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
            <TrendingUp className="h-5 w-5 text-purple-600" />
            Total Paid to Writers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>Error loading writer payouts data</p>
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
          <TrendingUp className="h-5 w-5 text-purple-600" />
          Total Paid to Writers
        </CardTitle>
        <CardDescription>
          Total amount paid out to content creators via token system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Main Value */}
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600">
              {formatCurrency(data)}
            </div>
            <div className="text-sm text-muted-foreground">
              Total writer payouts
            </div>
          </div>

          {/* Info Note */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Note:</strong> This represents the total amount paid out to writers through 
            the token system, minus platform fees.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
