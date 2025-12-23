"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Icon } from '@/components/ui/Icon';
import { useSharesMetrics } from '../../hooks/useDashboardAnalytics';
import { type DateRange } from '../../hooks/useDashboardAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';

interface SharesAnalyticsWidgetProps {
  dateRange: DateRange;
  granularity?: number;
  className?: string;
}

export function SharesAnalyticsWidget({ dateRange, granularity, className = "" }: SharesAnalyticsWidgetProps) {
  const { data, loading, error } = useSharesMetrics(dateRange, granularity);
  const chartConfig = useResponsiveChart(data.length, data);

  // Check if we have any data
  const hasData = data && data.length > 0;

  // Calculate summary statistics only if we have data
  const totalShares = hasData ? data.reduce((sum, item) => sum + item.total, 0) : 0;
  const totalSuccessful = hasData ? data.reduce((sum, item) => sum + item.successful, 0) : 0;
  const totalAborted = hasData ? data.reduce((sum, item) => sum + item.aborted, 0) : 0;
  const successRate = totalShares > 0 ? (totalSuccessful / totalShares * 100) : 0;
  const averagePerDay = hasData && data.length > 0 ? (isNaN(totalShares / data.length) ? '0.0' : (totalShares / data.length).toFixed(1)) : '0';

  // Calculate trend for success rate only if we have data
  let trendPercentage = 0;
  let isPositiveTrend = false;

  if (hasData && data.length > 1) {
    const midPoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midPoint);
    const secondHalf = data.slice(midPoint);

    const firstHalfSuccessRate = firstHalf.length > 0 ?
      (firstHalf.reduce((sum, item) => sum + item.successful, 0) / firstHalf.reduce((sum, item) => sum + item.total, 0) * 100) : 0;
    const secondHalfSuccessRate = secondHalf.length > 0 ?
      (secondHalf.reduce((sum, item) => sum + item.successful, 0) / secondHalf.reduce((sum, item) => sum + item.total, 0) * 100) : 0;

    trendPercentage = firstHalfSuccessRate > 0 ? ((secondHalfSuccessRate - firstHalfSuccessRate) / firstHalfSuccessRate * 100) : 0;
    isPositiveTrend = trendPercentage > 0;
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && Array.isArray(payload) && payload.length) {
      try {
        const successful = payload.find((p: any) => p && p.dataKey === 'successful')?.value || 0;
        const aborted = payload.find((p: any) => p && p.dataKey === 'aborted')?.value || 0;
        const total = successful + aborted;
        const rate = total > 0 ? (successful / total * 100).toFixed(1) : '0';

        return (
          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
            <p className="font-medium mb-2">{label}</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Successful: {successful}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Aborted: {aborted}</span>
              </div>
              <div className="pt-1 border-t border-border">
                <span className="font-medium">Success Rate: {rate}%</span>
              </div>
            </div>
          </div>
        );
      } catch (error) {
        console.error('Error in Shares tooltip:', error);
        return null;
      }
    }
    return null;
  };

  if (error) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="Share2" size={20} className="text-destructive" />
          <h3 className="text-lg font-semibold">Shares Analytics</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-destructive">
          Error loading data: {error}
        </div>
      </div>
    );
  }

  // Show empty state if no data
  if (!loading && !hasData) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="Share2" size={20} className="text-muted-foreground" />
          <h3 className="text-lg font-semibold">Shares Analytics</h3>
        </div>
        <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
          <Icon name="Share2" size={48} className="mb-3 opacity-50" />
          <h4 className="font-medium mb-2">No Share Data Available</h4>
          <p className="text-sm text-center max-w-xs">
            Share analytics tracking is not yet implemented.
            This will show real share data once the feature is connected to analytics events.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`wewrite-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="Share2" size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">Shares Analytics</h3>
        </div>
        
        {/* Summary Stats */}
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{totalShares}</div>
          <div className="text-xs text-muted-foreground">
            {averagePerDay}/day avg
          </div>
        </div>
      </div>

      {/* Success Rate and Trend */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Icon name="CheckCircle" size={16} className="text-green-500" />
            <span className="text-sm font-medium">{isNaN(successRate) ? '0.0' : successRate.toFixed(1)}% Success Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="XCircle" size={16} className="text-red-500" />
            <span className="text-sm text-muted-foreground">{totalAborted} Aborted</span>
          </div>
        </div>
        
        {/* Trend Indicator */}
        {!loading && data.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            {isPositiveTrend ? (
              <Icon name="TrendingUp" size={16} className="text-green-500" />
            ) : (
              <Icon name="TrendingDown" size={16} className="text-red-500" />
            )}
            <span className={isPositiveTrend ? 'text-green-500' : 'text-red-500'}>
              {isNaN(trendPercentage) ? '0.0' : Math.abs(trendPercentage).toFixed(1)}% {isPositiveTrend ? 'better' : 'worse'}
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-48">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="loader"></div>
          </div>
        ) : !hasData ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Icon name="Share2" size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No share data available</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={chartConfig.margins}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tick={{ fontSize: chartConfig.tickConfig.fontSize }}
                interval={chartConfig.interval}
                tickFormatter={(value, index) => formatTickLabel(value, index, chartConfig.granularity)}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tick={{ fontSize: chartConfig.tickConfig.fontSize }}
                allowDecimals={false}
                width={chartConfig.tickConfig.width}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: window.innerWidth < 768 ? '10px' : '12px' }}
                iconType="rect"
              />
              <Bar
                dataKey="successful"
                stackId="shares"
                fill="#22c55e"
                name="Successful"
                radius={[0, 0, 0, 0]}
                maxBarSize={60}
              />
              <Bar
                dataKey="aborted"
                stackId="shares"
                fill="#ef4444"
                name="Aborted"
                radius={[2, 2, 0, 0]}
                maxBarSize={60}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer with additional info */}
      {!loading && hasData && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Best day: {Math.max(...data.map(d => d.total))} shares</span>
            <span>Total days: {data.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}