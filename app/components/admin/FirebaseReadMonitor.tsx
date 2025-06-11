"use client";

/**
 * Firebase Read Operation Monitoring Dashboard
 *
 * This component provides real-time monitoring and analytics for Firebase Firestore
 * read operations to track optimization effectiveness and cost savings.
 *
 * Features:
 * - Real-time read statistics tracking
 * - Cache performance metrics and hit rates
 * - Query performance analysis and monitoring
 * - Optimization recommendations based on usage patterns
 * - Operation breakdown by type and source
 *
 * Key Metrics Monitored:
 * - Total Firestore reads (24-hour window)
 * - Cached reads and cache hit rate (target: >80%)
 * - Average query duration and performance
 * - Error rates and optimization effectiveness
 * - Operation-specific statistics and breakdowns
 *
 * Usage:
 * Access the monitoring dashboard at `/admin/firebase-reads` to view:
 * - Real-time read statistics and trends
 * - Cache performance metrics and analysis
 * - Query performance analysis and optimization suggestions
 * - Cost optimization recommendations and insights
 *
 * The dashboard auto-refreshes every 30 seconds to provide up-to-date metrics
 * and helps ensure the Firebase optimization strategies are working effectively.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  BarChart3, 
  TrendingDown, 
  TrendingUp, 
  Database, 
  Clock, 
  Zap,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { getReadStats } from '../../firebase/optimizedSubscription';
import { getPageReadStats } from '../../firebase/optimizedPages';
import { getQueryStatsSummary } from '../../utils/queryMonitor';
import { getCacheStats } from '../../utils/cacheUtils';

interface ReadStats {
  totalReads: number;
  last24h: number;
  cachedReads: number;
  firestoreReads: number;
  cacheHitRate: number;
  operationBreakdown?: Record<string, number>;
}

interface CacheStats {
  totalItems: number;
  totalSize: number;
  itemsByPrefix: Record<string, number>;
}

interface QueryStats {
  totalQueries: number;
  averageDuration: number;
  slowestQuery: any;
  fastestQuery: any;
  errorRate: number;
}

export const FirebaseReadMonitor: React.FC = () => {
  const [subscriptionStats, setSubscriptionStats] = useState<ReadStats | null>(null);
  const [pageStats, setPageStats] = useState<ReadStats | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [queryStats, setQueryStats] = useState<QueryStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const refreshStats = async () => {
    setIsRefreshing(true);
    try {
      // Get all stats
      const subStats = getReadStats();
      const pgStats = getPageReadStats();
      const cStats = getCacheStats();
      const qStats = getQueryStatsSummary();

      setSubscriptionStats(subStats);
      setPageStats(pgStats);
      setCacheStats(cStats);
      setQueryStats(qStats);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing stats:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshStats();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalFirestoreReads = (subscriptionStats?.firestoreReads || 0) + (pageStats?.firestoreReads || 0);
  const totalCachedReads = (subscriptionStats?.cachedReads || 0) + (pageStats?.cachedReads || 0);
  const overallCacheHitRate = totalCachedReads + totalFirestoreReads > 0 
    ? (totalCachedReads / (totalCachedReads + totalFirestoreReads)) * 100 
    : 0;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCacheHitRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceColor = (duration: number) => {
    if (duration < 100) return 'text-green-600';
    if (duration < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Firebase Read Monitor</h2>
          <p className="text-gray-600">Monitor and optimize Firestore read operations</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button 
            onClick={refreshStats} 
            disabled={isRefreshing}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Firestore Reads (24h)</p>
                <p className="text-2xl font-bold">{totalFirestoreReads}</p>
              </div>
              <Database className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cached Reads (24h)</p>
                <p className="text-2xl font-bold">{totalCachedReads}</p>
              </div>
              <Zap className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cache Hit Rate</p>
                <p className={`text-2xl font-bold ${getCacheHitRateColor(overallCacheHitRate)}`}>
                  {overallCacheHitRate.toFixed(1)}%
                </p>
              </div>
              {overallCacheHitRate >= 80 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Query Time</p>
                <p className={`text-2xl font-bold ${getPerformanceColor(queryStats?.averageDuration || 0)}`}>
                  {queryStats?.averageDuration?.toFixed(0) || 0}ms
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Operations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Subscription Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptionStats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Reads:</span>
                  <Badge variant="outline">{subscriptionStats.totalReads}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Firestore Reads (24h):</span>
                  <Badge variant="destructive">{subscriptionStats.firestoreReads}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Cached Reads (24h):</span>
                  <Badge variant="secondary">{subscriptionStats.cachedReads}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Cache Hit Rate:</span>
                  <Badge 
                    variant={subscriptionStats.cacheHitRate >= 80 ? "default" : "destructive"}
                  >
                    {subscriptionStats.cacheHitRate.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Page Operations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Page Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pageStats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Reads:</span>
                  <Badge variant="outline">{pageStats.totalReads}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Firestore Reads (24h):</span>
                  <Badge variant="destructive">{pageStats.firestoreReads}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Cached Reads (24h):</span>
                  <Badge variant="secondary">{pageStats.cachedReads}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Cache Hit Rate:</span>
                  <Badge 
                    variant={pageStats.cacheHitRate >= 80 ? "default" : "destructive"}
                  >
                    {pageStats.cacheHitRate.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Cache Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cache Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cacheStats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Items:</span>
                  <Badge variant="outline">{cacheStats.totalItems}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Total Size:</span>
                  <Badge variant="outline">{formatBytes(cacheStats.totalSize)}</Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Items by Type:</p>
                  {Object.entries(cacheStats.itemsByPrefix).map(([prefix, count]) => (
                    <div key={prefix} className="flex justify-between text-sm">
                      <span className="capitalize">{prefix}:</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Query Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Query Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {queryStats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Queries:</span>
                  <Badge variant="outline">{queryStats.totalQueries}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Average Duration:</span>
                  <Badge 
                    variant={queryStats.averageDuration < 100 ? "default" : "destructive"}
                  >
                    {queryStats.averageDuration.toFixed(0)}ms
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Error Rate:</span>
                  <Badge 
                    variant={queryStats.errorRate === 0 ? "default" : "destructive"}
                  >
                    {(queryStats.errorRate * 100).toFixed(1)}%
                  </Badge>
                </div>
                {queryStats.slowestQuery && (
                  <div className="text-sm">
                    <p className="font-medium">Slowest Query:</p>
                    <p className="text-gray-600">
                      {queryStats.slowestQuery.name} - {queryStats.slowestQuery.duration.toFixed(0)}ms
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Loading...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Optimization Recommendations */}
      {overallCacheHitRate < 80 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Optimization Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-yellow-800">
              {overallCacheHitRate < 60 && (
                <p>• Cache hit rate is low ({overallCacheHitRate.toFixed(1)}%). Consider increasing cache TTL or improving cache strategies.</p>
              )}
              {totalFirestoreReads > 1000 && (
                <p>• High number of Firestore reads detected. Consider implementing more aggressive caching.</p>
              )}
              {queryStats && queryStats.averageDuration > 200 && (
                <p>• Average query duration is high ({queryStats.averageDuration.toFixed(0)}ms). Consider optimizing slow queries.</p>
              )}
              {queryStats && queryStats.errorRate > 0.05 && (
                <p>• Query error rate is elevated ({(queryStats.errorRate * 100).toFixed(1)}%). Check for connection issues or query problems.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
