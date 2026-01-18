"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, BarChart, Bar } from 'recharts';
import { SegmentedControl, SegmentedControlList, SegmentedControlTrigger } from '../ui/segmented-control';

// Hook to measure container dimensions
function useContainerSize(ref: React.RefObject<HTMLDivElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const updateSize = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };

    // Initial measurement
    updateSize();

    // Use ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(ref.current);

    return () => resizeObserver.disconnect();
  }, [ref]);

  return size;
}

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
 * Aggregate data to a specific number of buckets for consistent chart granularity
 * This ensures all charts have the same number of data points regardless of the date range,
 * making them visually comparable.
 *
 * @param data - Array of data points with date/label and numeric values
 * @param targetBuckets - Target number of buckets (data points) in the output
 * @param valueKeys - Keys containing numeric values to aggregate (will be summed)
 * @param labelKey - Key containing the label (default: 'label')
 * @param dateKey - Key containing the date (default: 'date')
 */
function aggregateToGranularity<T extends Record<string, any>>(
  data: T[],
  targetBuckets: number,
  valueKeys: string[],
  labelKey: string = 'label',
  dateKey: string = 'date'
): T[] {
  // Always return empty array for invalid input (never return undefined)
  if (!Array.isArray(data) || data.length === 0 || targetBuckets <= 0) {
    return [];
  }

  // If data already has fewer or equal points than target, return as-is
  if (data.length <= targetBuckets) {
    return data;
  }

  // Calculate how many source items per bucket
  const itemsPerBucket = data.length / targetBuckets;
  const result: T[] = [];

  for (let i = 0; i < targetBuckets; i++) {
    const startIdx = Math.floor(i * itemsPerBucket);
    const endIdx = Math.floor((i + 1) * itemsPerBucket);
    const bucketItems = data.slice(startIdx, endIdx);

    if (bucketItems.length === 0) continue;

    // Create aggregated bucket
    const aggregated: Record<string, any> = {};

    // Use the last item's label/date for the bucket (represents the end of the period)
    const lastItem = bucketItems[bucketItems.length - 1];
    aggregated[labelKey] = lastItem[labelKey];
    aggregated[dateKey] = lastItem[dateKey];

    // Sum all numeric value keys
    valueKeys.forEach(key => {
      aggregated[key] = bucketItems.reduce((sum, item) => {
        const value = typeof item[key] === 'number' ? item[key] : 0;
        return sum + value;
      }, 0);
    });

    // Copy any non-aggregated fields from the last item
    Object.keys(lastItem).forEach(key => {
      if (!(key in aggregated)) {
        aggregated[key] = lastItem[key];
      }
    });

    result.push(aggregated as T);
  }

  return result;
}

/**
 * Transform data to cumulative format
 * Takes an array of data points and keys to transform, returns the same array with cumulative values.
 *
 * @param data - Array of data points
 * @param valueKeys - Single key or array of keys to transform to cumulative values
 *
 * Examples:
 * - Single key: transformToCumulative(data, 'count') - transforms just 'count'
 * - Multiple keys: transformToCumulative(data, ['agree', 'disagree', 'neutral', 'total']) - transforms all
 *
 * This allows multi-series charts (replies, notifications) to have all their series
 * properly cumulated, not just the main valueKey.
 */
