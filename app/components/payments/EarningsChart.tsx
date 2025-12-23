"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Icon } from '@/components/ui/Icon';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { WriterTokenEarnings } from '../../types/database';
import { formatCurrency } from '../../utils/formatCurrency';

interface EarningsChartProps {
  earnings: WriterTokenEarnings[];
  className?: string;
}

interface ChartDataPoint {
  month: string;
  shortMonth: string;
  earnings: number;
  tokens: number;
  status: string;
}

export default function EarningsChart({ earnings, className }: EarningsChartProps) {
  const chartData = useMemo(() => {
    if (!earnings || earnings.length === 0) return [];

    // Sort earnings by month and create chart data
    const sortedEarnings = [...earnings].sort((a, b) => {
      return new Date(a.month + '-01').getTime() - new Date(b.month + '-01').getTime();
    });

    return sortedEarnings.map((earning) => {
      const date = new Date(earning.month + '-01');
      const shortMonth = date.toLocaleDateString('en-US', { month: 'short' });
      
      return {
        month: earning.month,
        shortMonth,
        earnings: earning.totalUsdValue,
        tokens: earning.totalTokensReceived,
        status: earning.status
      };
    });
  }, [earnings]);

  const totalEarnings = useMemo(() => {
    return chartData.reduce((sum, data) => sum + data.earnings, 0);
  }, [chartData]);

  const averageEarnings = useMemo(() => {
    return chartData.length > 0 ? totalEarnings / chartData.length : 0;
  }, [totalEarnings, chartData.length]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return 'neutral';
    
    const recent = chartData.slice(-2);
    const [previous, current] = recent;
    
    if (current.earnings > previous.earnings) return 'up';
    if (current.earnings < previous.earnings) return 'down';
    return 'neutral';
  }, [chartData]);

  const trendPercentage = useMemo(() => {
    if (chartData.length < 2) return 0;
    
    const recent = chartData.slice(-2);
    const [previous, current] = recent;
    
    if (previous.earnings === 0) return current.earnings > 0 ? 100 : 0;
    
    return ((current.earnings - previous.earnings) / previous.earnings) * 100;
  }, [chartData]);

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <Icon name="TrendingUp" size={16} className="text-green-600" />;
      case 'down':
        return <Icon name="TrendingDown" size={16} className="text-red-600" />;
      default:
        return <Icon name="Minus" size={16} className="text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  if (!chartData || chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="TrendingUp" size={20} />
            Earnings Over Time
          </CardTitle>
          <CardDescription>
            Track your earnings growth month by month
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            No earnings data available yet. Start creating content to see your earnings grow!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon name="TrendingUp" size={20} />
              Earnings Over Time
            </CardTitle>
            <CardDescription>
              Track your earnings growth month by month
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatCurrency(totalEarnings)}</div>
            <div className="flex items-center gap-1 text-sm">
              {getTrendIcon()}
              <span className={getTrendColor()}>
                {isNaN(trendPercentage) ? '0.0' : Math.abs(trendPercentage).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-lg font-semibold">{formatCurrency(totalEarnings)}</div>
              <div className="text-sm text-muted-foreground">Total Earnings</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{formatCurrency(averageEarnings)}</div>
              <div className="text-sm text-muted-foreground">Average per Month</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{chartData.length}</div>
              <div className="text-sm text-muted-foreground">Months Active</div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="shortMonth" 
                  axisLine={false}
                  tickLine={false}
                  className="text-xs"
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  className="text-xs"
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as ChartDataPoint;
                      return (
                        <div className="bg-background border-theme-strong rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{data.month}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(data.earnings)} ({data.tokens} tokens)
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            Status: {data.status}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#earningsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}