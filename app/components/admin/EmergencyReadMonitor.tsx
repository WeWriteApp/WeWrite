"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { AlertTriangle, Activity, Shield, Zap, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';

interface ReadStats {
  totalReads: number;
  hourlyReads: number;
  estimatedDailyCost: number;
  cacheHitRate: number;
  quotaStatus: {
    dailyQuota: number;
    currentUsage: number;
    percentageUsed: number;
    status: string;
  };
  topEndpoints: Array<{
    endpoint: string;
    reads: number;
    cacheHitRate: number;
  }>;
}

export default function EmergencyReadMonitor() {
  const [stats, setStats] = useState<ReadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [quotaBypassActive, setQuotaBypassActive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/monitoring/database-reads');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching read stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleQuotaBypass = async () => {
    try {
      const action = quotaBypassActive ? 'disable' : 'enable';
      const response = await fetch('/api/admin/quota-bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      if (response.ok) {
        setQuotaBypassActive(!quotaBypassActive);
        fetchStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Error toggling quota bypass:', error);
    }
  };

  const resetStats = async () => {
    try {
      await fetch('/api/monitoring/database-reads', { method: 'POST' });
      fetchStats();
    } catch (error) {
      console.error('Error resetting stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK': return 'bg-green-500';
      case 'PROJECTED_OVERAGE': return 'bg-yellow-500';
      case 'OVER_QUOTA': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK': return <Shield className="h-4 w-4" />;
      case 'PROJECTED_OVERAGE': return <AlertTriangle className="h-4 w-4" />;
      case 'OVER_QUOTA': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (loading && !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Emergency Read Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Emergency Read Monitor
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStats}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant={quotaBypassActive ? "destructive" : "secondary"}
                size="sm"
                onClick={toggleQuotaBypass}
              >
                <Shield className="h-4 w-4 mr-1" />
                {quotaBypassActive ? 'Disable' : 'Enable'} Bypass
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {stats.totalReads.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total Reads</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.hourlyReads.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Hourly Reads</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.cacheHitRate.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Cache Hit Rate</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  ${stats.estimatedDailyCost.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Est. Daily Cost</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quota Status */}
      {stats?.quotaStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(stats.quotaStatus.status)}`} />
              Quota Status
              <Badge variant={stats.quotaStatus.status === 'OK' ? 'default' : 'destructive'}>
                {stats.quotaStatus.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Usage:</span>
                <span className="font-mono">
                  {stats.quotaStatus.currentUsage.toLocaleString()} / {stats.quotaStatus.dailyQuota.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getStatusColor(stats.quotaStatus.status)}`}
                  style={{ width: `${Math.min(stats.quotaStatus.percentageUsed, 100)}%` }}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {stats.quotaStatus.percentageUsed.toFixed(1)}% of daily quota used
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Endpoints */}
      {stats?.topEndpoints && (
        <Card>
          <CardHeader>
            <CardTitle>Top Read Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topEndpoints.slice(0, 5).map((endpoint, index) => (
                <div key={endpoint.endpoint} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <code className="text-sm">{endpoint.endpoint}</code>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono">{endpoint.reads} reads</span>
                    <span className="text-muted-foreground">
                      {endpoint.cacheHitRate}% cached
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Emergency Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Emergency Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="destructive"
              onClick={resetStats}
              className="w-full"
            >
              <Zap className="h-4 w-4 mr-2" />
              Reset Statistics
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastUpdated && (
        <div className="text-xs text-muted-foreground text-center">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
