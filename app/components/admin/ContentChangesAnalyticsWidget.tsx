"use client";

import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { FileText } from 'lucide-react';
import { useContentChangesMetrics } from '../../hooks/useDashboardAnalytics';
import type { DateRange } from '../../hooks/useDashboardAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';

interface ContentChangesAnalyticsWidgetProps {
  dateRange: DateRange;
  granularity?: number;
  className?: string;
}

export function ContentChangesAnalyticsWidget({ dateRange, granularity, className = "" }: ContentChangesAnalyticsWidgetProps) {
  const { data, loading, error } = useContentChangesMetrics(dateRange, granularity);
  const chartConfig = useResponsiveChart(data.length, data);

  // Check if we have any data
  const hasData = data && data.length > 0;

  // Calculate summary statistics only if we have data
  const totalAdded = hasData ? data.reduce((sum, item) => sum + item.charactersAdded, 0) : 0;
  const totalDeleted = hasData ? data.reduce((sum, item) => sum + item.charactersDeleted, 0) : 0;
  const netChange = totalAdded - totalDeleted;
  const averageNetPerDay = hasData && data.length > 0 ? (isNaN(netChange / data.length) ? '0' : (netChange / data.length).toFixed(0)) : '0';

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const added = payload.find((p: any) => p.dataKey === 'charactersAdded')?.value || 0;
      const deleted = payload.find((p: any) => p.dataKey === 'charactersDeleted')?.value || 0;
      const net = payload.find((p: any) => p.dataKey === 'netChange')?.value || 0;
      
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm">
            <span className="inline-block w-3 h-3 bg-green-500 rounded mr-2"></span>
            Added: +{added.toLocaleString()} chars
          </p>
          <p className="text-sm">
            <span className="inline-block w-3 h-3 bg-red-500 rounded mr-2"></span>
            Deleted: -{deleted.toLocaleString()} chars
          </p>
          <p className="text-sm font-medium">
            <span className="inline-block w-3 h-3 bg-blue-500 rounded mr-2"></span>
            Net: {net > 0 ? '+' : ''}{net.toLocaleString()} chars
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Content Changes</h3>
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
          <FileText className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">Content Changes</h3>
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
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Content Changes</h3>
        </div>
        <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
          <FileText className="h-12 w-12 mb-3 opacity-50" />
          <h4 className="font-medium mb-2">Historical Character Tracking Not Available</h4>
          <p className="text-sm text-center max-w-xs">
            Character change tracking is not yet implemented. 
            Data will be collected going forward once this feature is enabled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`wewrite-card ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-purple-500" />
        <h3 className="text-lg font-semibold">Content Changes</h3>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">+{totalAdded.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Chars Added</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500">-{totalDeleted.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Chars Deleted</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-bold ${netChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {netChange >= 0 ? '+' : ''}{netChange.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Net Change</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{averageNetPerDay}</div>
          <div className="text-xs text-muted-foreground">Avg Net/Day</div>
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
            <ComposedChart
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
                width={chartConfig.tickConfig.width}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: window.innerWidth < 768 ? '10px' : '12px' }}
                iconType="rect"
              />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
              <Bar
                dataKey="charactersAdded"
                fill="#22c55e"
                name="Added"
                radius={[2, 2, 0, 0]}
                maxBarSize={60}
              />
              <Bar
                dataKey="charactersDeleted"
                fill="#ef4444"
                name="Deleted"
                radius={[0, 0, 2, 2]}
                maxBarSize={60}
                // Make deleted values negative for display
                transform="scale(1, -1)"
              />
              <Line
                type="monotone"
                dataKey="netChange"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Net Change"
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No character change data available</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer with additional info */}
      {!loading && hasData && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Character additions vs deletions</span>
            <span>Total days: {data.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}