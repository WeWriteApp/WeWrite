"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Share2, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';
import { useSharesMetrics } from '../../hooks/useDashboardAnalytics';
import { type DateRange } from '../../services/dashboardAnalytics';

interface SharesAnalyticsWidgetProps {
  dateRange: DateRange;
  className?: string;
}

export function SharesAnalyticsWidget({ dateRange, className = "" }: SharesAnalyticsWidgetProps) {
  const { data, loading, error } = useSharesMetrics(dateRange);

  // Check if we have any data
  const hasData = data && data.length > 0;

  // Calculate summary statistics only if we have data
  const totalShares = hasData ? data.reduce((sum, item) => sum + item.total, 0) : 0;
  const totalSuccessful = hasData ? data.reduce((sum, item) => sum + item.successful, 0) : 0;
  const totalAborted = hasData ? data.reduce((sum, item) => sum + item.aborted, 0) : 0;
  const successRate = totalShares > 0 ? (totalSuccessful / totalShares * 100) : 0;
  const averagePerDay = hasData ? (totalShares / data.length).toFixed(1) : '0';

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
    if (active && payload && payload.length) {
      const successful = payload.find((p: any) => p.dataKey === 'successful')?.value || 0;
      const aborted = payload.find((p: any) => p.dataKey === 'aborted')?.value || 0;
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
    }
    return null;
  };

  if (error) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Share2 className="h-5 w-5 text-destructive" />
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
          <Share2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Shares Analytics</h3>
        </div>
        <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
          <Share2 className="h-12 w-12 mb-3 opacity-50" />
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
          <Share2 className="h-5 w-5 text-primary" />
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
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">{successRate.toFixed(1)}% Success Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-muted-foreground">{totalAborted} Aborted</span>
          </div>
        </div>
        
        {/* Trend Indicator */}
        {!loading && data.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            {isPositiveTrend ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={isPositiveTrend ? 'text-green-500' : 'text-red-500'}>
              {Math.abs(trendPercentage).toFixed(1)}% {isPositiveTrend ? 'better' : 'worse'}
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
              <Share2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No share data available</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 5,
                right: window.innerWidth < 768 ? 10 : 30,
                left: window.innerWidth < 768 ? 10 : 20,
                bottom: 5
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }}
                interval={window.innerWidth < 768 ? 'preserveStartEnd' : 0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }}
                allowDecimals={false}
                width={window.innerWidth < 768 ? 30 : 40}
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
              />
              <Bar
                dataKey="aborted"
                stackId="shares"
                fill="#ef4444"
                name="Aborted"
                radius={[2, 2, 0, 0]}
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
