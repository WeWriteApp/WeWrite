"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Wallet, Users, TrendingUp, DollarSign, Target, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { useUsdAllocations } from '../../hooks/usePaymentAnalytics';
import { type DateRange } from '../../services/dashboardAnalytics';
import { type GlobalAnalyticsFilters } from './GlobalAnalyticsFilters';
import { useResponsiveChart, formatTickLabel } from '../../utils/chartUtils';
import { ErrorCard } from '../ui/ErrorCard';

interface UsdAllocationsWidgetProps {
  dateRange: DateRange;
  globalFilters: GlobalAnalyticsFilters;
  granularity?: number;
  className?: string;
}

export function UsdAllocationsWidget({ 
  dateRange, 
  globalFilters,
  granularity = 50, 
  className = "" 
}: UsdAllocationsWidgetProps) {
  const isCumulative = globalFilters.timeDisplayMode === 'cumulative';
  const { data, stats, loading, error } = useUsdAllocations(dateRange, granularity, isCumulative);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const chartConfig = useResponsiveChart(data?.length || 0, data);

  if (loading) {
    return (
      <Card className={`wewrite-card ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            USD Allocations
          </CardTitle>
          <CardDescription>User allocation patterns and distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Loading skeleton for stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center p-3 bg-muted/50 rounded-lg animate-pulse">
                  <div className="h-6 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded"></div>
                </div>
              ))}
            </div>
            {/* Loading skeleton for chart */}
            <div className="h-64 bg-muted/50 rounded-lg animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <ErrorCard 
        title="USD Allocations"
        error={error}
        className={className}
      />
    );
  }

  const hasData = data && data.length > 0;

  // Prepare pie chart data for allocation distribution
  const allocationDistribution = [
    { name: 'Page Allocations', value: stats?.totalPageAllocations || 0, color: '#3b82f6' },
    { name: 'User Allocations', value: stats?.totalUserAllocations || 0, color: '#10b981' },
    { name: 'Unallocated', value: stats?.totalUnallocated || 0, color: '#6b7280' }
  ].filter(item => item.value > 0);

  return (
    <Card className={`wewrite-card ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          USD Allocations
        </CardTitle>
        <CardDescription>
          User allocation patterns and distribution over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/50 dark:bg-muted/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <Badge variant="secondary" className="text-xs">Total</Badge>
              </div>
              <div className="text-lg font-bold text-foreground dark:text-muted-foreground">
                {formatCurrency(stats?.totalAllocated || 0)}
              </div>
              <div className="text-xs text-primary dark:text-primary">Total Allocated</div>
            </div>

            <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="h-4 w-4 text-green-600" />
                <Badge variant="secondary" className="text-xs">Active</Badge>
              </div>
              <div className="text-lg font-bold text-green-800 dark:text-green-400">
                {stats?.activeAllocators || 0}
              </div>
              <div className="text-xs text-green-600 dark:text-green-500">Active Allocators</div>
            </div>

            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="h-4 w-4 text-purple-600" />
                <Badge variant="secondary" className="text-xs">Rate</Badge>
              </div>
              <div className="text-lg font-bold text-purple-800 dark:text-purple-400">
                {formatPercentage(stats?.allocationRate || 0)}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-500">Allocation Rate</div>
            </div>

            <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Activity className="h-4 w-4 text-amber-600" />
                <Badge variant="secondary" className="text-xs">Avg</Badge>
              </div>
              <div className="text-lg font-bold text-amber-800 dark:text-amber-400">
                {formatCurrency(stats?.averageAllocation || 0)}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-500">Avg per User</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Allocation Trend Chart */}
            <div className="h-64 w-full">
              <h4 className="text-sm font-medium mb-2 text-center">Allocation Trend</h4>
              {hasData ? (
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart
                    data={data}
                    margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                      tickFormatter={formatTickLabel}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        const labels = {
                          totalAllocated: 'Total Allocated',
                          pageAllocations: 'Page Allocations',
                          userAllocations: 'User Allocations'
                        };
                        return [formatCurrency(value), labels[name as keyof typeof labels] || name];
                      }}
                      labelFormatter={(label) => `Period: ${label}`}
                    />
                    <Bar 
                      dataKey="pageAllocations" 
                      stackId="allocations"
                      fill="#3b82f6" 
                      name="Page Allocations"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar 
                      dataKey="userAllocations" 
                      stackId="allocations"
                      fill="#10b981" 
                      name="User Allocations"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No allocation data</p>
                  </div>
                </div>
              )}
            </div>

            {/* Allocation Distribution Pie Chart */}
            <div className="h-64 w-full">
              <h4 className="text-sm font-medium mb-2 text-center">Allocation Distribution</h4>
              {allocationDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie
                      data={allocationDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {allocationDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No distribution data</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Legend for Pie Chart */}
          {allocationDistribution.length > 0 && (
            <div className="flex justify-center gap-4 text-xs">
              {allocationDistribution.map((item, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.name}: {formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>USD Allocation System:</strong> This shows how users allocate their subscription funds to pages and other users. 
            Higher allocation rates indicate better user engagement and content discovery.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
