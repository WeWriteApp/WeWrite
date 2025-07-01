"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Users } from 'lucide-react';
import { useVisitorMetrics } from '../../hooks/useDashboardAnalytics';
import { type DateRange } from '../../services/dashboardAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';

interface VisitorAnalyticsWidgetProps {
  dateRange: DateRange;
  granularity?: number;
  className?: string;
}

export function VisitorAnalyticsWidget({ dateRange, granularity, className = "" }: VisitorAnalyticsWidgetProps) {
  const { data, loading, error } = useVisitorMetrics(dateRange, granularity);
  const chartConfig = useResponsiveChart(data.length, data);

  // Check if we have any data
  const hasData = data && data.length > 0;

  // Calculate summary statistics only if we have data
  const totalVisitors = hasData ? data.reduce((sum, item) => sum + item.total, 0) : 0;
  const totalAuthenticated = hasData ? data.reduce((sum, item) => sum + item.authenticated, 0) : 0;
  const totalAnonymous = hasData ? data.reduce((sum, item) => sum + item.anonymous, 0) : 0;
  const averagePerDay = hasData && data.length > 0 ? (totalVisitors / data.length).toFixed(1) : '0';
  const authenticationRate = totalVisitors > 0 ? (totalAuthenticated / totalVisitors * 100) : 0;

  // Calculate trend (compare first half vs second half of period)
  let trendPercentage = 0;
  let isPositiveTrend = false;
  
  if (hasData && data.length > 1) {
    const midPoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midPoint);
    const secondHalf = data.slice(midPoint);
    
    const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, item) => sum + item.total, 0) / firstHalf.length : 0;
    const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, item) => sum + item.total, 0) / secondHalf.length : 0;
    
    trendPercentage = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100) : 0;
    isPositiveTrend = trendPercentage > 0;
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.find((p: any) => p.dataKey === 'total')?.value || 0;
      const authenticated = payload.find((p: any) => p.dataKey === 'authenticated')?.value || 0;
      const anonymous = payload.find((p: any) => p.dataKey === 'anonymous')?.value || 0;
      
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-sm text-primary">
              <span className="font-medium">Total:</span> {total} visitor{total !== 1 ? 's' : ''}
            </p>
            <p className="text-sm text-green-600">
              <span className="font-medium">Authenticated:</span> {authenticated}
            </p>
            <p className="text-sm text-blue-600">
              <span className="font-medium">Anonymous:</span> {anonymous}
            </p>
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
          <Users className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">Visitor Activity</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-destructive">
          Error loading data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`wewrite-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Visitor Activity</h3>
        </div>
        
        {/* Summary Stats */}
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{totalVisitors}</div>
          <div className="text-xs text-muted-foreground">
            {averagePerDay}/day avg
          </div>
        </div>
      </div>

      {/* Trend Indicator */}
      {!loading && hasData && data.length > 1 && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          {isPositiveTrend ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span className={isPositiveTrend ? 'text-green-500' : 'text-red-500'}>
            {isNaN(trendPercentage) ? '0.0' : Math.abs(trendPercentage).toFixed(1)}% {isPositiveTrend ? 'increase' : 'decrease'}
          </span>
          <span className="text-muted-foreground">vs previous period</span>
        </div>
      )}

      {/* Chart */}
      <div className="h-48">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="loader"></div>
          </div>
        ) : !hasData ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No visitor data available for selected period
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
                wrapperStyle={{ fontSize: '12px' }}
                iconType="rect"
              />
              <Bar
                dataKey="authenticated"
                name="Authenticated"
                fill="hsl(142, 76%, 36%)"
                radius={[0, 0, 0, 0]}
                className="hover:opacity-80 transition-opacity"
                maxBarSize={60}
              />
              <Bar
                dataKey="anonymous"
                name="Anonymous"
                fill="hsl(221, 83%, 53%)"
                radius={[2, 2, 0, 0]}
                className="hover:opacity-80 transition-opacity"
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
            <span>Authentication rate: {isNaN(authenticationRate) ? '0.0' : authenticationRate.toFixed(1)}%</span>
            <span>Peak: {Math.max(...data.map(d => d.total))} visitors</span>
          </div>
        </div>
      )}
    </div>
  );
}