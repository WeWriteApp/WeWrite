"use client";

import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { FileText, TrendingUp, TrendingDown, Plus, Minus } from 'lucide-react';
import { useCompositePagesMetrics, useTotalPagesEverCreated } from '../../hooks/useDashboardAnalytics';
import { type DateRange } from '../../services/dashboardAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';
import { ErrorCard } from '../ui/ErrorCard';

interface NewPagesWidgetProps {
  dateRange: DateRange;
  granularity?: number;
  className?: string;
}

export function NewPagesWidget({ dateRange, granularity, className = "" }: NewPagesWidgetProps) {
  const { data, loading, error } = useCompositePagesMetrics(dateRange, granularity);
  const { data: totalPagesEverCreated, loading: totalLoading } = useTotalPagesEverCreated();
  const chartConfig = useResponsiveChart(data.length, data);

  // Transform data for chart display (make deleted values negative)
  const chartData = data.map(item => ({
    ...item,
    pagesDeletedNegative: -(item.pagesDeleted || 0)
  }));

  // Calculate summary statistics for composite data
  const totalPagesCreated = data.reduce((sum, item) => sum + (item.pagesCreated || 0), 0);
  const totalPagesDeleted = data.reduce((sum, item) => sum + (item.pagesDeleted || 0), 0);
  const totalPublicPagesCreated = data.reduce((sum, item) => sum + (item.publicPagesCreated || 0), 0);
  const totalPrivatePagesCreated = data.reduce((sum, item) => sum + (item.privatePagesCreated || 0), 0);
  const netChange = totalPagesCreated - totalPagesDeleted;
  const averageCreatedPerDay = data.length > 0 ? (totalPagesCreated / data.length).toFixed(1) : '0';
  const averageDeletedPerDay = data.length > 0 ? (totalPagesDeleted / data.length).toFixed(1) : '0';

  // Calculate trend (compare first half vs second half of period)
  const midPoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midPoint);
  const secondHalf = data.slice(midPoint);

  const firstHalfNet = firstHalf.reduce((sum, item) => sum + (item.netChange || 0), 0);
  const secondHalfNet = secondHalf.reduce((sum, item) => sum + (item.netChange || 0), 0);

  const trendPercentage = firstHalfNet !== 0 ? ((secondHalfNet - firstHalfNet) / Math.abs(firstHalfNet) * 100) : 0;
  const isPositiveTrend = trendPercentage > 0;

  // Check if we have the new composite data structure
  const hasBreakdown = data.length > 0 && data[0].hasOwnProperty('publicPagesCreated');

  // Custom tooltip component for composite data
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const created = data.pagesCreated || 0;
      const deleted = data.pagesDeleted || 0;
      const netChange = data.netChange || 0;

      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Plus className="h-3 w-3 text-green-500" />
              <span className="text-green-600">{created} created</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Minus className="h-3 w-3 text-red-500" />
              <span className="text-red-600">{deleted} deleted</span>
            </div>
            <div className="pt-1 border-t border-border">
              <p className="text-sm font-medium">
                Net: {netChange > 0 ? '+' : ''}{netChange} page{Math.abs(netChange) !== 1 ? 's' : ''}
              </p>
            </div>
            {hasBreakdown && (
              <div className="text-xs space-y-1 pt-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm bg-blue-500"></div>
                  <span>{data.publicPagesCreated || 0} pages created</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm bg-purple-500"></div>
                  <span>{data.privatePagesCreated || 0} private created</span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (error) {
    return (
      <ErrorCard
        title="Error loading Pages Analytics"
        message="Unable to load pages created and deleted data."
        error={error}
        className={className}
        onRetry={() => window.location.reload()}
        retryLabel="Refresh Page"
      />
    );
  }

  return (
    <div className={`wewrite-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Pages Created & Deleted</h3>
        </div>

        {/* Summary Stats */}
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">
            {netChange > 0 ? '+' : ''}{netChange}
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2 justify-end">
              <Plus className="h-3 w-3 text-green-500" />
              <span className="text-green-600">{totalPagesCreated} created</span>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Minus className="h-3 w-3 text-red-500" />
              <span className="text-red-600">{totalPagesDeleted} deleted</span>
            </div>
            {!totalLoading && (
              <div className="pt-1 border-t border-border">
                <span className="font-medium">{totalPagesEverCreated} total ever</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trend Indicator */}
      {!loading && data.length > 1 && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          {isPositiveTrend ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span className={isPositiveTrend ? 'text-green-500' : 'text-red-500'}>
            {isNaN(trendPercentage) ? '0.0' : Math.abs(trendPercentage).toFixed(1)}% {isPositiveTrend ? 'increase' : 'decrease'}
          </span>
          <span className="text-muted-foreground">vs previous period</span>
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
            <ComposedChart
              data={chartData}
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
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="2 2" />

              {/* Pages Created (positive bars) */}
              {hasBreakdown ? (
                <>
                  <Bar
                    dataKey="publicPagesCreated"
                    stackId="created"
                    fill="#22c55e"
                    radius={[0, 0, 0, 0]}
                    className="hover:opacity-80 transition-opacity"
                    maxBarSize={60}
                  />
                  <Bar
                    dataKey="privatePagesCreated"
                    stackId="created"
                    fill="#16a34a"
                    radius={[2, 2, 0, 0]}
                    className="hover:opacity-80 transition-opacity"
                    maxBarSize={60}
                  />
                </>
              ) : (
                <Bar
                  dataKey="pagesCreated"
                  fill="#22c55e"
                  radius={[2, 2, 0, 0]}
                  className="hover:opacity-80 transition-opacity"
                  maxBarSize={60}
                />
              )}

              {/* Pages Deleted (negative bars) */}
              <Bar
                dataKey="pagesDeletedNegative"
                fill="#ef4444"
                radius={[0, 0, 2, 2]}
                className="hover:opacity-80 transition-opacity"
                maxBarSize={60}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer with additional info */}
      {!loading && data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Peak created: {Math.max(...data.map(d => d.pagesCreated || 0))} pages</span>
            <span>Peak deleted: {Math.max(...data.map(d => d.pagesDeleted || 0))} pages</span>
          </div>
          <div className="mt-2 flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-green-500"></div>
              <span>Pages Created</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-red-500"></div>
              <span>Pages Deleted</span>
            </div>
            {hasBreakdown && (
              <>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-green-600"></div>
                  <span>Public Created</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-green-700"></div>
                  <span>Private Created</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}