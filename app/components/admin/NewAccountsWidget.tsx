"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { useAccountsMetrics } from '../../hooks/useDashboardAnalytics';
import { type DateRange } from '../../services/dashboardAnalytics';

interface NewAccountsWidgetProps {
  dateRange: DateRange;
  className?: string;
}

export function NewAccountsWidget({ dateRange, className = "" }: NewAccountsWidgetProps) {
  const { data, loading, error } = useAccountsMetrics(dateRange);



  // Calculate summary statistics
  const totalAccounts = data.reduce((sum, item) => sum + item.count, 0);
  const averagePerDay = data.length > 0 ? (totalAccounts / data.length).toFixed(1) : '0';
  
  // Calculate trend (compare first half vs second half of period)
  const midPoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midPoint);
  const secondHalf = data.slice(midPoint);
  
  const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, item) => sum + item.count, 0) / firstHalf.length : 0;
  const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, item) => sum + item.count, 0) / secondHalf.length : 0;
  
  const trendPercentage = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100) : 0;
  const isPositiveTrend = trendPercentage > 0;

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-primary">
            {payload[0].value} new account{payload[0].value !== 1 ? 's' : ''}
          </p>
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
          <div className="text-2xl font-bold text-primary">{totalAccounts}</div>
          <div className="text-xs text-muted-foreground">
            {averagePerDay}/day avg
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
              margin={{
                top: 5,
                right: window.innerWidth < 768 ? 10 : 30,
                left: window.innerWidth < 768 ? 10 : 20,
                bottom: 5
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }}
                interval={window.innerWidth < 768 ? 'preserveStartEnd' : 0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }}
                allowDecimals={false}
                width={window.innerWidth < 768 ? 30 : 40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[2, 2, 0, 0]}
                className="hover:opacity-80 transition-opacity"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer with additional info */}
      {!loading && data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Peak: {Math.max(...data.map(d => d.count))} accounts</span>
            <span>Total days: {data.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
