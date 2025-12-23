"use client";

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Icon } from '@/components/ui/Icon';
import { useCumulativePagesMetrics } from '../../hooks/useDashboardAnalytics';
import { type DateRange } from '../../services/dashboardAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';

interface CumulativePagesWidgetProps {
  dateRange: DateRange;
  granularity?: number;
  className?: string;
}

export function CumulativePagesWidget({ dateRange, granularity, className = "" }: CumulativePagesWidgetProps) {
  const { data, loading, error } = useCumulativePagesMetrics(dateRange, granularity);
  const chartConfig = useResponsiveChart(data.length, data);

  // Calculate summary statistics
  const currentActivePages = data.length > 0 ? data[data.length - 1]?.totalActivePages || 0 : 0;
  const startingActivePages = data.length > 0 ? data[0]?.totalActivePages || 0 : 0;
  const totalGrowth = currentActivePages - startingActivePages;
  const growthPercentage = startingActivePages > 0 ? (totalGrowth / startingActivePages) * 100 : 0;
  const isPositiveGrowth = totalGrowth > 0;

  // Calculate peak and minimum
  const peakActivePages = Math.max(...data.map(d => d.totalActivePages || 0));
  const minActivePages = Math.min(...data.map(d => d.totalActivePages || 0));

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const activePages = data.totalActivePages || 0;
      const totalEverCreated = data.totalPagesEverCreated || 0;

      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <div className="space-y-1">
            <p className="text-sm text-primary font-medium">
              {activePages.toLocaleString()} active pages
            </p>
            <p className="text-xs text-muted-foreground">
              {totalEverCreated.toLocaleString()} total ever created
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
          <Icon name="BarChart3" size={20} className="text-destructive" />
          <h3 className="text-lg font-semibold">Cumulative Pages</h3>
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
          <Icon name="BarChart3" size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">Cumulative Pages</h3>
        </div>
        
        {/* Summary Stats */}
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">
            {currentActivePages.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">
            active pages
          </div>
        </div>
      </div>

      {/* Growth Indicator */}
      {!loading && data.length > 1 && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          {isPositiveGrowth ? (
            <Icon name="TrendingUp" size={16} className="text-green-500" />
          ) : (
            <Icon name="TrendingDown" size={16} className="text-red-500" />
          )}
          <span className={isPositiveGrowth ? 'text-green-500' : 'text-red-500'}>
            {isPositiveGrowth ? '+' : ''}{totalGrowth.toLocaleString()} pages
          </span>
          <span className="text-muted-foreground">
            ({isNaN(growthPercentage) ? '0.0' : Math.abs(growthPercentage).toFixed(1)}% {isPositiveGrowth ? 'growth' : 'decline'})
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="h-48">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="loader"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No data available for selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
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
              <Area
                type="monotone"
                dataKey="totalActivePages"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
                strokeWidth={2}
                className="hover:opacity-80 transition-opacity"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer with additional info */}
      {!loading && data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Peak: {peakActivePages.toLocaleString()} pages</span>
            <span>Minimum: {minActivePages.toLocaleString()} pages</span>
          </div>
          <div className="mt-2 flex justify-center">
            <div className="flex items-center gap-1 text-xs">
              <div className="w-2 h-2 rounded-sm bg-primary opacity-50"></div>
              <span>Active Pages Over Time</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}