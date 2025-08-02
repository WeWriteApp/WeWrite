'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  Database, 
  TrendingDown, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Zap,
  BarChart3
} from 'lucide-react';

interface OptimizationStats {
  timestamp: string;
  status: string;
  summary: {
    totalCaches: number;
    dailyReads: number;
    dailyWrites: number;
    readUtilization: number;
    writeUtilization: number;
  };
  alerts: Array<{
    level: string;
    message: string;
    action: string;
  }>;
  quickActions: Array<{
    id: string;
    label: string;
    type: string;
  }>;
}

interface CostAnalysis {
  current: {
    dailyReads: number;
    dailyWrites: number;
    date: string;
  };
  projections: {
    monthlyReads: number;
    monthlyWrites: number;
    estimatedMonthlyCost: number;
  };
  optimizationPotential: {
    readSavingsPotential: number;
    writeSavingsPotential: number;
    overallPotential: number;
    estimatedMonthlySavings: number;
  };
}

export default function FirestoreOptimizationDashboard() {
  const [stats, setStats] = useState<OptimizationStats | null>(null);
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch overview stats
      const statsResponse = await fetch('/api/admin/firestore-optimization');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch cost analysis
      const costResponse = await fetch('/api/admin/firestore-optimization?action=cost-analysis');
      if (costResponse.ok) {
        const costData = await costResponse.json();
        setCostAnalysis(costData);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching optimization data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const executeAction = async (actionId: string) => {
    try {
      const response = await fetch('/api/admin/firestore-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionId })
      });

      if (response.ok) {
        // Refresh data after action
        await fetchData();
      }
    } catch (error) {
      console.error('Error executing action:', error);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !stats) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Firestore Optimization Dashboard</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent className="animate-pulse">
                <div className="h-8 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Firestore Optimization Dashboard</h2>
          <Badge variant={stats?.status === 'healthy' ? 'default' : 'destructive'}>
            {stats?.status || 'Unknown'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {stats?.alerts && stats.alerts.length > 0 && (
        <div className="space-y-2">
          {stats.alerts.map((alert, index) => (
            <div 
              key={index}
              className={`p-4 rounded-lg border ${
                alert.level === 'error' 
                  ? 'bg-destructive/10 border-destructive' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                  alert.level === 'error' ? 'text-destructive' : 'text-yellow-600'
                }`} />
                <div>
                  <p className="font-medium">{alert.message}</p>
                  <p className="text-sm text-muted-foreground">{alert.action}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Reads</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary.dailyReads || 0}</div>
            <Progress 
              value={stats?.summary.readUtilization || 0} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(stats?.summary.readUtilization || 0)}% of threshold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Writes</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary.dailyWrites || 0}</div>
            <Progress 
              value={stats?.summary.writeUtilization || 0} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(stats?.summary.writeUtilization || 0)}% of threshold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Caches</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary.totalCaches || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Optimization layers active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${costAnalysis?.projections.estimatedMonthlyCost?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Projected for this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Analysis */}
      {costAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>Cost Optimization Analysis</CardTitle>
            <CardDescription>
              Potential savings and optimization opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium mb-2">Read Optimization</h4>
                <div className="text-2xl font-bold text-green-600">
                  {costAnalysis.optimizationPotential.readSavingsPotential}%
                </div>
                <p className="text-sm text-muted-foreground">
                  Potential read reduction
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Write Optimization</h4>
                <div className="text-2xl font-bold text-blue-600">
                  {costAnalysis.optimizationPotential.writeSavingsPotential}%
                </div>
                <p className="text-sm text-muted-foreground">
                  Potential write reduction
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Monthly Savings</h4>
                <div className="text-2xl font-bold text-purple-600">
                  ${costAnalysis.optimizationPotential.estimatedMonthlySavings?.toFixed(2)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Estimated savings potential
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {stats?.quickActions && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common optimization tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.quickActions.map((action) => (
                <Button
                  key={action.id}
                  variant={action.type === 'warning' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => executeAction(action.id)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
