"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { usePagesMetrics } from '../../hooks/useDashboardAnalytics';
import { type DateRange } from '../../services/dashboardAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';

interface NewPagesWidgetProps {
  dateRange: DateRange;
  granularity?: number;
  className?: string;
}

export function NewPagesWidget({ dateRange, granularity, className = "" }: NewPagesWidgetProps) {
  const { data, loading, error } = usePagesMetrics(dateRange, granularity);
  const chartConfig = useResponsiveChart(data.length, data);



  // Calculate summary statistics with public/private breakdown
  const totalPages = data.reduce((sum, item) => sum + (item.totalPages || item.count || 0), 0);
  const totalPublicPages = data.reduce((sum, item) => sum + (item.publicPages || 0), 0);
  const totalPrivatePages = data.reduce((sum, item) => sum + (item.privatePages || 0), 0);
  const averagePerDay = data.length > 0 ? (totalPages / data.length).toFixed(1) : '0';

  // Calculate trend (compare first half vs second half of period)
  const midPoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midPoint);
  const secondHalf = data.slice(midPoint);

  const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, item) => sum + (item.totalPages || item.count || 0), 0) / firstHalf.length : 0;
  const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, item) => sum + (item.totalPages || item.count || 0), 0) / secondHalf.length : 0;

  const trendPercentage = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100) : 0;
  const isPositiveTrend = trendPercentage > 0;

  // Check if we have the new data structure with public/private breakdown
  const hasBreakdown = data.length > 0 && data[0].hasOwnProperty('publicPages');

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = data.totalPages || data.count || 0;

      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          {hasBreakdown ? (
            <div className="space-y-1">
              <p className="text-sm text-primary font-medium">
                {total} total page{total !== 1 ? 's' : ''}
              </p>
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
                  <span>{data.publicPages || 0} public</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-purple-500"></div>
                  <span>{data.privatePages || 0} private</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-primary">
              {total} new page{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (error) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">New Pages Created</h3>
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
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">New Pages Created</h3>
        </div>
        
        {/* Summary Stats */}
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{totalPages}</div>
          {hasBreakdown ? (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2 justify-end">
                <div className="w-2 h-2 rounded-sm bg-blue-500"></div>
                <span>{totalPublicPages} public</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <div className="w-2 h-2 rounded-sm bg-purple-500"></div>
                <span>{totalPrivatePages} private</span>
              </div>
              <div>{averagePerDay}/day avg</div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              {averagePerDay}/day avg
            </div>
          )}
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
            {Math.abs(trendPercentage).toFixed(1)}% {isPositiveTrend ? 'increase' : 'decrease'}
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
              {hasBreakdown ? (
                <>
                  <Bar
                    dataKey="publicPages"
                    stackId="pages"
                    fill="#3b82f6"
                    radius={[0, 0, 0, 0]}
                    className="hover:opacity-80 transition-opacity"
                  />
                  <Bar
                    dataKey="privatePages"
                    stackId="pages"
                    fill="#8b5cf6"
                    radius={[2, 2, 0, 0]}
                    className="hover:opacity-80 transition-opacity"
                  />
                </>
              ) : (
                <Bar
                  dataKey="count"
                  fill="hsl(var(--primary))"
                  radius={[2, 2, 0, 0]}
                  className="hover:opacity-80 transition-opacity"
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer with additional info */}
      {!loading && data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Peak: {Math.max(...data.map(d => d.totalPages || d.count || 0))} pages</span>
            <span>Total days: {data.length}</span>
          </div>
          {hasBreakdown && (
            <div className="mt-2 flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-blue-500"></div>
                <span>Public Pages</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-purple-500"></div>
                <span>Private Pages</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
