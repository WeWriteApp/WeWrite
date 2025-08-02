"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Activity, 
  Database, 
  TrendingDown, 
  TrendingUp, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import { getOptimizationStats, clearOptimizedCache } from '../../utils/readOptimizer';

interface OptimizationStats {
  totalReads: number;
  cacheHits: number;
  cacheMisses: number;
  batchedRequests: number;
  deduplicatedRequests: number;
  cacheSize: number;
  cacheHitRate: number;
  lastReset: number;
}

export default function ReadOptimizationDashboard() {
  const [stats, setStats] = useState<OptimizationStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refreshStats = async () => {
    setIsRefreshing(true);
    try {
      const currentStats = getOptimizationStats();
      setStats(currentStats);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing optimization stats:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearCache = async () => {
    try {
      clearOptimizedCache();
      await refreshStats();
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  useEffect(() => {
    refreshStats();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Read Optimization Dashboard
          </CardTitle>
          <CardDescription>Loading optimization statistics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const timeSinceReset = Date.now() - stats.lastReset;
  const minutesSinceReset = timeSinceReset / (1000 * 60);
  const readsPerMinute = stats.totalReads / minutesSinceReset;

  const getPerformanceStatus = () => {
    if (readsPerMinute > 500) return { status: 'critical', color: 'destructive', icon: AlertTriangle };
    if (readsPerMinute > 100) return { status: 'warning', color: 'warning', icon: AlertTriangle };
    return { status: 'good', color: 'success', icon: CheckCircle };
  };

  const getCacheStatus = () => {
    if (stats.cacheHitRate > 80) return { status: 'excellent', color: 'success', icon: CheckCircle };
    if (stats.cacheHitRate > 60) return { status: 'good', color: 'warning', icon: TrendingUp };
    return { status: 'poor', color: 'destructive', icon: TrendingDown };
  };

  const performanceStatus = getPerformanceStatus();
  const cacheStatus = getCacheStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Read Optimization Dashboard
              </CardTitle>
              <CardDescription>
                Monitor Firebase read optimization and caching performance
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshStats}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
              >
                Clear Cache
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reads/Minute</p>
                <p className="text-2xl font-bold">{Math.round(readsPerMinute)}</p>
              </div>
              <performanceStatus.icon className={`h-8 w-8 ${
                performanceStatus.color === 'destructive' ? 'text-red-500' :
                performanceStatus.color === 'warning' ? 'text-yellow-500' :
                'text-green-500'
              }`} />
            </div>
            <Badge variant={performanceStatus.color as any} className="mt-2">
              {performanceStatus.status.toUpperCase()}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cache Hit Rate</p>
                <p className="text-2xl font-bold">{stats.cacheHitRate.toFixed(1)}%</p>
              </div>
              <cacheStatus.icon className={`h-8 w-8 ${
                cacheStatus.color === 'destructive' ? 'text-red-500' :
                cacheStatus.color === 'warning' ? 'text-yellow-500' :
                'text-green-500'
              }`} />
            </div>
            <Badge variant={cacheStatus.color as any} className="mt-2">
              {cacheStatus.status.toUpperCase()}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Reads</p>
                <p className="text-2xl font-bold">{stats.totalReads.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Since {new Date(stats.lastReset).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cache Size</p>
                <p className="text-2xl font-bold">{stats.cacheSize}</p>
              </div>
              <Database className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Cached entries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Optimization Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Cache Hits</span>
                <span className="text-sm text-green-600">{stats.cacheHits.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Cache Misses</span>
                <span className="text-sm text-red-600">{stats.cacheMisses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Deduplicated</span>
                <span className="text-sm text-blue-600">{stats.deduplicatedRequests.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Batched Requests</span>
                <span className="text-sm text-purple-600">{stats.batchedRequests.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Monitoring Since</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(minutesSinceReset)}m ago
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Last Refresh</span>
                <span className="text-sm text-muted-foreground">
                  {lastRefresh?.toLocaleTimeString() || 'Never'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Performance Target</h4>
                <p className="text-sm text-muted-foreground">
                  Target: &lt;100 reads/minute<br/>
                  Cache hit rate: &gt;80%<br/>
                  Current: <span className={readsPerMinute > 100 ? 'text-red-600' : 'text-green-600'}>
                    {readsPerMinute > 100 ? 'OVER TARGET' : 'ON TARGET'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {(readsPerMinute > 100 || stats.cacheHitRate < 60) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Performance Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-yellow-800">
              {readsPerMinute > 100 && (
                <li>• Read rate is high ({Math.round(readsPerMinute)}/min). Consider increasing cache duration.</li>
              )}
              {stats.cacheHitRate < 60 && (
                <li>• Cache hit rate is low ({stats.cacheHitRate.toFixed(1)}%). Check for cache invalidation issues.</li>
              )}
              {stats.cacheSize > 800 && (
                <li>• Cache size is large ({stats.cacheSize} entries). Consider reducing cache duration for less critical data.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
