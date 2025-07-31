"use client";

import React from 'react';
import { Eye, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePageViewsMetrics } from '../../hooks/useDashboardAnalytics';
import { useResponsiveChart } from '../../utils/chartUtils';
import { type DateRange } from './DateRangeFilter';

interface PageViewsAnalyticsWidgetProps {
  dateRange: DateRange;
  granularity: number;
  className?: string;
}

export function PageViewsAnalyticsWidget({ dateRange, granularity, className = "" }: PageViewsAnalyticsWidgetProps) {
  const { data, loading, error } = usePageViewsMetrics(dateRange, granularity);
  const chartConfig = useResponsiveChart(data.length, data);

  // Check if we have any data
  const hasData = data && data.length > 0;

  // Calculate summary statistics only if we have data
  const totalViews = hasData ? data.reduce((sum, item) => sum + item.totalViews, 0) : 0;
  const totalUniqueViews = hasData ? data.reduce((sum, item) => sum + (item.uniqueViews || 0), 0) : 0;
  const averagePerDay = hasData && data.length > 0 ? (isNaN(totalViews / data.length) ? '0.0' : (totalViews / data.length).toFixed(1)) : '0';
  const peakDay = hasData ? Math.max(...data.map(d => d.totalViews)) : 0;

  // Calculate trend (compare first half vs second half of period)
  let trendPercentage = 0;
  let isPositiveTrend = false;

  if (hasData && data.length >= 4) {
    const midpoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midpoint);
    const secondHalf = data.slice(midpoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, item) => sum + item.totalViews, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, item) => sum + item.totalViews, 0) / secondHalf.length;
    
    if (firstHalfAvg > 0) {
      trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      isPositiveTrend = trendPercentage > 0;
    }
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <div className="space-y-1 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm">Total Views: {data.totalViews?.toLocaleString() || 0}</span>
            </div>
            {data.uniqueViews !== undefined && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm">Unique Views: {data.uniqueViews?.toLocaleString() || 0}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Page Views</h3>
          </div>
          <div className="text-right">
            <div className="h-8 w-16 bg-muted animate-pulse rounded"></div>
          </div>
        </div>
        <div className="h-64 bg-muted animate-pulse rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">Page Views</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-destructive">Error loading page views data</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`wewrite-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Page Views</h3>
        </div>
        
        {/* Summary Stats */}
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{totalViews.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">
            {averagePerDay}/day avg
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-lg font-semibold text-blue-600">{totalViews.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Total Views</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-green-600">{totalUniqueViews.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Unique Views</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-purple-600">{peakDay.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Peak Day</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-semibold flex items-center justify-center gap-1 ${isPositiveTrend ? 'text-green-600' : 'text-red-600'}`}>
            {isPositiveTrend ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {Math.abs(trendPercentage).toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">Trend</div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="pageViewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="uniqueViewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tick={{ fontSize: chartConfig.tickConfig.fontSize }}
                interval={chartConfig.tickConfig.interval}
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
              <Area
                type="monotone"
                dataKey="totalViews"
                stroke="hsl(221, 83%, 53%)"
                strokeWidth={2}
                fill="url(#pageViewsGradient)"
                name="Total Views"
              />
              {data.some(d => d.uniqueViews !== undefined) && (
                <Area
                  type="monotone"
                  dataKey="uniqueViews"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={2}
                  fill="url(#uniqueViewsGradient)"
                  name="Unique Views"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No page view data available</p>
              <p className="text-sm">Data will appear once pages start receiving views</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
