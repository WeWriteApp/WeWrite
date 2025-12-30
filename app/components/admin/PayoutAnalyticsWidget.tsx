"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { usePayoutAnalytics } from '../../hooks/usePaymentAnalytics';
import { type DateRange } from '../../services/adminAnalytics';
import { type GlobalAnalyticsFilters } from './GlobalAnalyticsFilters';
import { formatCurrency } from '../../utils/formatCurrency';
import { ErrorCard } from '../ui/ErrorCard';

interface PayoutAnalyticsWidgetProps {
  dateRange: DateRange;
  globalFilters: GlobalAnalyticsFilters;
  className?: string;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-medium">{label}</p>
        <div className="space-y-1 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-muted/500 rounded-full"></div>
            <span className="text-sm">Payouts: {formatCurrency(data.payouts)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm">Count: {data.payoutCount}</span>
          </div>
          {data.averagePayoutAmount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-sm">Avg: {formatCurrency(data.averagePayoutAmount)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function PayoutAnalyticsWidget({ dateRange, globalFilters, className = '' }: PayoutAnalyticsWidgetProps) {
  const cumulative = globalFilters.timeDisplayMode === 'cumulative';
  const { data, metadata, loading, error } = usePayoutAnalytics(dateRange, cumulative);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="TrendingUp" size={20} />
            Payout Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <ErrorCard 
        title="Payout Analytics Error"
        message={error}
        className={className}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="TrendingUp" size={20} />
            Payout Analytics
          </CardTitle>
          <CardDescription>
            {cumulative ? 'All-time payout trends' : 'Payout trends for selected period'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No payout data available for the selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary statistics
  const totalPayouts = metadata?.totalPayouts || 0;
  const totalPayoutCount = metadata?.totalPayoutCount || 0;
  const averagePayoutAmount = totalPayoutCount > 0 ? totalPayouts / totalPayoutCount : 0;
  
  // Get latest data point for trend indicators
  const latestDataPoint = data[data.length - 1];
  const previousDataPoint = data[data.length - 2];
  
  let payoutTrend = 0;
  if (previousDataPoint && latestDataPoint && !cumulative) {
    payoutTrend = latestDataPoint.payouts - previousDataPoint.payouts;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="TrendingUp" size={20} />
          Payout Analytics
        </CardTitle>
        <CardDescription>
          {cumulative ? 'All-time payout trends' : 'Payout trends for selected period'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="DollarSign" size={16} className="text-green-600" />
                <span className="text-sm font-medium">Total Payouts</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalPayouts)}
              </div>
              {!cumulative && payoutTrend !== 0 && (
                <div className="flex items-center gap-1">
                  {payoutTrend > 0 ? (
                    <Icon name="TrendingUp" size={12} className="text-green-500" />
                  ) : (
                    <Icon name="TrendingUp" size={12} className="text-red-500 rotate-180" />
                  )}
                  <span className={`text-xs ${payoutTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(payoutTrend))} vs previous period
                  </span>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="Users" size={16} className="text-primary" />
                <span className="text-sm font-medium">Payout Count</span>
              </div>
              <div className="text-2xl font-bold text-primary">
                {totalPayoutCount.toLocaleString()}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="Activity" size={16} className="text-purple-600" />
                <span className="text-sm font-medium">Average Payout</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(averagePayoutAmount)}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                {cumulative ? 'Cumulative Payouts Over Time' : 'Payouts by Period'}
              </h4>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {metadata?.granularity || 'auto'} granularity
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {data.length} data points
                </Badge>
              </div>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {cumulative ? (
                  <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="payoutGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="payouts"
                      stroke="#3b82f6"
                      fill="url(#payoutGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="payouts"
                      fill="#3b82f6"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
