'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

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
  lastAccess: string;
  avgResponseTime: number;
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

export default function DatabaseReadsMonitoring() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/monitoring/database-reads');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const resetStats = async () => {
    try {
      const response = await fetch('/api/monitoring/database-reads', {
        method: 'POST'
      });
      if (response.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to reset stats:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Database Reads Monitoring</h1>
        <div className="text-center">Loading monitoring data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Database Reads Monitoring</h1>
        <div className="text-red-600">Error: {error}</div>
        <button 
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-muted/500 text-white rounded hover:bg-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Database Reads Monitoring</h1>
        <div>No data available</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK': return 'text-green-600';
      case 'PROJECTED_OVERAGE': return 'text-yellow-600';
      case 'OVER_QUOTA': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🚨 Database Reads Crisis Monitor</h1>
        <div className="space-x-2">
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-muted/500 text-white rounded hover:bg-primary"
          >
            Refresh
          </button>
          <button 
            onClick={resetStats}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Reset Stats
          </button>
        </div>
      </div>

      {/* Critical Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalReads.toLocaleString()}</div>
            <p className="text-xs text-gray-500">Since last reset</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Hourly Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.hourlyReads.toLocaleString()}</div>
            <p className="text-xs text-gray-500">Reads this hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.cacheHitRate.toFixed(1)}%</div>
            <p className="text-xs text-gray-500">Higher is better</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Est. Daily Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data.stats.estimatedDailyCost.toFixed(2)}</div>
            <p className="text-xs text-gray-500">Firestore reads only</p>
          </CardContent>
        </Card>
      </div>

      {/* Quota Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quota Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Daily Quota:</span>
              <span>{data.quotaStatus.dailyQuota.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Usage:</span>
              <span>{data.quotaStatus.currentUsage.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Percentage Used:</span>
              <span>{data.quotaStatus.percentageUsed.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Projected Daily:</span>
              <span>{data.quotaStatus.projectedDailyUsage.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={getStatusColor(data.quotaStatus.status)}>
                {data.quotaStatus.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
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
          </div>
        </CardContent>
      </Card>

      {/* Top Endpoints */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Top Endpoints by Read Count</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topEndpoints.map((endpoint, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{endpoint.endpoint}</div>
                  <div className="text-sm text-gray-500">
                    Cache: {endpoint.cacheHitRate}% | Avg: {endpoint.avgResponseTime}ms
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{endpoint.reads.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">reads</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🚨 Optimization Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recommendations.map((rec, index) => (
                <div key={index} className="p-2 bg-yellow-50 border-l-4 border-yellow-400">
                  {rec}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 text-xs text-gray-500">
        Last updated: {new Date(data.stats.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
}
