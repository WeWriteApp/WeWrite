"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, BarChart, Bar, ComposedChart, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Users, FileText, Share2, Edit3, DollarSign, Smartphone, Eye } from 'lucide-react';

// Safe tooltip component that handles malformed data
const SafeTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  try {
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium mb-2">{label || 'Data'}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            if (!entry || typeof entry.value === 'undefined') return null;
            return (
              <p key={index} className="text-sm">
                <span className="font-medium">{entry.name || entry.dataKey}:</span> {entry.value}
              </p>
            );
          })}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in SafeTooltip:', error);
    return null;
  }
};

import { type DateRange } from './DateRangeFilter';
import { type GlobalAnalyticsFilters } from './GlobalAnalyticsFilters';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';



// Import all the analytics hooks
import {
  useAccountsMetrics,
  usePagesMetrics,
  useSharesMetrics,
  useContentChangesMetrics,
  usePWAInstallsMetrics,
  useVisitorMetrics,
  usePlatformFeeMetrics,
  useFollowedUsersMetrics
} from '../../hooks/useDashboardAnalytics';

interface DesktopOptimizedDashboardProps {
  dateRange: DateRange;
  granularity: number;
  globalFilters?: GlobalAnalyticsFilters;
}

interface DashboardRow {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  hook: any;
  valueFormatter: (data: any[], stats?: any) => string;
  chartComponent: React.ComponentType<any>;
}

// Default row height in pixels
const DEFAULT_ROW_HEIGHT = 120;
const MIN_ROW_HEIGHT = 80;
const MAX_ROW_HEIGHT = 400;

export function DesktopOptimizedDashboard({
  dateRange,
  granularity,
  globalFilters
}: DesktopOptimizedDashboardProps) {
  // Global height state - all graphs use the same height
  const [globalHeight, setGlobalHeight] = useState<number>(DEFAULT_ROW_HEIGHT);

  // Get height for all rows (now unified)
  const getRowHeight = () => globalHeight;
  
  // Handle Option+Scroll for global height adjustment
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only handle if Option/Alt key is pressed
      if (!e.altKey) return;

      e.preventDefault();

      // Calculate height change (negative deltaY = scroll up = increase height)
      const heightChange = -e.deltaY * 0.5; // Adjust sensitivity
      const newHeight = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, globalHeight + heightChange));

      setGlobalHeight(newHeight);
    };

    // Add event listener to document
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, [globalHeight]);

  // Handle mobile pinch for vertical height adjustment
  useEffect(() => {
    let initialPinchDistance: number | null = null;
    let initialHeight: number | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        // Calculate initial vertical distance between touches
        const verticalDistance = Math.abs(touch2.clientY - touch1.clientY);
        initialPinchDistance = verticalDistance;
        initialHeight = globalHeight;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistance !== null && initialHeight !== null) {
        e.preventDefault(); // Prevent default pinch zoom

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        // Calculate current vertical distance between touches
        const currentVerticalDistance = Math.abs(touch2.clientY - touch1.clientY);

        // Calculate the change in vertical distance
        const distanceChange = currentVerticalDistance - initialPinchDistance;

        // Apply height change based on vertical pinch (scale factor for sensitivity)
        const heightChange = distanceChange * 0.8;
        const newHeight = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, initialHeight + heightChange));

        setGlobalHeight(newHeight);
      }
    };

    const handleTouchEnd = () => {
      initialPinchDistance = null;
      initialHeight = null;
    };

    // Add touch event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [globalHeight]);

  // Define dashboard rows
  const dashboardRows: DashboardRow[] = [
    {
      id: 'new-accounts',
      title: 'New Accounts Created',
      icon: <Users className="h-5 w-5" />,
      color: '#3b82f6',
      hook: useAccountsMetrics,
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height }) => (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
              width={40}
            />
            <Tooltip content={<SafeTooltip />} />
            <Bar
              dataKey="count"
              fill="#3b82f6"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )
    },
    {
      id: 'new-pages',
      title: 'Pages Created & Deleted',
      icon: <FileText className="h-5 w-5" />,
      color: '#10b981',
      hook: usePagesMetrics,
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.totalPages || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height }) => (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="label"
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
              width={40}
            />
            <Tooltip content={<SafeTooltip />} />
            <Bar
              dataKey="totalPages" 
              fill="#10b981" 
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )
    },
    {
      id: 'content-changes',
      title: 'Content Changes',
      icon: <Edit3 className="h-5 w-5" />,
      color: '#f59e0b',
      hook: useContentChangesMetrics,
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.charactersAdded || 0) + (item.charactersDeleted || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height }) => (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="label"
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
              width={40}
            />
            <Tooltip content={<SafeTooltip />} />
            <Bar dataKey="charactersAdded" stackId="changes" fill="#10b981" />
            <Bar dataKey="charactersDeleted" stackId="changes" fill="#ef4444" />
            <Bar dataKey="netChange" fill="#f59e0b" />
          </ComposedChart>
        </ResponsiveContainer>
      )
    },
    {
      id: 'shares',
      title: 'Content Shares',
      icon: <Share2 className="h-5 w-5" />,
      color: '#8b5cf6',
      hook: useSharesMetrics,
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.successful || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height }) => (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="label"
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
              width={40}
            />
            <Tooltip content={<SafeTooltip />} />
            <Area
              type="monotone" 
              dataKey="successful" 
              stackId="1"
              stroke="#8b5cf6" 
              fill="#8b5cf6"
              fillOpacity={0.6}
            />
            <Area 
              type="monotone" 
              dataKey="aborted" 
              stackId="1"
              stroke="#ef4444" 
              fill="#ef4444"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      )
    },
    {
      id: 'pwa-installs',
      title: 'PWA Installs',
      icon: <Smartphone className="h-5 w-5" />,
      color: '#06b6d4',
      hook: usePWAInstallsMetrics,
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height }) => (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
              width={40}
            />
            <Tooltip content={<SafeTooltip />} />
            <Bar
              dataKey="value"
              fill="#06b6d4"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )
    },
    {
      id: 'visitors',
      title: 'Visitors',
      icon: <Eye className="h-5 w-5" />,
      color: '#84cc16',
      hook: useVisitorMetrics,
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.total || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height }) => (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="label"
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
              width={40}
            />
            <Tooltip content={<SafeTooltip />} />
            <Area
              type="monotone" 
              dataKey="total" 
              stroke="#84cc16" 
              fill="#84cc16"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      )
    },
    {
      id: 'platform-fees',
      title: 'Platform Fee Revenue',
      icon: <DollarSign className="h-5 w-5" />,
      color: '#10b981',
      hook: usePlatformFeeMetrics,
      valueFormatter: (data, stats) => {
        // Use stats if available, otherwise calculate from data
        const totalRevenue = stats?.totalRevenue || data.reduce((sum, item) => sum + (item.revenue || 0), 0);
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(totalRevenue);
      },
      chartComponent: ({ data, height }) => (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
              width={50}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              formatter={(value: number) => [
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format(value),
                'Revenue'
              ]}
            />
            <Bar
              dataKey="revenue"
              fill="#10b981"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )
    },
    {
      id: 'followed-users',
      title: 'User Follows',
      icon: <Users className="h-5 w-5" />,
      color: '#8b5cf6',
      hook: useFollowedUsersMetrics,
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height }) => (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tick={{ fontSize: 10 }}
              width={40}
            />
            <Tooltip
              labelFormatter={(label) => `Date: ${label}`}
              formatter={[
                (value: number) => [value.toLocaleString(), 'User Follows']
              ]}
            />
            <Bar
              dataKey="count"
              fill="#8b5cf6"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )
    }
  ];

  return (
    <div className="desktop-optimized-dashboard">
      {/* Instructions */}
      <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        💡 <strong>Tip:</strong> Hold <kbd className="px-1 py-0.5 bg-background rounded text-xs">Option</kbd> and scroll to adjust all graph heights. On mobile, pinch vertically to resize.
      </div>

      {/* Dashboard Rows */}
      <div className="space-y-4">
        {dashboardRows.map((row) => (
          <DashboardRow
            key={row.id}
            row={row}
            dateRange={dateRange}
            granularity={granularity}
            globalFilters={globalFilters}
            height={getRowHeight()}
          />
        ))}
      </div>
    </div>
  );
}

