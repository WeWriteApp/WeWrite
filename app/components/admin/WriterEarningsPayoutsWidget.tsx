"use client";

import React, { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { formatCurrency } from '../../utils/formatCurrency';
import { useAsyncState } from '../../hooks/useAsyncState';
import type { DateRange } from '../admin/DateRangeFilter';
import type { GlobalAnalyticsFilters } from '../admin/GlobalAnalyticsFilters';

interface WriterEarningsData {
  totalEarnings: number;
  totalWriters: number;
  averageEarningsPerWriter: number;
  monthlyEarnings: number;
  cumulativeEarnings: number;
}

interface WriterPayoutsData {
  totalPayouts: number;
  totalPayoutCount: number;
  averagePayoutAmount: number;
  monthlyPayouts: number;
  cumulativePayouts: number;
  pendingPayouts: number;
}

interface WidgetProps {
  dateRange: DateRange;
  globalFilters: GlobalAnalyticsFilters;
  className?: string;
}

/**
 * Shared helper: build a URL-encoded params string for the date range + cumulative flag.
 */
function buildDateParams(dateRange: DateRange, cumulative: boolean): string {
  return new URLSearchParams({
    startDate: dateRange.startDate.toISOString(),
    endDate: dateRange.endDate.toISOString(),
    cumulative: cumulative.toString(),
  }).toString();
}

// Hook for writer earnings data
function useWriterEarnings(dateRange: DateRange, cumulative: boolean) {
  const { data, loading, error, execute } = useAsyncState<WriterEarningsData>();

  useEffect(() => {
    execute(async () => {
      const params = buildDateParams(dateRange, cumulative);
      const response = await fetch(`/api/admin/writer-earnings?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch writer earnings data');
      }
      return result.data as WriterEarningsData;
    });
    // `execute` is wrapped in `useCallback(fn, [])` inside useAsyncState, giving it a stable
    // reference across renders.  Adding it to the dep array would cause an infinite loop because
    // calling execute() updates loading state, which would re-run this effect.
  }, [dateRange.startDate, dateRange.endDate, cumulative]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}

// Hook for writer payouts data
function useWriterPayouts(dateRange: DateRange, cumulative: boolean) {
  const { data, loading, error, execute } = useAsyncState<WriterPayoutsData>();

  useEffect(() => {
    execute(async () => {
      const params = buildDateParams(dateRange, cumulative);
      const response = await fetch(`/api/admin/writer-payouts?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch writer payouts data');
      }
      return result.data as WriterPayoutsData;
    });
    // `execute` is wrapped in `useCallback(fn, [])` inside useAsyncState, giving it a stable
    // reference across renders.  Adding it to the dep array would cause an infinite loop because
    // calling execute() updates loading state, which would re-run this effect.
  }, [dateRange.startDate, dateRange.endDate, cumulative]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}

export function WriterEarningsWidget({ dateRange, globalFilters, className = '' }: WidgetProps) {
  const cumulative = globalFilters.timeDisplayMode === 'cumulative';
  const { data, loading, error } = useWriterEarnings(dateRange, cumulative);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="DollarSign" size={20} />
            Writer Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="DollarSign" size={20} />
            Writer Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500">Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="DollarSign" size={20} />
          Writer Earnings
        </CardTitle>
        <CardDescription>
          {cumulative ? 'All-time writer earnings' : 'Writer earnings for selected period'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold">
                {formatCurrency(cumulative ? data?.cumulativeEarnings || 0 : data?.totalEarnings || 0)}
              </div>
              <div className="text-sm text-muted-foreground">
                {cumulative ? 'Total Earnings' : 'Period Earnings'}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data?.totalWriters || 0}</div>
              <div className="text-sm text-muted-foreground">Active Writers</div>
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Average per Writer</span>
              <span className="font-medium">
                {formatCurrency(data?.averageEarningsPerWriter || 0)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WriterPayoutsWidget({ dateRange, globalFilters, className = '' }: WidgetProps) {
  const cumulative = globalFilters.timeDisplayMode === 'cumulative';
  const { data, loading, error } = useWriterPayouts(dateRange, cumulative);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="TrendingUp" size={20} />
            Writer Payouts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="TrendingUp" size={20} />
            Writer Payouts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500">Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="TrendingUp" size={20} />
          Writer Payouts
        </CardTitle>
        <CardDescription>
          {cumulative ? 'All-time writer payouts' : 'Writer payouts for selected period'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold">
                {formatCurrency(cumulative ? data?.cumulativePayouts || 0 : data?.totalPayouts || 0)}
              </div>
              <div className="text-sm text-muted-foreground">
                {cumulative ? 'Total Payouts' : 'Period Payouts'}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data?.totalPayoutCount || 0}</div>
              <div className="text-sm text-muted-foreground">Payout Count</div>
            </div>
          </div>
          
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Average Payout</span>
              <span className="font-medium">
                {formatCurrency(data?.averagePayoutAmount || 0)}
              </span>
            </div>
            {data?.pendingPayouts && data.pendingPayouts > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending</span>
                <Badge variant="secondary">
                  {formatCurrency(data.pendingPayouts)}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
