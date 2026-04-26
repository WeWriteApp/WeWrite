"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePWANotificationsMetrics } from '../../hooks/useDashboardAnalytics';
import type { DateRange } from '../../hooks/useDashboardAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';
import { ADMIN_CHART_THEME, chartAxisTick } from './chartTheme';

interface PWANotificationsAnalyticsWidgetProps {
  dateRange: DateRange;
  granularity?: number;
  className?: string;
}

export function PWANotificationsAnalyticsWidget({ dateRange, granularity, className = "" }: PWANotificationsAnalyticsWidgetProps) {
  const { data, loading, error } = usePWANotificationsMetrics(dateRange, granularity);
  const chartConfig = useResponsiveChart(data.length, data);

  // Check if we have any data
  const hasData = data && data.length > 0;
  const chartData = hasData
    ? data.map((item) => ({
        ...item,
        label: item.label || item.date || '',
      }))
    : [];

  // Calculate summary statistics only if we have data
  const totalNotifications = hasData ? data.reduce((sum, item) => sum + item.count, 0) : 0;
  const averagePerDay = hasData && data.length > 0 ? (isNaN(totalNotifications / data.length) ? '0.0' : (totalNotifications / data.length).toFixed(1)) : '0';
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
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-sm font-semibold text-foreground">
              <span className="inline-flex items-center">
                <Icon name="Bell" size={12} className="mr-1" />
                {value} notification{value !== 1 ? 's' : ''} sent
              </span>
            </p>
          </div>
        );
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Icon name="Bell" size={20} className="text-primary mr-2" />
            <h3 className="text-lg font-semibold">PWA Notifications Sent</h3>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
          <div className="h-8 bg-muted rounded w-1/2 mb-4"></div>
          <div className="h-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Icon name="Bell" size={20} className="text-destructive mr-2" />
            <h3 className="text-lg font-semibold">PWA Notifications Sent</h3>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-destructive mb-2">Error loading notifications data</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`wewrite-card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Icon name="Bell" size={20} className="text-primary mr-2" />
          <h3 className="text-lg font-semibold">PWA Notifications Sent</h3>
        </div>
        {hasData && (
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{totalNotifications.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total notifications</div>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="text-center py-8">
          <Icon name="Bell" size={48} className="text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">No notification data available</p>
          <p className="text-sm text-muted-foreground/80">Notifications will appear here once sent</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">{averagePerDay}</div>
              <div className="text-sm text-muted-foreground">Avg/day</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">{peakDay.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Peak day</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-semibold ${isPositiveTrend ? 'text-green-600' : 'text-red-600'}`}>
                {isPositiveTrend ? '+' : ''}{trendPercentage.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Trend</div>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ADMIN_CHART_THEME.gridStroke} strokeOpacity={ADMIN_CHART_THEME.gridOpacity} />
                <XAxis 
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={chartAxisTick(chartConfig.tickConfig.fontSize)}
                  interval={chartConfig.interval}
                  tickFormatter={(value, index) => formatTickLabel(value, index, chartConfig.granularity)}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={chartConfig.tickConfig.width}
                  tick={chartAxisTick(chartConfig.tickConfig.fontSize)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="count" 
                  fill={ADMIN_CHART_THEME.series1}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={56}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 text-xs text-muted-foreground text-center">
            Track PWA push notifications sent to users over time
          </div>
        </>
      )}
    </div>
  );
}
