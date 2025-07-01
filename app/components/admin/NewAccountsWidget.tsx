"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { useAccountsMetrics } from '../../hooks/useDashboardAnalytics';
import { type DateRange } from '../../services/dashboardAnalytics';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';
import { type GlobalAnalyticsFilters } from './GlobalAnalyticsFilters';
import {
  applyGlobalAnalyticsFilters,
  calculateFilteredSummaryStats,
  getFilteredDisplayLabels,
  formatFilteredNumber,
  generateMockUserCountData
} from '../../utils/analyticsDataProcessing';

interface NewAccountsWidgetProps {
  dateRange: DateRange;
  granularity?: number;
  className?: string;
  globalFilters?: GlobalAnalyticsFilters;
}

export function NewAccountsWidget({ dateRange, granularity, className = "", globalFilters }: NewAccountsWidgetProps) {
  const { data: rawData, loading, error } = useAccountsMetrics(dateRange, granularity);

  // Debug: Log what filters we received
  console.log('🔍 NewAccountsWidget received filters:', globalFilters);

  // Debug: Check if widget is rendering at all
  if (globalFilters) {
    console.log('✅ NewAccountsWidget: Global filters are present');
  } else {
    console.log('❌ NewAccountsWidget: No global filters received');
  }

  // Apply global filters if provided
  let processedData = rawData;
  let displayLabels = { totalLabel: 'Total', averageLabel: 'Avg/Day', yAxisLabel: 'Accounts', tooltipSuffix: '' };

  if (globalFilters) {
    // Generate mock user count data for normalization
    const userCountData = generateMockUserCountData(dateRange.startDate, dateRange.endDate, granularity);

    // Apply global analytics filters
    processedData = applyGlobalAnalyticsFilters(rawData, userCountData, globalFilters);

    // Debug: Log the transformation to verify cumulative mode works
    if (globalFilters.timeDisplayMode === 'cumulative') {
      console.log('🔄 Cumulative Mode Active:', {
        mode: globalFilters.timeDisplayMode,
        rawDataSample: rawData.slice(0, 5).map(d => ({ date: d.date, count: d.count })),
        processedDataSample: processedData.slice(0, 5).map(d => ({ date: d.date, count: d.count }))
      });
    }

    // Get appropriate display labels
    displayLabels = getFilteredDisplayLabels(globalFilters);
  }

  const chartConfig = useResponsiveChart(processedData.length, processedData);

  // Calculate summary statistics using filtered data
  const summaryStats = globalFilters
    ? calculateFilteredSummaryStats(rawData, processedData, globalFilters)
    : {
        originalTotal: rawData.reduce((sum, item) => sum + item.count, 0),
        displayTotal: rawData.reduce((sum, item) => sum + item.count, 0),
        averagePerPeriod: rawData.length > 0 ? (rawData.reduce((sum, item) => sum + item.count, 0) / rawData.length) : 0,
        dataPoints: rawData.length
      };

  const totalAccounts = summaryStats.displayTotal;
  const averagePerDay = formatFilteredNumber(summaryStats.averagePerPeriod, globalFilters || { timeDisplayMode: 'overTime', perUserNormalization: false });
  
  // Calculate trend (compare first half vs second half of period) using processed data
  const midPoint = Math.floor(processedData.length / 2);
  const firstHalf = processedData.slice(0, midPoint);
  const secondHalf = processedData.slice(midPoint);

  const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, item) => sum + item.count, 0) / firstHalf.length : 0;
  const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, item) => sum + item.count, 0) / secondHalf.length : 0;

  const trendPercentage = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100) : 0;
  const isPositiveTrend = trendPercentage > 0;

  // Custom tooltip component with filter awareness
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const formattedValue = formatFilteredNumber(value, globalFilters || { timeDisplayMode: 'overTime', perUserNormalization: false });

      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-primary">
            {formattedValue} account{Math.round(value) !== 1 ? 's' : ''}{displayLabels.tooltipSuffix}
          </p>
          {globalFilters?.perUserNormalization && payload[0].payload.activeUsers && (
            <p className="text-xs text-muted-foreground">
              {payload[0].payload.activeUsers} active users
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
          <Users className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">New Accounts Created</h3>
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
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">New Accounts Created</h3>
        </div>
        
        {/* Summary Stats */}
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">
            {formatFilteredNumber(totalAccounts, globalFilters || { timeDisplayMode: 'overTime', perUserNormalization: false })}
          </div>
          <div className="text-xs text-muted-foreground">
            {averagePerDay} {displayLabels.averageLabel.toLowerCase()}
          </div>
          {globalFilters?.perUserNormalization && (
            <div className="text-xs text-muted-foreground mt-1">
              {formatFilteredNumber(summaryStats.originalTotal, { timeDisplayMode: 'overTime', perUserNormalization: false })} total
            </div>
          )}
        </div>
      </div>

      {/* Trend Indicator */}
      {!loading && processedData.length > 1 && (
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
        ) : processedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No data available for selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={processedData}
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
                allowDecimals={globalFilters?.perUserNormalization || false}
                width={chartConfig.tickConfig.width}
                label={{
                  value: displayLabels.yAxisLabel,
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: '10px', fill: 'currentColor' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[2, 2, 0, 0]}
                className="hover:opacity-80 transition-opacity"
                maxBarSize={60}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer with additional info */}
      {!loading && processedData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Peak: {formatFilteredNumber(Math.max(...processedData.map(d => d.count)), globalFilters || { timeDisplayMode: 'overTime', perUserNormalization: false })} accounts{displayLabels.tooltipSuffix}</span>
            <span>Total periods: {processedData.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}