"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Database, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  DollarSign,
  Activity
} from 'lucide-react';

interface ReadStats {
  totalReads: number;
  hourlyReads: number;
  estimatedDailyCost: number;
  cacheHitRate: number;
  lastUpdated: string;
}

interface EndpointStats {
  endpoint: string;
  reads: number;
  cacheHitRate: number;
}

interface QuotaStatus {
  dailyQuota: number;
  currentUsage: number;
  percentageUsed: number;
  projectedDailyUsage: number;
  status: 'OK' | 'PROJECTED_OVERAGE' | 'OVER_QUOTA';
}

interface MonitoringData {
  stats: ReadStats;
  topEndpoints: EndpointStats[];
  recommendations: string[];
  quotaStatus: QuotaStatus;
}

/**
 * 🚨 CRITICAL DATABASE READS MONITORING WIDGET
 * 
 * Integrated into existing admin dashboard to monitor the 9.2M read overage crisis
 */
export function DatabaseReadsWidget() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/monitoring/database-reads');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      setData(result);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 🚨 EMERGENCY: Disable auto-refresh to stop 13K reads/min crisis
    // const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    // return () => clearInterval(interval);
    console.warn('🚨 EMERGENCY: DatabaseReadsWidget auto-refresh disabled to stop database read crisis');
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK': return 'bg-green-100 text-green-800';
      case 'PROJECTED_OVERAGE': return 'bg-yellow-100 text-yellow-800';
      case 'OVER_QUOTA': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK': return <CheckCircle className="h-4 w-4" />;
      case 'PROJECTED_OVERAGE': return <AlertTriangle className="h-4 w-4" />;
      case 'OVER_QUOTA': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            🚨 Database Reads Crisis Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading monitoring data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            🚨 Database Reads Crisis Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 mb-4">Error: {error}</div>
          <Button onClick={fetchData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            🚨 Database Reads Crisis Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>No monitoring data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            🚨 Database Reads Crisis Monitor
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(data.quotaStatus.status)}>
              {getStatusIcon(data.quotaStatus.status)}
              {data.quotaStatus.status.replace('_', ' ')}
            </Badge>
            <Button onClick={fetchData} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Critical Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {data.stats.totalReads.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Total Reads</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {data.stats.hourlyReads.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Hourly Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {data.stats.cacheHitRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">Cache Hit Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              ${data.stats.estimatedDailyCost.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">Est. Daily Cost</div>
          </div>
        </div>

        {/* Quota Status */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">Quota Status</span>
            <Badge className={getStatusColor(data.quotaStatus.status)}>
              {data.quotaStatus.percentageUsed.toFixed(1)}% used
            </Badge>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                data.quotaStatus.status === 'OVER_QUOTA' ? 'bg-red-500' :
                data.quotaStatus.status === 'PROJECTED_OVERAGE' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(data.quotaStatus.percentageUsed, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.quotaStatus.currentUsage.toLocaleString()} / {data.quotaStatus.dailyQuota.toLocaleString()} reads
            {data.quotaStatus.projectedDailyUsage > data.quotaStatus.dailyQuota && (
              <span className="text-red-600 ml-2">
                (Projected: {data.quotaStatus.projectedDailyUsage.toLocaleString()})
              </span>
            )}
          </div>
        </div>

        {/* Top Problematic Endpoints */}
        {data.topEndpoints.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Top Read-Heavy Endpoints</h4>
            <div className="space-y-1">
              {data.topEndpoints.slice(0, 3).map((endpoint, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <div className="truncate flex-1">
                    <span className="font-mono text-xs">{endpoint.endpoint}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge variant="outline" className="text-xs">
                      {endpoint.reads.toLocaleString()}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${endpoint.cacheHitRate < 50 ? 'text-red-600' : 'text-green-600'}`}
                    >
                      {endpoint.cacheHitRate}% cache
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Critical Recommendations */}
        {data.recommendations.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 text-red-600">🚨 Critical Actions Needed</h4>
            <div className="space-y-1">
              {data.recommendations.slice(0, 2).map((rec, index) => (
                <div key={index} className="text-xs p-2 bg-red-50 border-l-2 border-red-400 text-red-700">
                  {rec}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 text-center">
          Last updated: {new Date(data.stats.lastUpdated).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