function transformToCumulative<T extends Record<string, any>>(data: T[], valueKeys: string | string[]): T[] {
  // Always return empty array for invalid input (never return undefined)
  if (!Array.isArray(data) || data.length === 0) return [];

  // Normalize to array
  const keys = Array.isArray(valueKeys) ? valueKeys : [valueKeys];

  // Initialize running totals for each key
  const runningTotals: Record<string, number> = {};
  keys.forEach(key => { runningTotals[key] = 0; });

  return data.map(item => {
    // Create mutable copy with explicit type
    const transformed: Record<string, any> = { ...item };

    keys.forEach(key => {
      const value = typeof item[key] === 'number' ? item[key] : 0;
      runningTotals[key] += value;
      transformed[key] = runningTotals[key];
    });

    return transformed as T;
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
  useRepliesMetrics,
  useLinkMetrics,
  useDashboardAnalyticsBatch,
  type DashboardBatchData
} from '../../hooks/useDashboardAnalytics';
import { usePayoutAnalytics, useWriterPendingEarnings, useWriterFinalEarnings } from '../../hooks/usePaymentAnalytics';

type ChartType = 'line' | 'bar';

interface DesktopOptimizedDashboardProps {
  dateRange: DateRange;
  granularity: number;
  globalFilters?: GlobalAnalyticsFilters;
  columnCount?: number; // 1-4 columns for grid layout
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
  /**
   * Enable batch mode to fetch all analytics in a single API call.
   * This reduces API calls from 14+ to 1, significantly improving performance.
   * Default: true (recommended for production)
   */
  useBatchMode?: boolean;
}

interface DashboardRow {
  id: string;
  title: string;
  hook: any;
  valueKey: string; // The key used for the main value (for display/formatting)
  /**
   * Keys to transform when applying cumulative mode.
   * - If not provided, defaults to [valueKey]
   * - For multi-series charts, specify all numeric keys that should be cumulated
   * - Example: ['agree', 'disagree', 'neutral', 'total'] for replies chart
   */
  cumulativeKeys?: string[];
  /**
   * Keys containing numeric values that should be aggregated (summed) when
   * reducing data points to match granularity.
   * - If not provided, defaults to [valueKey]
   * - For multi-series charts, specify all numeric keys
   */
  aggregateKeys?: string[];
  valueFormatter: (data: any[], stats?: any, metadata?: any) => string;
  tooltipFormatter?: (value: number) => string;
  chartComponent: React.ComponentType<any>;
  // If true, the hook natively supports cumulative mode via API
  supportsNativeCumulative?: boolean;
}

// Generic chart component that renders either line or bar chart based on type
// Uses explicit pixel dimensions instead of ResponsiveContainer
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
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useContainerSize(containerRef);

  // Defensive: ensure data is always an array to prevent Recharts crashes
  const safeData = Array.isArray(data) ? data : [];

  const xAxisProps = {
    dataKey: labelKey,
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: '#999999' },
    interval: 'preserveStartEnd' as const
  };

  const yAxisProps = {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: '#999999' },
    interval: 'preserveStartEnd' as const,
    width: yAxisWidth,
    tickFormatter: yAxisTickFormatter
  };

  // Don't render chart until we have valid dimensions
  const canRender = width > 50 && height > 50;

  if (chartType === 'bar') {
    return (
      <div ref={containerRef} style={{ width: '100%', height }}>
        {canRender && (
          <BarChart width={width} height={height} data={safeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} horizontal={true} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<ChartTooltip valueFormatter={tooltipFormatter} />} />
            <Bar
              dataKey={dataKey}
              fill="#3b82f6"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      {canRender && (
        <LineChart width={width} height={height} data={safeData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} horizontal={true} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<ChartTooltip valueFormatter={tooltipFormatter} />} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6' }}
          />
        </LineChart>
      )}
    </div>
  );
};

// Multi-series chart component for notifications (emails + push)
// Supports both stacked bar chart and multi-line chart modes
// Uses explicit pixel dimensions instead of ResponsiveContainer
const NotificationsChart = ({
  data,
  height,
  labelKey = 'label',
  chartType = 'bar'
}: {
  data: any[];
  height: number;
  labelKey?: string;
  chartType?: 'line' | 'bar';
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useContainerSize(containerRef);

  // Defensive: ensure data is always an array to prevent Recharts crashes
  const safeData = Array.isArray(data) ? data : [];

  const xAxisProps = {
    dataKey: labelKey,
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: '#999999' },
    interval: 'preserveStartEnd' as const
  };

  const yAxisProps = {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: '#999999' },
    interval: 'preserveStartEnd' as const,
    width: 30
  };

  // Custom tooltip for multi-series data
  const NotificationsMultiSeriesTooltip = ({ active, payload, label }: any) => {
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
                style={{ backgroundColor: entry.stroke || entry.fill }}
              />
              {entry.name}: {entry.value?.toLocaleString()}
            </p>
          ))}
        </div>
      </div>
    );
  };

  // Don't render chart until we have valid dimensions
  const canRender = width > 50 && height > 50;

  // Line chart mode - multi-line chart
  if (chartType === 'line') {
    return (
      <div ref={containerRef} style={{ width: '100%', height }}>
        {canRender && (
          <LineChart width={width} height={height} data={safeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} horizontal={true} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<NotificationsMultiSeriesTooltip />} />
            <Line type="monotone" dataKey="emails" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Emails" />
            <Line type="monotone" dataKey="pushNotifications" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="Push Notifications" />
          </LineChart>
        )}
      </div>
    );
  }

  // Bar chart mode - stacked bar chart
  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      {canRender && (
        <BarChart width={width} height={height} data={safeData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} horizontal={true} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<NotificationsMultiSeriesTooltip />} />
          <Bar
            dataKey="emails"
            stackId="notifications"
            fill="#3b82f6"
            name="Emails"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="pushNotifications"
            stackId="notifications"
            fill="#8b5cf6"
            name="Push Notifications"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      )}
    </div>
  );
};

