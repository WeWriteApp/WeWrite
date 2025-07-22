"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, BarChart, Bar, ComposedChart, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Users, FileText, Share2, Edit3, DollarSign, Smartphone, Eye } from 'lucide-react';

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
  useVisitorMetrics
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
  valueFormatter: (data: any[]) => string;
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
  // Row heights state - each row can have different height
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  
  // Get default height for a row
  const getRowHeight = (rowId: string) => rowHeights[rowId] || DEFAULT_ROW_HEIGHT;
  
  // Handle Option+Scroll for height adjustment
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only handle if Option/Alt key is pressed
      if (!e.altKey) return;
      
      e.preventDefault();
      
      // Find which row we're hovering over
      const target = e.target as Element;
      const rowElement = target.closest('[data-row-id]');
      if (!rowElement) return;
      
      const rowId = rowElement.getAttribute('data-row-id');
      if (!rowId) return;
      
      // Calculate height change (negative deltaY = scroll up = increase height)
      const heightChange = -e.deltaY * 0.5; // Adjust sensitivity
      const currentHeight = getRowHeight(rowId);
      const newHeight = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, currentHeight + heightChange));
      
      setRowHeights(prev => ({
        ...prev,
        [rowId]: newHeight
      }));
    };
    
    // Add event listener to document
    document.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, [rowHeights]);

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
          <LineChart data={data}>
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
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="count" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
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
            <Tooltip />
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
            <Tooltip />
            <Bar dataKey="charactersAdded" stackId="changes" fill="#10b981" />
            <Bar dataKey="charactersDeleted" stackId="changes" fill="#ef4444" />
            <Line type="monotone" dataKey="netChange" stroke="#f59e0b" strokeWidth={2} />
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
            <Tooltip />
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
          <LineChart data={data}>
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
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#06b6d4" 
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
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
            <Tooltip />
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
    }
  ];

  return (
    <div className="desktop-optimized-dashboard">
      {/* Instructions */}
      <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        💡 <strong>Tip:</strong> Hold <kbd className="px-1 py-0.5 bg-background rounded text-xs">Option</kbd> and scroll to adjust row heights
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
            height={getRowHeight(row.id)}
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
  const { data, loading, error } = row.hook(dateRange, granularity);
  
  // Calculate current value
  const currentValue = data && data.length > 0 ? row.valueFormatter(data) : '0';
  
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
