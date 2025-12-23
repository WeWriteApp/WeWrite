"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { useSubscriptionRevenue, usePlatformFeeMetrics, useWriterPayouts } from '../../hooks/usePaymentAnalytics';
import { type DateRange } from '../../services/dashboardAnalytics';
import { type GlobalAnalyticsFilters } from './GlobalAnalyticsFilters';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';
import { ErrorCard } from '../ui/ErrorCard';

interface UsdPaymentsOverviewWidgetProps {
  dateRange: DateRange;
  globalFilters: GlobalAnalyticsFilters;
  granularity?: number;
  className?: string;
}

export function UsdPaymentsOverviewWidget({ 
  dateRange, 
  globalFilters,
  granularity = 50, 
  className = "" 
}: UsdPaymentsOverviewWidgetProps) {
  const isCumulative = globalFilters.timeDisplayMode === 'cumulative';
  
  // Fetch data from all payment sources
  const subscriptionData = useSubscriptionRevenue(dateRange, granularity);
  const platformFeeData = usePlatformFeeMetrics(dateRange, granularity, isCumulative);
  const writerPayoutData = useWriterPayouts(dateRange, isCumulative);

  const loading = subscriptionData.loading || platformFeeData.loading || writerPayoutData.loading;
  const error = subscriptionData.error || platformFeeData.error || writerPayoutData.error;

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calculate key metrics
  const totalSubscriptionRevenue = subscriptionData.data?.reduce((sum, item) => sum + (item.activeRevenue || 0), 0) || 0;
  const totalPlatformFees = platformFeeData.stats?.totalRevenue || 0;
  const totalWriterPayouts = writerPayoutData.data?.totalPayouts || writerPayoutData.data?.cumulativePayouts || 0;
  const netPlatformRevenue = totalSubscriptionRevenue - totalWriterPayouts;

  // Combine data for chart
  const chartData = React.useMemo(() => {
    if (!subscriptionData.data?.length) return [];

    return subscriptionData.data.map((subItem, index) => {
      const platformItem = platformFeeData.data?.[index];
      const payoutItem = writerPayoutData.data?.chartData?.[index];

      return {
        label: subItem.label,
        subscriptionRevenue: subItem.activeRevenue || 0,
        platformFees: platformItem?.revenue || 0,
        writerPayouts: payoutItem?.amount || 0,
        netRevenue: (subItem.activeRevenue || 0) - (payoutItem?.amount || 0)
      };
    });
  }, [subscriptionData.data, platformFeeData.data, writerPayoutData.data]);

  const chartConfig = useResponsiveChart(chartData.length, chartData);

  if (loading) {
    return (
      <Card className={`wewrite-card ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="DollarSign" size={20} className="text-green-600" />
            USD Payments Overview
          </CardTitle>
          <CardDescription>Complete financial overview of the USD payment system</CardDescription>
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
            <div className="h-80 bg-muted/50 rounded-lg animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <ErrorCard 
        title="USD Payments Overview"
        error={error}
        className={className}
      />
    );
  }

  const hasData = chartData && chartData.length > 0;

  return (
    <Card className={`wewrite-card ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="DollarSign" size={20} className="text-green-600" />
          USD Payments Overview
        </CardTitle>
        <CardDescription>
          Complete financial overview of the USD payment system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/50 dark:bg-muted/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon name="CreditCard" size={16} className="text-primary" />
                <Badge variant="secondary" className="text-xs">Revenue</Badge>
              </div>
              <div className="text-lg font-bold text-foreground dark:text-muted-foreground">
                {formatCurrency(totalSubscriptionRevenue)}
              </div>
              <div className="text-xs text-primary dark:text-primary">Subscription Revenue</div>
            </div>

            <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon name="DollarSign" size={16} className="text-green-600" />
                <Badge variant="secondary" className="text-xs">Fees</Badge>
              </div>
              <div className="text-lg font-bold text-green-800 dark:text-green-400">
                {formatCurrency(totalPlatformFees)}
              </div>
              <div className="text-xs text-green-600 dark:text-green-500">Platform Fees (10%)</div>
            </div>

            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon name="Wallet" size={16} className="text-purple-600" />
                <Badge variant="secondary" className="text-xs">Payouts</Badge>
              </div>
              <div className="text-lg font-bold text-purple-800 dark:text-purple-400">
                {formatCurrency(totalWriterPayouts)}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-500">Writer Payouts</div>
            </div>

            <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon name="TrendingUp" size={16} className="text-amber-600" />
                <Badge variant="secondary" className="text-xs">Net</Badge>
              </div>
              <div className="text-lg font-bold text-amber-800 dark:text-amber-400">
                {formatCurrency(netPlatformRevenue)}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-500">Net Platform Revenue</div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-80 w-full">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={chartConfig.margins}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="label"
                    tick={chartConfig.tickConfig}
                    interval={chartConfig.interval}
                    tickFormatter={formatTickLabel}
                  />
                  <YAxis 
                    tick={chartConfig.tickConfig}
                    tickFormatter={(value) => formatCurrency(Math.abs(value))}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const labels = {
                        subscriptionRevenue: 'Subscription Revenue',
                        platformFees: 'Platform Fees',
                        writerPayouts: 'Writer Payouts',
                        netRevenue: 'Net Revenue'
                      };
                      return [formatCurrency(value), labels[name as keyof typeof labels] || name];
                    }}
                    labelFormatter={(label) => `Period: ${label}`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  
                  {/* Bars for different revenue streams */}
                  <Bar 
                    dataKey="subscriptionRevenue" 
                    fill="#3b82f6" 
                    name="Subscription Revenue"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar 
                    dataKey="platformFees" 
                    fill="#10b981" 
                    name="Platform Fees"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar 
                    dataKey="writerPayouts" 
                    fill="#8b5cf6" 
                    name="Writer Payouts"
                    radius={[2, 2, 0, 0]}
                  />
                  
                  {/* Line for net revenue */}
                  <Line 
                    type="monotone" 
                    dataKey="netRevenue" 
                    stroke="#f59e0b" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#f59e0b' }}
                    name="Net Revenue"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Icon name="DollarSign" size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No payment data available for the selected period</p>
                  <p className="text-sm">Try selecting a different date range</p>
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>USD Payment System Overview:</strong> This chart shows the complete financial flow through WeWrite's USD-based payment system. 
            Subscription revenue flows to writers as allocations, platform fees (10%) are collected on payouts, and net revenue represents the platform's earnings after writer payouts.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
