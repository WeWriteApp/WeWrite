"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Button } from '../ui/button';

// Custom tooltip with better formatting
const ChartTooltip = ({ active, payload, label, valueFormatter }: any) => {
  if (!active || !payload || !Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  try {
    return (
      <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
        <p className="text-muted-foreground text-xs mb-1">{label || 'Data'}</p>
        <div className="space-y-0.5">
          {payload.map((entry: any, index: number) => {
            if (!entry || typeof entry.value === 'undefined') return null;
            const formattedValue = valueFormatter ? valueFormatter(entry.value) : entry.value?.toLocaleString();
            return (
              <p key={index} className="font-medium text-foreground">
                {formattedValue}
              </p>
            );
          })}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in ChartTooltip:', error);
    return null;
  }
};

/**
 * Transform data to cumulative format
 * Takes an array of data points and a key, returns the same array with cumulative values
 */
function transformToCumulative<T extends Record<string, any>>(data: T[], valueKey: string): T[] {
  if (!Array.isArray(data) || data.length === 0) return data;

  let runningTotal = 0;
  return data.map(item => {
    const value = typeof item[valueKey] === 'number' ? item[valueKey] : 0;
    runningTotal += value;
    return {
      ...item,
      [valueKey]: runningTotal
    };
  });
}

import { type DateRange } from './DateRangeFilter';
import { type GlobalAnalyticsFilters } from './GlobalAnalyticsFilters';

// Import all the analytics hooks
import {
  useAccountsMetrics,
  usePagesMetrics,
  useSharesMetrics,
  useContentChangesMetrics,
  usePWAInstallsMetrics,
  useVisitorMetrics,
  usePlatformRevenueMetrics,
  useFollowedUsersMetrics,
  useNotificationsSentMetrics,
  useRepliesMetrics
} from '../../hooks/useDashboardAnalytics';
import { usePayoutAnalytics } from '../../hooks/usePaymentAnalytics';

type ChartType = 'line' | 'bar';

interface DesktopOptimizedDashboardProps {
  dateRange: DateRange;
  granularity: number;
  globalFilters?: GlobalAnalyticsFilters;
  columnCount?: number; // 1-4 columns for grid layout
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
}

interface DashboardRow {
  id: string;
  title: string;
  hook: any;
  valueKey: string; // The key used for the main value (for cumulative transformation)
  valueFormatter: (data: any[], stats?: any, metadata?: any) => string;
  tooltipFormatter?: (value: number) => string;
  chartComponent: React.ComponentType<any>;
  // If true, the hook natively supports cumulative mode via API
  supportsNativeCumulative?: boolean;
}

// Generic chart component that renders either line or bar chart based on type
const GenericChart = ({
  data,
  height,
  dataKey,
  tooltipFormatter,
  chartType = 'line',
  labelKey = 'label',
  yAxisWidth = 30,
  yAxisTickFormatter
}: {
  data: any[];
  height: number;
  dataKey: string;
  tooltipFormatter?: (value: number) => string;
  chartType?: ChartType;
  labelKey?: string;
  yAxisWidth?: number;
  yAxisTickFormatter?: (value: any) => string;
}) => {
  const xAxisProps = {
    dataKey: labelKey,
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.4)' },
    interval: 'preserveStartEnd' as const
  };

  const yAxisProps = {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.4)' },
    interval: 'preserveStartEnd' as const,
    width: yAxisWidth,
    tickFormatter: yAxisTickFormatter
  };

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-10" vertical={false} horizontal={true} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<ChartTooltip valueFormatter={tooltipFormatter} />} />
          <Bar
            dataKey={dataKey}
            fill="oklch(var(--foreground))"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-10" vertical={false} horizontal={true} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<ChartTooltip valueFormatter={tooltipFormatter} />} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke="oklch(var(--foreground))"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4, fill: 'oklch(var(--foreground))' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// Stacked bar chart component for notifications (emails + push)
const StackedBarChart = ({
  data,
  height,
  tooltipFormatter,
  labelKey = 'label'
}: {
  data: any[];
  height: number;
  tooltipFormatter?: (value: number) => string;
  labelKey?: string;
}) => {
  const xAxisProps = {
    dataKey: labelKey,
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.4)' },
    interval: 'preserveStartEnd' as const
  };

  const yAxisProps = {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.4)' },
    interval: 'preserveStartEnd' as const,
    width: 30
  };

  // Custom tooltip for stacked data
  const StackedTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !Array.isArray(payload) || payload.length === 0) {
      return null;
    }
    return (
      <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
        <p className="text-muted-foreground text-xs mb-1">{label || 'Data'}</p>
        <div className="space-y-0.5">
          {payload.map((entry: any, index: number) => (
            <p key={index} className="font-medium text-foreground flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.fill }}
              />
              {entry.name}: {entry.value?.toLocaleString()}
            </p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-10" vertical={false} horizontal={true} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<StackedTooltip />} />
        <Bar
          dataKey="emails"
          stackId="notifications"
          fill="oklch(var(--primary))"
          name="Emails"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="pushNotifications"
          stackId="notifications"
          fill="oklch(var(--foreground) / 0.6)"
          name="Push Notifications"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

// Stacked bar chart component for replies (agree, disagree, neutral)
const RepliesStackedBarChart = ({
  data,
  height,
  labelKey = 'label'
}: {
  data: any[];
  height: number;
  labelKey?: string;
}) => {
  const xAxisProps = {
    dataKey: labelKey,
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.4)' },
    interval: 'preserveStartEnd' as const
  };

  const yAxisProps = {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.4)' },
    interval: 'preserveStartEnd' as const,
    width: 30
  };

  // Custom tooltip for stacked data
  const RepliesStackedTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !Array.isArray(payload) || payload.length === 0) {
      return null;
    }
    return (
      <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
        <p className="text-muted-foreground text-xs mb-1">{label || 'Data'}</p>
        <div className="space-y-0.5">
          {payload.map((entry: any, index: number) => (
            <p key={index} className="font-medium text-foreground flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.fill }}
              />
              {entry.name}: {entry.value?.toLocaleString()}
            </p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-10" vertical={false} horizontal={true} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<RepliesStackedTooltip />} />
        <Bar
          dataKey="agree"
          stackId="replies"
          fill="#22c55e"
          name="Agree"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="neutral"
          stackId="replies"
          fill="oklch(var(--muted-foreground) / 0.5)"
          name="Neutral"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="disagree"
          stackId="replies"
          fill="#ef4444"
          name="Disagree"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

// Default row height in pixels
const DEFAULT_ROW_HEIGHT = 120;
const MIN_ROW_HEIGHT = 80;
const MAX_ROW_HEIGHT = 400;

export function DesktopOptimizedDashboard({
  dateRange,
  granularity,
  globalFilters,
  columnCount = 1,
  chartType: externalChartType,
  onChartTypeChange
}: DesktopOptimizedDashboardProps) {
  // Global height state - all graphs use the same height
  const [globalHeight, setGlobalHeight] = useState<number>(DEFAULT_ROW_HEIGHT);

  // Chart type state - internal state with external override
  const [internalChartType, setInternalChartType] = useState<ChartType>('line');
  const chartType = externalChartType ?? internalChartType;

  const handleChartTypeChange = (type: ChartType) => {
    setInternalChartType(type);
    onChartTypeChange?.(type);
  };

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

  // Check if cumulative mode is enabled
  const isCumulative = globalFilters?.timeDisplayMode === 'cumulative';

  // Define dashboard rows - all using accent color line charts
  const dashboardRows: DashboardRow[] = [
    {
      id: 'new-accounts',
      title: isCumulative ? 'Total Accounts (Cumulative)' : 'New Accounts Created',
      hook: (dateRange: DateRange, granularity: number) => useAccountsMetrics(dateRange, granularity),
      valueKey: 'count',
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          // For cumulative, show the final total
          return data[data.length - 1]?.count?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height, tooltipFormatter, chartType }) => (
        <GenericChart
          data={data}
          height={height}
          dataKey="count"
          tooltipFormatter={tooltipFormatter}
          chartType={chartType}
        />
      )
    },
    {
      id: 'new-pages',
      title: isCumulative ? 'Total Pages (Cumulative)' : 'Pages Created',
      hook: (dateRange: DateRange, granularity: number) => usePagesMetrics(dateRange, granularity),
      valueKey: 'totalPages',
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          return data[data.length - 1]?.totalPages?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.totalPages || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height, tooltipFormatter, chartType }) => (
        <GenericChart
          data={data}
          height={height}
          dataKey="totalPages"
          tooltipFormatter={tooltipFormatter}
          chartType={chartType}
        />
      )
    },
    {
      id: 'replies',
      title: isCumulative ? 'Total Replies (Cumulative)' : 'Replies',
      hook: (dateRange: DateRange, granularity: number) => useRepliesMetrics(dateRange, granularity),
      valueKey: 'total',
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          return data[data.length - 1]?.total?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.total || 0), 0);
        return total.toLocaleString();
      },
      // Always use stacked bar chart for replies (ignores chartType toggle)
      chartComponent: ({ data, height }) => (
        <RepliesStackedBarChart
          data={data}
          height={height}
        />
      )
    },
    {
      id: 'content-changes',
      title: isCumulative ? 'Total Content Changes (Cumulative)' : 'Content Changes',
      hook: (dateRange: DateRange, granularity: number) => {
        const result = useContentChangesMetrics(dateRange, granularity);
        // Pre-compute totalChanges so cumulative transformation works correctly
        const dataWithTotal = Array.isArray(result.data) ? result.data.map(item => ({
          ...item,
          totalChanges: (item.charactersAdded || 0) + (item.charactersDeleted || 0)
        })) : [];
        return { ...result, data: dataWithTotal };
      },
      valueKey: 'totalChanges',
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          return data[data.length - 1]?.totalChanges?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.totalChanges || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height, tooltipFormatter, chartType }) => (
        <GenericChart
          data={data}
          height={height}
          dataKey="totalChanges"
          tooltipFormatter={tooltipFormatter}
          chartType={chartType}
        />
      )
    },
    {
      id: 'shares',
      title: isCumulative ? 'Total Shares (Cumulative)' : 'Content Shares',
      hook: (dateRange: DateRange, granularity: number) => useSharesMetrics(dateRange, granularity),
      valueKey: 'successful',
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          return data[data.length - 1]?.successful?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.successful || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height, tooltipFormatter, chartType }) => (
        <GenericChart
          data={data}
          height={height}
          dataKey="successful"
          tooltipFormatter={tooltipFormatter}
          chartType={chartType}
        />
      )
    },
    {
      id: 'pwa-installs',
      title: isCumulative ? 'Total PWA Installs (Cumulative)' : 'PWA Installs',
      hook: (dateRange: DateRange, granularity: number) => usePWAInstallsMetrics(dateRange, granularity),
      valueKey: 'value',
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          return data[data.length - 1]?.value?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height, tooltipFormatter, chartType }) => (
        <GenericChart
          data={data}
          height={height}
          dataKey="value"
          tooltipFormatter={tooltipFormatter}
          chartType={chartType}
        />
      )
    },
    {
      id: 'visitors',
      title: isCumulative ? 'Total Visitors (Cumulative)' : 'Visitors',
      hook: (dateRange: DateRange, granularity: number) => useVisitorMetrics(dateRange, granularity),
      valueKey: 'total',
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          return data[data.length - 1]?.total?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.total || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height, tooltipFormatter, chartType }) => (
        <GenericChart
          data={data}
          height={height}
          dataKey="total"
          tooltipFormatter={tooltipFormatter}
          chartType={chartType}
        />
      )
    },
    {
      id: 'platform-revenue',
      title: isCumulative ? 'Total Platform Revenue (Cumulative)' : 'Platform Revenue',
      hook: (dateRange: DateRange, granularity: number, globalFilters?: any) =>
        usePlatformRevenueMetrics(dateRange, granularity, globalFilters?.timeDisplayMode === 'cumulative'),
      valueKey: 'totalRevenue',
      supportsNativeCumulative: true,
      valueFormatter: (data, stats) => {
        const totalRevenue = stats?.totalRevenue || data.reduce((sum, item) => sum + (item.totalRevenue || 0), 0);
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(totalRevenue);
      },
      tooltipFormatter: (value: number) => `$${value.toLocaleString()}`,
      chartComponent: ({ data, height, tooltipFormatter, chartType }) => (
        <GenericChart
          data={data}
          height={height}
          dataKey="totalRevenue"
          tooltipFormatter={tooltipFormatter}
          chartType={chartType}
          yAxisWidth={50}
          yAxisTickFormatter={(value) => `$${value}`}
        />
      )
    },
    {
      id: 'followed-users',
      title: isCumulative ? 'Total User Follows (Cumulative)' : 'User Follows',
      hook: (dateRange: DateRange, granularity: number) => useFollowedUsersMetrics(dateRange, granularity),
      valueKey: 'count',
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          return data[data.length - 1]?.count?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height, tooltipFormatter, chartType }) => (
        <GenericChart
          data={data}
          height={height}
          dataKey="count"
          tooltipFormatter={tooltipFormatter}
          chartType={chartType}
        />
      )
    },
    {
      id: 'payout-analytics',
      title: isCumulative ? 'Total Writer Payouts (Cumulative)' : 'Writer Payouts',
      hook: (dateRange: DateRange, granularity: number, globalFilters?: any) => {
        return usePayoutAnalytics(dateRange, globalFilters?.timeDisplayMode === 'cumulative');
      },
      valueKey: 'payouts',
      supportsNativeCumulative: true,
      valueFormatter: (data, stats, metadata) => {
        const totalPayouts = metadata?.totalPayouts || 0;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(totalPayouts);
      },
      tooltipFormatter: (value: number) => `$${value.toLocaleString()}`,
      chartComponent: ({ data, height, tooltipFormatter, chartType }) => (
        <GenericChart
          data={data}
          height={height}
          dataKey="payouts"
          tooltipFormatter={tooltipFormatter}
          chartType={chartType}
          labelKey="date"
          yAxisWidth={60}
          yAxisTickFormatter={(value) => `$${value.toLocaleString()}`}
        />
      )
    },
    {
      id: 'notifications-sent',
      title: isCumulative ? 'Total Notifications Sent (Cumulative)' : 'Notifications Sent',
      hook: (dateRange: DateRange, granularity: number) => useNotificationsSentMetrics(dateRange, granularity),
      valueKey: 'total',
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          return data[data.length - 1]?.total?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.total || 0), 0);
        return total.toLocaleString();
      },
      // Always use stacked bar chart for notifications (ignores chartType toggle)
      chartComponent: ({ data, height }) => (
        <StackedBarChart
          data={data}
          height={height}
        />
      )
    }
  ];

  // Get grid class based on column count
  const getGridClass = () => {
    switch (columnCount) {
      case 2:
        return 'grid grid-cols-2 gap-4';
      case 3:
        return 'grid grid-cols-3 gap-4';
      case 4:
        return 'grid grid-cols-4 gap-4';
      default:
        return 'space-y-0'; // Single column, use original layout
    }
  };

  return (
    <div className="desktop-optimized-dashboard">
      {/* Instructions and Chart Type Toggle - hidden on mobile */}
      <div className="hidden md:flex mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground items-center justify-between">
        <div>
          💡 <strong>Tip:</strong> Hold <kbd className="px-1 py-0.5 bg-background rounded text-xs">Option</kbd> and scroll to adjust all graph heights.
        </div>
        {/* Chart Type Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs">Chart:</span>
          <div className="flex items-center bg-background rounded-md p-0.5 border border-border">
            <Button
              variant={chartType === 'line' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleChartTypeChange('line')}
              className="h-6 px-2 text-xs"
              title="Line chart"
            >
              <Icon name="TrendingUp" size={14} />
            </Button>
            <Button
              variant={chartType === 'bar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleChartTypeChange('bar')}
              className="h-6 px-2 text-xs"
              title="Bar chart"
            >
              <Icon name="BarChart3" size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Rows - Grid or List Layout */}
      <div className={getGridClass()}>
        {dashboardRows.map((row, index) => (
          <React.Fragment key={row.id}>
            <DashboardRow
              row={row}
              dateRange={dateRange}
              granularity={granularity}
              globalFilters={globalFilters}
              height={getRowHeight()}
              chartType={chartType}
            />
            {/* Separator line between graphs - only for single column layout */}
            {columnCount === 1 && index < dashboardRows.length - 1 && (
              <div className="border-t border-accent-20 my-4 md:my-6" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// Individual dashboard row component
// Full-width layout with title above chart
function DashboardRow({
  row,
  dateRange,
  granularity,
  globalFilters,
  height,
  chartType = 'line'
}: {
  row: DashboardRow;
  dateRange: DateRange;
  granularity: number;
  globalFilters?: GlobalAnalyticsFilters;
  height: number;
  chartType?: ChartType;
}) {
  // Use the hook for this row
  const hookResult = row.hook(dateRange, granularity, globalFilters);
  const { data, loading, error, stats, metadata } = hookResult;
  const rawData = Array.isArray(data) ? data : [];

  // Check if cumulative mode is enabled
  const isCumulative = globalFilters?.timeDisplayMode === 'cumulative';

  // Apply cumulative transformation for rows that don't natively support it
  const normalizedData = useMemo(() => {
    if (!isCumulative || row.supportsNativeCumulative || rawData.length === 0) {
      return rawData;
    }
    return transformToCumulative(rawData, row.valueKey);
  }, [rawData, isCumulative, row.supportsNativeCumulative, row.valueKey]);

  // Calculate the formatted total value
  const formattedValue = useMemo(() => {
    if (loading || normalizedData.length === 0) return null;
    return row.valueFormatter(normalizedData, stats, metadata);
  }, [normalizedData, loading, stats, metadata, row]);

  return (
    <div
      data-row-id={row.id}
      className="py-2"
    >
      {/* Title row with value on the right */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm text-muted-foreground">{row.title}</h3>
          {/* Status indicator */}
          {loading && <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />}
          {error && <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
        </div>
        {/* Value on the right */}
        {formattedValue && !loading && (
          <span className="text-sm font-semibold text-foreground">{formattedValue}</span>
        )}
      </div>

      {/* Chart - full width */}
      <div className="w-full" style={{ height: height, minHeight: height }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Icon name="Loader" size={20} className="text-muted-foreground/50" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-red-500/70 text-sm">
            Error loading data
          </div>
        ) : normalizedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">
            No data available
          </div>
        ) : (
          <row.chartComponent data={normalizedData} height={height} globalFilters={globalFilters} tooltipFormatter={row.tooltipFormatter} chartType={chartType} />
        )}
      </div>
    </div>
  );
}
