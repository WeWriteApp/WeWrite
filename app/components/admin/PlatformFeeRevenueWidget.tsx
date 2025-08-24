"use client";

import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { usePlatformFeeMetrics } from '../../hooks/useDashboardAnalytics';
import { type DateRange } from './DateRangeFilter';
import { type GlobalAnalyticsFilters } from './GlobalAnalyticsFilters';
import { useResponsiveChart } from '../../utils/chartUtils';

interface PlatformFeeRevenueWidgetProps {
  dateRange: DateRange;
  globalFilters: GlobalAnalyticsFilters;
  granularity?: number;
  className?: string;
}

export function PlatformFeeRevenueWidget({
  dateRange,
  globalFilters,
  granularity = 50,
  className = ""
}: PlatformFeeRevenueWidgetProps) {
  const isCumulative = globalFilters.timeDisplayMode === 'cumulative';
  const { data, stats, loading, error } = usePlatformFeeMetrics(dateRange, granularity, isCumulative);
  const chartConfig = useResponsiveChart(data.length, data);

  // Check if we have any data
  const hasData = data && data.length > 0;

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Card className={`wewrite-card ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Platform Fee Revenue
          </CardTitle>
          <CardDescription>WeWrite platform fee revenue (10% of payouts)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Loading skeleton for stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center p-3 bg-muted/50 rounded-lg animate-pulse">
                  <div className="h-6 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded"></div>
                </div>
              ))}
            </div>
            {/* Loading skeleton for chart */}
            <div className="h-64 bg-muted/50 rounded-lg animate-pulse"></div>
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
            <DollarSign className="h-5 w-5 text-red-600" />
            Platform Fee Revenue
          </CardTitle>
          <CardDescription>WeWrite platform fee revenue (10% of payouts)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-2">Failed to load platform fee data</p>
            <p className="text-sm text-muted-foreground">{error}</p>
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
          Platform Fee Revenue
        </CardTitle>
        <CardDescription>
          WeWrite platform fee revenue (10% of payouts) over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-800">
                {formatCurrency(stats.totalRevenue)}
              </div>
              <div className="text-xs text-green-600">Total Revenue</div>
            </div>
            
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold text-foreground">
                {formatCurrency(stats.monthlyRevenue)}
              </div>
              <div className="text-xs text-primary">This Month</div>
            </div>
            
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-center gap-1">
                <span className="text-lg font-bold text-purple-800">
                  {formatPercentage(stats.growth)}
                </span>
                {stats.growth > 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : stats.growth < 0 ? (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                ) : null}
              </div>
              <div className="text-xs text-purple-600">Monthly Growth</div>
            </div>
            
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-800">
                {formatCurrency(stats.averageFeePerPayout)}
              </div>
              <div className="text-xs text-orange-600">Avg per Payout</div>
            </div>
          </div>

          {/* Chart */}
          {hasData ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Revenue Trend</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {stats.totalPayouts} total payouts
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    10% platform fee
                  </Badge>
                </div>
              </div>
              
              <div style={{ height: chartConfig.height }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      className="text-xs"
                      tick={{ fontSize: 10 }}
                      interval={chartConfig.tickInterval}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      className="text-xs"
                      tick={{ fontSize: 10 }}
                      width={50}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === 'revenue' ? formatCurrency(value) : value,
                        name === 'revenue' ? 'Revenue' : 'Payouts'
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#10b981"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Additional insights */}
              <div className="text-xs text-muted-foreground">
                Platform fee revenue is calculated as 10% of completed payout amounts.
                Growth is calculated month-over-month.
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No platform fee revenue data available for this period</p>
                <p className="text-xs mt-1">Revenue will appear when payouts are completed</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
