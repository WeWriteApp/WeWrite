"use client";

/**
 * Database Read Optimization Dashboard
 * 
 * Comprehensive monitoring and control panel for database read optimization.
 * Provides real-time analysis, alerts, and manual controls.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Settings,
  Zap
} from 'lucide-react';

interface ReadAnalysis {
  totalReads: number;
  readsPerMinute: number;
  topOffenders: Array<{
    endpoint: string;
    totalReads: number;
    frequency: number;
    cacheHitRate: number;
    suspiciousActivity: boolean;
    recommendations: string[];
  }>;
  suspiciousPatterns: any[];
  costEstimate: number;
  recommendations: string[];
  timestamp: number;
}

interface OptimizationStatus {
  isActive: boolean;
  circuitBreakers: Array<{
    endpoint: string;
    isOpen: boolean;
    nextAttempt: number;
  }>;
  rateLimiters: number;
  rules: Array<{
    name: string;
    priority: string;
    description: string;
  }>;
}

export function DatabaseReadOptimizationDashboard() {
  const [analysis, setAnalysis] = useState<ReadAnalysis | null>(null);
  const [optimizationStatus, setOptimizationStatus] = useState<OptimizationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch analysis data
  const fetchAnalysis = async () => {
    try {
      setIsLoading(true);
      
      const [analysisResponse, statusResponse] = await Promise.all([
        fetch('/api/monitoring/database-reads?action=analyze'),
        fetch('/api/monitoring/optimization-status')
      ]);

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        setAnalysis(analysisData.analysis);
      }

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setOptimizationStatus(statusData.status);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching optimization data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchAnalysis();
    
    if (autoRefresh) {
      const interval = setInterval(fetchAnalysis, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Manual optimization trigger
  const triggerOptimization = async () => {
    try {
      const response = await fetch('/api/monitoring/optimize', { method: 'POST' });
      if (response.ok) {
        console.log('Manual optimization triggered');
        setTimeout(fetchAnalysis, 2000); // Refresh after 2 seconds
      }
    } catch (error) {
      console.error('Error triggering optimization:', error);
    }
  };

  // Reset optimizations
  const resetOptimizations = async () => {
    try {
      const response = await fetch('/api/monitoring/reset-optimization', { method: 'POST' });
      if (response.ok) {
        console.log('Optimizations reset');
        fetchAnalysis();
      }
    } catch (error) {
      console.error('Error resetting optimizations:', error);
    }
  };

  // Get status color based on reads per minute
  const getStatusColor = (readsPerMinute: number) => {
    if (readsPerMinute > 2000) return 'destructive';
    if (readsPerMinute > 1000) return 'warning';
    if (readsPerMinute > 500) return 'secondary';
    return 'default';
  };

  // Get status icon
  const getStatusIcon = (readsPerMinute: number) => {
    if (readsPerMinute > 2000) return <XCircle className="h-4 w-4" />;
    if (readsPerMinute > 1000) return <AlertTriangle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  if (isLoading && !analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Database Read Optimization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading optimization data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Database Read Optimization Dashboard
              </CardTitle>
              <CardDescription>
                Real-time monitoring and optimization of database read operations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? 'Disable' : 'Enable'} Auto-refresh
              </Button>
              <Button variant="outline" size="sm" onClick={fetchAnalysis}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Status Overview */}
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reads/Minute</p>
                  <p className="text-2xl font-bold">{analysis.readsPerMinute.toFixed(1)}</p>
                </div>
                <Badge variant={getStatusColor(analysis.readsPerMinute)}>
                  {getStatusIcon(analysis.readsPerMinute)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Reads</p>
                  <p className="text-2xl font-bold">{analysis.totalReads.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cost Estimate</p>
                  <p className="text-2xl font-bold">${analysis.costEstimate.toFixed(4)}</p>
                </div>
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Suspicious Patterns</p>
                  <p className="text-2xl font-bold">{analysis.suspiciousPatterns.length}</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts */}
      {analysis && analysis.readsPerMinute > 1000 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>High Read Volume Detected!</strong> Current rate: {analysis.readsPerMinute.toFixed(1)} reads/minute. 
            Consider triggering emergency optimization.
          </AlertDescription>
        </Alert>
      )}

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Optimization Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={triggerOptimization} className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Trigger Optimization
            </Button>
            <Button variant="outline" onClick={resetOptimizations}>
              Reset Optimizations
            </Button>
            {lastUpdated && (
              <span className="text-sm text-muted-foreground">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Offenders */}
      {analysis && analysis.topOffenders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Read-Heavy Endpoints</CardTitle>
            <CardDescription>
              Endpoints generating the most database reads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysis.topOffenders.slice(0, 5).map((offender, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {offender.endpoint}
                      </code>
                      {offender.suspiciousActivity && (
                        <Badge variant="destructive">Suspicious</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {offender.totalReads} reads • {offender.frequency.toFixed(1)}/min • 
                      {offender.cacheHitRate.toFixed(1)}% cache hit rate
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {offender.frequency.toFixed(1)} reads/min
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {analysis && analysis.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Optimization Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-muted rounded">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-500" />
                  <span className="text-sm">{recommendation}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Circuit Breakers Status */}
      {optimizationStatus && optimizationStatus.circuitBreakers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Circuit Breakers</CardTitle>
            <CardDescription>
              Endpoints currently protected by circuit breakers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {optimizationStatus.circuitBreakers.map((breaker, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <code className="text-sm">{breaker.endpoint}</code>
                  <div className="flex items-center gap-2">
                    <Badge variant={breaker.isOpen ? "destructive" : "default"}>
                      {breaker.isOpen ? "Open" : "Closed"}
                    </Badge>
                    {breaker.isOpen && (
                      <span className="text-xs text-muted-foreground">
                        Reset: {new Date(breaker.nextAttempt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