// Multi-series chart component for replies (agree, disagree, neutral)
// Supports both stacked bar chart and multi-line chart modes
// Uses explicit pixel dimensions instead of ResponsiveContainer
const RepliesChart = ({
  data,
  height,
  labelKey = 'label',
  chartType = 'bar'
}: {
  data: any[];
  height: number;
  labelKey?: string;
  chartType?: 'line' | 'bar';
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useContainerSize(containerRef);

  // Defensive: ensure data is always an array to prevent Recharts crashes
  const safeData = Array.isArray(data) ? data : [];

  const xAxisProps = {
    dataKey: labelKey,
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: '#999999' },
    interval: 'preserveStartEnd' as const
  };

  const yAxisProps = {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 9, fill: '#999999' },
    interval: 'preserveStartEnd' as const,
    width: 30
  };

  // Custom tooltip for multi-series data
  const RepliesMultiSeriesTooltip = ({ active, payload, label }: any) => {
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
                style={{ backgroundColor: entry.stroke || entry.fill }}
              />
              {entry.name}: {entry.value?.toLocaleString()}
            </p>
          ))}
        </div>
      </div>
    );
  };

  // Don't render chart until we have valid dimensions
  const canRender = width > 50 && height > 50;

  // Line chart mode - multi-line chart with one line per reply type
  if (chartType === 'line') {
    return (
      <div ref={containerRef} style={{ width: '100%', height }}>
        {canRender && (
          <LineChart width={width} height={height} data={safeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} horizontal={true} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<RepliesMultiSeriesTooltip />} />
            <Line
              type="monotone"
              dataKey="agree"
              stroke="#22c55e"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: '#22c55e' }}
              name="Agree"
            />
            <Line
              type="monotone"
              dataKey="neutral"
              stroke="#999999"
              strokeWidth={1.5}
              dot={false}
              name="Neutral"
            />
            <Line
              type="monotone"
              dataKey="disagree"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: '#ef4444' }}
              name="Disagree"
            />
          </LineChart>
        )}
      </div>
    );
  }

  // Bar chart mode - stacked bar chart
  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      {canRender && (
        <BarChart width={width} height={height} data={safeData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} horizontal={true} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<RepliesMultiSeriesTooltip />} />
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
            fill="#999999"
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
      )}
    </div>
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
  onChartTypeChange,
  useBatchMode = true // Default to batch mode for performance
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

  // Batch data fetching - single API call for all metrics (93% reduction in API calls)
  const batchResult = useDashboardAnalyticsBatch(dateRange);
  const batchData = useBatchMode ? batchResult.data : null;
  const batchLoading = useBatchMode ? batchResult.loading : false;
  const batchError = useBatchMode ? batchResult.error : null;
  
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
      // Multi-series: transform all reply types for proper cumulative charts
      cumulativeKeys: ['agree', 'disagree', 'neutral', 'total'],
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          return data[data.length - 1]?.total?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.total || 0), 0);
        return total.toLocaleString();
      },
      // Multi-series chart: stacked bar or multi-line based on chartType toggle
      chartComponent: ({ data, height, chartType }) => (
        <RepliesChart
          data={data}
          height={height}
          chartType={chartType}
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
      // Aggregate all character change fields
      aggregateKeys: ['charactersAdded', 'charactersDeleted', 'totalChanges'],
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
      id: 'links-added',
      title: isCumulative ? 'Total Links Added (Cumulative)' : 'Links Added',
      hook: (dateRange: DateRange, granularity: number) => {
        const result = useLinkMetrics(dateRange, granularity);
        return result;
      },
      valueKey: 'total',
      cumulativeKeys: ['internalLinks', 'externalLinks', 'total'],
      aggregateKeys: ['internalLinks', 'externalLinks', 'total'],
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          return data[data.length - 1]?.total?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.total || 0), 0);
        return total.toLocaleString();
      },
      chartComponent: ({ data, height, chartType }) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const { width } = useContainerSize(containerRef);
        const canRender = width > 50 && height > 50;
        // Defensive: ensure data is always an array to prevent Recharts crashes
        const safeData = Array.isArray(data) ? data : [];

        return (
          <div ref={containerRef} style={{ width: '100%', height }}>
            {canRender && (
              chartType === 'bar' ? (
                <BarChart width={width} height={height} data={safeData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={35}
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="internalLinks" stackId="a" fill="#3b82f6" name="Internal Links" />
                  <Bar dataKey="externalLinks" stackId="a" fill="#10b981" name="External Links" />
                </BarChart>
              ) : (
                <LineChart width={width} height={height} data={safeData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={35}
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="internalLinks" stroke="#3b82f6" strokeWidth={2} dot={false} name="Internal Links" />
                  <Line type="monotone" dataKey="externalLinks" stroke="#10b981" strokeWidth={2} dot={false} name="External Links" />
                </LineChart>
              )
            )}
          </div>
        );
      }
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
      id: 'page-views',
      title: isCumulative ? 'Total Page Views (Cumulative)' : 'Page Views',
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
      // Multi-series: transform all notification types for proper cumulative charts
      cumulativeKeys: ['emails', 'pushNotifications', 'total'],
      valueFormatter: (data) => {
        if (isCumulative && data.length > 0) {
          return data[data.length - 1]?.total?.toLocaleString() || '0';
        }
        const total = data.reduce((sum, item) => sum + (item.total || 0), 0);
        return total.toLocaleString();
      },
      // Multi-series chart supporting both stacked bar and line modes
      chartComponent: ({ data, height, chartType }) => (
        <NotificationsChart
          data={data}
          height={height}
          chartType={chartType}
        />
      )
    },
    {
      id: 'writer-pending-earnings',
      title: isCumulative ? 'Total Pending Earnings (Cumulative)' : 'Writer Pending Earnings',
      hook: (dateRange: DateRange, granularity: number, globalFilters?: any) =>
        useWriterPendingEarnings(dateRange, globalFilters?.timeDisplayMode === 'cumulative'),
      valueKey: 'earnings',
      supportsNativeCumulative: true,
      valueFormatter: (data, stats, metadata) => {
        const totalCents = metadata?.totalEarnings || 0;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(totalCents / 100);
      },
      tooltipFormatter: (value: number) => `$${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      chartComponent: ({ data, height, tooltipFormatter, chartType }) => (
        <GenericChart
          data={data}
          height={height}
          dataKey="earnings"
          tooltipFormatter={tooltipFormatter}
          chartType={chartType}
          labelKey="label"
          yAxisWidth={60}
          yAxisTickFormatter={(value) => `$${(value / 100).toLocaleString()}`}
        />
      )
    },
    {
      id: 'writer-final-earnings',
      title: isCumulative ? 'Total Final Earnings (Cumulative)' : 'Writer Final Earnings',
      hook: (dateRange: DateRange, granularity: number, globalFilters?: any) =>
        useWriterFinalEarnings(dateRange, globalFilters?.timeDisplayMode === 'cumulative'),
      valueKey: 'earnings',
      supportsNativeCumulative: true,
      valueFormatter: (data, stats, metadata) => {
        const totalCents = metadata?.totalEarnings || 0;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(totalCents / 100);
      },
      tooltipFormatter: (value: number) => `$${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      chartComponent: ({ data, height, tooltipFormatter, chartType }) => (
        <GenericChart
          data={data}
          height={height}
          dataKey="earnings"
          tooltipFormatter={tooltipFormatter}
          chartType={chartType}
          labelKey="label"
          yAxisWidth={60}
          yAxisTickFormatter={(value) => `$${(value / 100).toLocaleString()}`}
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
          <SegmentedControl
            value={chartType}
            onValueChange={(value) => handleChartTypeChange(value as ChartType)}
          >
            <SegmentedControlList className="h-8">
              <SegmentedControlTrigger value="line" className="px-2.5" title="Line chart">
                <Icon name="TrendingUp" size={14} />
              </SegmentedControlTrigger>
              <SegmentedControlTrigger value="bar" className="px-2.5" title="Bar chart">
                <Icon name="BarChart3" size={14} />
              </SegmentedControlTrigger>
            </SegmentedControlList>
          </SegmentedControl>
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
              batchData={batchData}
              batchLoading={batchLoading}
              batchError={batchError}
              useBatchMode={useBatchMode}
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

// Map row IDs to batch data keys
const BATCH_DATA_MAP: Record<string, keyof DashboardBatchData> = {
  'new-accounts': 'accounts',
  'new-pages': 'pages',
  'replies': 'replies',
  'content-changes': 'contentChanges',
  'shares': 'shares',
  'links-added': 'links',
  'pwa-installs': 'pwaInstalls',
  'page-views': 'visitors',
  'platform-revenue': 'platformRevenue',
  'followed-users': 'followedUsers',
  'payout-analytics': 'payouts',
  'notifications-sent': 'notifications',
  'writer-pending-earnings': 'pendingEarnings',
  'writer-final-earnings': 'finalEarnings'
};

// Individual dashboard row component
// Full-width layout with title above chart
function DashboardRow({
  row,
  dateRange,
  granularity,
  globalFilters,
  height,
  chartType = 'line',
  batchData,
  batchLoading,
  batchError,
  useBatchMode
}: {
  row: DashboardRow;
  dateRange: DateRange;
  granularity: number;
  globalFilters?: GlobalAnalyticsFilters;
  height: number;
  chartType?: ChartType;
  batchData: DashboardBatchData | null;
  batchLoading: boolean;
  batchError: string | null;
  useBatchMode: boolean;
}) {
  // Use batch data if available and in batch mode, otherwise use individual hook
  const batchDataKey = BATCH_DATA_MAP[row.id];
  const hasBatchDataForRow = useBatchMode && batchData && batchDataKey && batchData[batchDataKey];

  // Only call the individual hook if NOT using batch mode for this row
  // This is a conditional hook call which is okay because useBatchMode doesn't change during render
  const hookResult = !hasBatchDataForRow ? row.hook(dateRange, granularity, globalFilters) : { data: [], loading: false, error: null, stats: null, metadata: null };

  // Determine data source
  let data: any[] = [];
  let loading: boolean = false;
  let error: string | null = null;
  let stats: any = null;
  let metadata: any = null;

  try {
    if (hasBatchDataForRow && batchData) {
      // Use batch data - ensure we always get an array even if the key exists but value is undefined
      const batchValue = batchDataKey ? batchData[batchDataKey] : undefined;
      data = Array.isArray(batchValue) ? batchValue : [];
      loading = batchLoading ?? false;
      error = batchError ?? null;
      stats = null;
      metadata = null;
    } else if (hookResult) {
      // Use individual hook result - ensure data is always an array
      data = Array.isArray(hookResult.data) ? hookResult.data : [];
      loading = hookResult.loading ?? false;
      error = hookResult.error ?? null;
      stats = hookResult.stats ?? null;
      metadata = hookResult.metadata ?? null;
    }
  } catch (e) {
    console.error('[DashboardRow] Error extracting data:', e);
    data = [];
    loading = false;
    error = 'Error loading data';
  }

  // Ensure rawData is always a valid array (defensive triple-check)
  const rawData: any[] = Array.isArray(data) ? data : [];

  // Check if cumulative mode is enabled
  const isCumulative = globalFilters?.timeDisplayMode === 'cumulative';

  // Step 1: Aggregate data to match granularity (ensures all charts have same number of points)
  // This makes charts visually comparable across different time ranges
  const aggregatedData = useMemo(() => {
    // Extra safety: ensure rawData is actually an array
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    try {
      // Use aggregateKeys if specified, otherwise use cumulativeKeys, otherwise use valueKey
      const keysToAggregate = row.aggregateKeys || row.cumulativeKeys || [row.valueKey];
      const result = aggregateToGranularity(rawData, granularity, keysToAggregate);
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('[DashboardRow] Error aggregating data:', e);
      return [];
    }
  }, [rawData, granularity, row.aggregateKeys, row.cumulativeKeys, row.valueKey]);

  // Step 2: Apply cumulative transformation for rows that don't natively support it
  // Use cumulativeKeys if provided, otherwise fall back to valueKey
  const normalizedData = useMemo(() => {
    // Extra safety: ensure aggregatedData is actually an array
    if (!Array.isArray(aggregatedData) || aggregatedData.length === 0) {
      return [];
    }
    if (!isCumulative || row.supportsNativeCumulative) {
      return aggregatedData;
    }
    try {
      // Use cumulativeKeys if specified, otherwise use valueKey
      const keysToTransform = row.cumulativeKeys || [row.valueKey];
      const result = transformToCumulative(aggregatedData, keysToTransform);
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('[DashboardRow] Error transforming to cumulative:', e);
      return [];
    }
  }, [aggregatedData, isCumulative, row.supportsNativeCumulative, row.valueKey, row.cumulativeKeys]);

  // Calculate the formatted total value
  const formattedValue = useMemo(() => {
    if (loading || !Array.isArray(normalizedData) || normalizedData.length === 0) return null;
    try {
      return row.valueFormatter(normalizedData, stats, metadata);
    } catch (e) {
      console.error('[DashboardRow] Error formatting value:', e);
      return null;
    }
  }, [normalizedData, loading, stats, metadata, row]);

  // Ensure we have a safe data array for the chart
  const safeChartData = Array.isArray(normalizedData) ? normalizedData : [];

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
        ) : safeChartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">
            No data available
          </div>
        ) : (
          <row.chartComponent data={safeChartData} height={height} globalFilters={globalFilters} tooltipFormatter={row.tooltipFormatter} chartType={chartType} />
        )}
      </div>
    </div>
  );
}
