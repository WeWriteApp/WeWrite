"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useSubscriptionRevenue } from '../../hooks/usePaymentAnalytics';
import { type DateRange } from '../../services/adminAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';
import { ErrorCard } from '../ui/ErrorCard';

interface SubscriptionRevenueWidgetProps {
  dateRange: DateRange;
  granularity?: number;
  className?: string;
}

export function SubscriptionRevenueWidget({ 
  dateRange, 
  granularity, 
  className = "" 
}: SubscriptionRevenueWidgetProps) {
  const { data, loading, error } = useSubscriptionRevenue(dateRange, granularity);
  const chartConfig = useResponsiveChart(data.length, data);

  // Handle loading state
  if (loading) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="DollarSign" size={20} className="text-primary animate-pulse" />
            <h3 className="text-lg font-semibold">Subscription Revenue</h3>
          </div>
          <div className="text-right">
            <div className="h-8 w-20 bg-muted rounded animate-pulse mb-1"></div>
            <div className="h-3 w-16 bg-muted rounded animate-pulse"></div>
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
        title="Error loading revenue data"
        message={error}
        className={className}
      />
    );
  }

  // Check if we have any data
  const hasData = data && data.length > 0;

  // Calculate summary statistics only if we have data
  const totalRevenue = hasData ? data.reduce((sum, item) => sum + item.activeRevenue, 0) : 0;
  const totalCancelledRevenue = hasData ? data.reduce((sum, item) => sum + item.cancelledRevenue, 0) : 0;
  const netRevenue = totalRevenue - totalCancelledRevenue;
  const finalCumulative = hasData ? data[data.length - 1]?.cumulativeRevenue || 0 : 0;
  
  // Calculate average ARPU and churn rate
  const averageARPU = hasData && data.length > 0 ? data.reduce((sum, item) => sum + item.averageRevenuePerUser, 0) / data.length : 0;
  const averageChurnRate = hasData && data.length > 0 ? data.reduce((sum, item) => sum + item.churnRate, 0) / data.length : 0;

  // Calculate trend
  let trendPercentage = 0;
  let isPositiveTrend = false;
  if (hasData && data.length >= 2) {
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((sum, item) => sum + item.activeRevenue, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, item) => sum + item.activeRevenue, 0) / secondHalf.length;
    
    if (firstHalfAvg > 0) {
      trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      isPositiveTrend = trendPercentage > 0;
    }
  }

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0}).format(value);
  };

  // Transform data for chart display
  const chartData = data.map(item => ({
    ...item,
    cancelledRevenueNegative: -(item.cancelledRevenue || 0)
  }));

  return (
    <div className={`wewrite-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="DollarSign" size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">Subscription Revenue</h3>
        </div>
        
        {/* Summary Stats */}
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue)}</div>
          <div className="text-xs text-muted-foreground">
            Total revenue
          </div>
        </div>
      </div>

      {/* Trend Indicator */}
      <div className="flex items-center gap-2 mb-4">
        {isPositiveTrend ? (
          <Icon name="TrendingUp" size={16} className="text-green-600" />
        ) : (
          <Icon name="TrendingDown" size={16} className="text-red-600" />
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
                tickFormatter={(value) => formatCurrency(Math.abs(value))}
              />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'cancelledRevenueNegative') {
                    return [formatCurrency(Math.abs(value)), 'Lost Revenue'];
                  }
                  if (name === 'activeRevenue') {
                    return [formatCurrency(value), 'Active Revenue'];
                  }
                  if (name === 'cumulativeRevenue') {
                    return [formatCurrency(value), 'Cumulative Revenue'];
                  }
                  if (name === 'averageRevenuePerUser') {
                    return [formatCurrency(value), 'ARPU'];
                  }
                  return [formatCurrency(value), name];
                }}
                labelFormatter={(label) => `Period: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              
              {/* Bars for active revenue (positive) and cancelled revenue (negative) */}
              <Bar 
                dataKey="activeRevenue" 
                fill="hsl(var(--primary))" 
                name="Active Revenue"
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="cancelledRevenueNegative" 
                fill="hsl(var(--destructive))" 
                name="Lost Revenue"
                radius={[0, 0, 2, 2]}
              />
              
              {/* Line for cumulative revenue */}
              <Line 
                type="monotone" 
                dataKey="cumulativeRevenue" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2, r: 3 }}
                name="Cumulative Revenue"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Icon name="DollarSign" size={48} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No revenue data available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Revenue data will appear when subscription payments are processed
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
                <Icon name="DollarSign" size={12} className="text-green-600" />
                <span className="text-xs text-muted-foreground">Net Revenue</span>
              </div>
              <div className={`text-lg font-bold ${netRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netRevenue)}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon name="Users" size={12} className="text-primary" />
                <span className="text-xs text-muted-foreground">Avg ARPU</span>
              </div>
              <div className="text-lg font-bold text-primary">
                {formatCurrency(averageARPU)}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon name="Percent" size={12} className="text-amber-600" />
                <span className="text-xs text-muted-foreground">Churn Rate</span>
              </div>
              <div className="text-lg font-bold text-amber-600">
                {isNaN(averageChurnRate) ? '0.0' : averageChurnRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total MRR</div>
              <div className="text-lg font-bold text-primary">
                {formatCurrency(finalCumulative)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}