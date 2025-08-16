"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Bell } from 'lucide-react';
import { usePWANotificationsMetrics } from '../../hooks/useDashboardAnalytics';
import type { DateRange } from '../../hooks/useDashboardAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';

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
          <div className="bg-background p-3 border-theme-strong rounded-lg shadow-lg">
            <p className="text-sm text-gray-600 mb-1">{label}</p>
            <p className="text-sm font-semibold text-gray-900">
              <span className="inline-flex items-center">
                <Bell className="w-3 h-3 mr-1" />
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
      <div className={`bg-background rounded-lg border-theme-strong p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Bell className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">PWA Notifications Sent</h3>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-background rounded-lg border-theme-strong p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Bell className="w-5 h-5 text-red-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">PWA Notifications Sent</h3>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-red-600 mb-2">Error loading notifications data</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-background rounded-lg border-theme-strong p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Bell className="w-5 h-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">PWA Notifications Sent</h3>
        </div>
        {hasData && (
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{totalNotifications.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Total notifications</div>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="text-center py-8">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">No notification data available</p>
          <p className="text-sm text-gray-400">Notifications will appear here once sent</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{averagePerDay}</div>
              <div className="text-sm text-gray-500">Avg/day</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{peakDay.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Peak day</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-semibold ${isPositiveTrend ? 'text-green-600' : 'text-red-600'}`}>
                {isPositiveTrend ? '+' : ''}{trendPercentage.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">Trend</div>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: chartConfig.fontSize }}
                  tickFormatter={formatTickLabel}
                  stroke="#666"
                />
                <YAxis 
                  tick={{ fontSize: chartConfig.fontSize }}
                  stroke="#666"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="count" 
                  fill="#3b82f6"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={chartConfig.maxBarSize}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 text-xs text-gray-500 text-center">
            Track PWA push notifications sent to users over time
          </div>
        </>
      )}
    </div>
  );
}
