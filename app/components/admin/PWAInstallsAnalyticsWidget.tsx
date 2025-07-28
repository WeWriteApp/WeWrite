"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Smartphone } from 'lucide-react';
import { usePWAInstallsMetrics } from '../../hooks/useDashboardAnalytics';
import type { DateRange } from '../../hooks/useDashboardAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';

interface PWAInstallsAnalyticsWidgetProps {
  dateRange: DateRange;
  granularity?: number;
  className?: string;
}

export function PWAInstallsAnalyticsWidget({ dateRange, granularity, className = "" }: PWAInstallsAnalyticsWidgetProps) {
  const { data, loading, error } = usePWAInstallsMetrics(dateRange, granularity);
  const chartConfig = useResponsiveChart(data.length, data);

  // Check if we have any data
  const hasData = data && data.length > 0;

  // Calculate summary statistics only if we have data
  const totalInstalls = hasData ? data.reduce((sum, item) => sum + item.count, 0) : 0;
  const averagePerDay = hasData && data.length > 0 ? (isNaN(totalInstalls / data.length) ? '0.0' : (totalInstalls / data.length).toFixed(1)) : '0';
  const peakDay = hasData ? Math.max(...data.map(d => d.count)) : 0;
  
  // Calculate trend
  let trendPercentage = 0;
  let isPositiveTrend = false;
  
  if (hasData && data.length > 1) {
    const midPoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midPoint);
    const secondHalf = data.slice(midPoint);
    
    const firstHalfAvg = firstHalf.length > 0 ? 
      (firstHalf.reduce((sum, item) => sum + item.count, 0) / firstHalf.length) : 0;
    const secondHalfAvg = secondHalf.length > 0 ? 
      (secondHalf.reduce((sum, item) => sum + item.count, 0) / secondHalf.length) : 0;
    
    trendPercentage = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100) : 0;
    isPositiveTrend = trendPercentage > 0;
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && Array.isArray(payload) && payload.length) {
      try {
        const value = payload[0]?.value || 0;
        return (
          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
            <p className="font-medium">{label}</p>
            <p className="text-sm">
              <span className="inline-block w-3 h-3 bg-purple-500 rounded mr-2"></span>
              Installs: {value}
            </p>
          </div>
        );
      } catch (error) {
        console.error('Error in PWAInstalls tooltip:', error);
        return null;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">PWA Installations</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <div className="loader"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">PWA Installations</h3>
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
          <Smartphone className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">PWA Installations</h3>
        </div>
        <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
          <Smartphone className="h-12 w-12 mb-3 opacity-50" />
          <h4 className="font-medium mb-2">PWA Installation Tracking Not Available</h4>
          <p className="text-sm text-center max-w-xs">
            Progressive Web App installation tracking is not yet implemented. 
            This will show real installation data once the feature is enabled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`wewrite-card ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Smartphone className="h-5 w-5 text-purple-500" />
        <h3 className="text-lg font-semibold">PWA Installations</h3>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-500">{totalInstalls}</div>
          <div className="text-xs text-muted-foreground">Total Installs</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{averagePerDay}</div>
          <div className="text-xs text-muted-foreground">Avg/Day</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{peakDay}</div>
          <div className="text-xs text-muted-foreground">Peak Day</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-bold ${isPositiveTrend ? 'text-green-500' : 'text-red-500'}`}>
            {trendPercentage > 0 ? '+' : ''}{isNaN(trendPercentage) ? '0.0' : trendPercentage.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">Trend</div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 mb-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="loader"></div>
          </div>
        ) : hasData ? (
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
              <Bar
                dataKey="count"
                fill="#a855f7"
                name="Installs"
                radius={[2, 2, 0, 0]}
                maxBarSize={60}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No installation data available</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer with additional info */}
      {!loading && hasData && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progressive Web App installations</span>
            <span>Total days: {data.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}