// Individual dashboard row component
function DashboardRow({ 
  row, 
  dateRange, 
  granularity, 
  globalFilters, 
  height 
}: {
  row: DashboardRow;
  dateRange: DateRange;
  granularity: number;
  globalFilters?: GlobalAnalyticsFilters;
  height: number;
}) {
  // Use the hook for this row
  const hookResult = row.hook(dateRange, granularity);
  const { data, loading, error } = hookResult;
  const stats = hookResult.stats; // For platform fee metrics

  // Calculate current value
  const currentValue = data && data.length > 0 ? row.valueFormatter(data, stats) : '0';
  
  // Calculate trend
  const trend = calculateTrend(data);
  
  return (
    <div 
      data-row-id={row.id}
      className="wewrite-card p-4 hover:shadow-lg transition-shadow duration-200"
      style={{ minHeight: height + 60 }} // Add padding for header
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${row.color}20`, color: row.color }}>
            {row.icon}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{row.title}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Total: {currentValue}</span>
              {trend && (
                <div className={`flex items-center gap-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{trend.percentage}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {loading && <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />}
          {error && <div className="w-2 h-2 bg-red-500 rounded-full" />}
          {!loading && !error && data.length > 0 && <div className="w-2 h-2 bg-green-500 rounded-full" />}
        </div>
      </div>
      
      {/* Chart */}
      <div style={{ height: height }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="loader"></div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-red-500">
            Error loading data
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <row.chartComponent data={data} height={height} />
        )}
      </div>
    </div>
  );
}

// Helper function to calculate trend
function calculateTrend(data: any[]) {
  if (!data || data.length < 2) return null;
  
  const midPoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midPoint);
  const secondHalf = data.slice(midPoint);
  
  const firstSum = firstHalf.reduce((sum, item) => sum + (item.count || item.value || item.total || 0), 0);
  const secondSum = secondHalf.reduce((sum, item) => sum + (item.count || item.value || item.total || 0), 0);
  
  if (firstSum === 0) return null;
  
  const percentage = ((secondSum - firstSum) / firstSum * 100);
  
  return {
    percentage: Math.abs(percentage).toFixed(1),
    isPositive: percentage > 0
  };
}
