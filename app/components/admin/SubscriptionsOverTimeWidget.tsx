"use client";

import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { CreditCard, TrendingUp, TrendingDown, Plus, Minus } from 'lucide-react';
import { useSubscriptionsOverTime } from '../../hooks/usePaymentAnalytics';
import { type DateRange } from '../../services/dashboardAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';
import { ErrorCard } from '../ui/ErrorCard';

interface SubscriptionsOverTimeWidgetProps {
  dateRange: DateRange;
  granularity?: number;
  className?: string;
}

export function SubscriptionsOverTimeWidget({ 
  dateRange, 
  granularity, 
  className = "" 
}: SubscriptionsOverTimeWidgetProps) {
  const { data, loading, error } = useSubscriptionsOverTime(dateRange, granularity);
  const chartConfig = useResponsiveChart(data.length, data);

  // Handle loading state
  if (loading) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary animate-pulse" />
            <h3 className="text-lg font-semibold">Subscriptions Created</h3>
          </div>
          <div className="text-right">
            <div className="h-8 w-16 bg-muted rounded animate-pulse mb-1"></div>
            <div className="h-3 w-20 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
        <div className="h-64 bg-muted rounded animate-pulse"></div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <ErrorCard 
        title="Error loading subscriptions data"
        message={error}
        className={className}
      />
    );
  }

  // Check if we have any data
  const hasData = data && data.length > 0;

  // Calculate summary statistics only if we have data
  const totalCreated = hasData ? data.reduce((sum, item) => sum + item.subscriptionsCreated, 0) : 0;
  const totalCancelled = hasData ? data.reduce((sum, item) => sum + item.subscriptionsCancelled, 0) : 0;
  const netSubscriptions = totalCreated - totalCancelled;
  const averagePerDay = hasData && data.length > 0 ? (totalCreated / data.length).toFixed(1) : '0';
  const finalCumulative = hasData ? data[data.length - 1]?.cumulativeActive || 0 : 0;

  // Calculate trend
  let trendPercentage = 0;
  let isPositiveTrend = false;
  if (hasData && data.length >= 2) {
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((sum, item) => sum + item.subscriptionsCreated, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, item) => sum + item.subscriptionsCreated, 0) / secondHalf.length;
    
    if (firstHalfAvg > 0) {
      trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      isPositiveTrend = trendPercentage > 0;
    }
  }

  // Transform data for chart display (make cancelled values negative)
  const chartData = data.map(item => ({
    ...item,
    subscriptionsCancelledNegative: -(item.subscriptionsCancelled || 0)
  }));

  return (
    <div className={`wewrite-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Subscriptions Created</h3>
        </div>
        
        {/* Summary Stats */}
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{totalCreated}</div>
          <div className="text-xs text-muted-foreground">
            {averagePerDay}/day avg
          </div>
        </div>
      </div>

      {/* Trend Indicator */}
      <div className="flex items-center gap-2 mb-4">
        {isPositiveTrend ? (
          <TrendingUp className="h-4 w-4 text-green-600" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-600" />
        )}
        <span className={`text-sm font-medium ${isPositiveTrend ? 'text-green-600' : 'text-red-600'}`}>
          {isNaN(trendPercentage) ? '0.0' : Math.abs(trendPercentage).toFixed(1)}% {isPositiveTrend ? 'increase' : 'decrease'}
        </span>
        <span className="text-sm text-muted-foreground">vs previous period</span>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
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
                tickFormatter={(value) => Math.abs(value).toString()}
              />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'subscriptionsCancelledNegative') {
                    return [Math.abs(value), 'Cancelled'];
                  }
                  if (name === 'subscriptionsCreated') {
                    return [value, 'Created'];
                  }
                  if (name === 'cumulativeActive') {
                    return [value, 'Total Active'];
                  }
                  return [value, name];
                }}
                labelFormatter={(label) => `Period: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              
              {/* Reference line at zero */}
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
              
              {/* Bars for created (positive) and cancelled (negative) */}
              <Bar 
                dataKey="subscriptionsCreated" 
                fill="hsl(var(--primary))" 
                name="Created"
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="subscriptionsCancelledNegative" 
                fill="hsl(var(--destructive))" 
                name="Cancelled"
                radius={[0, 0, 2, 2]}
              />
              
              {/* Line for cumulative active subscriptions */}
              <Line 
                type="monotone" 
                dataKey="cumulativeActive" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2, r: 3 }}
                name="Total Active"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No subscription data available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Data will appear when users create subscriptions
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {hasData && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Plus className="h-3 w-3 text-green-600" />
                <span className="text-xs text-muted-foreground">Created</span>
              </div>
              <div className="text-lg font-bold text-green-600">{totalCreated}</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Minus className="h-3 w-3 text-red-600" />
                <span className="text-xs text-muted-foreground">Cancelled</span>
              </div>
              <div className="text-lg font-bold text-red-600">{totalCancelled}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Net Change</div>
              <div className={`text-lg font-bold ${netSubscriptions >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netSubscriptions >= 0 ? '+' : ''}{netSubscriptions}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Active</div>
              <div className="text-lg font-bold text-primary">{finalCumulative}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}