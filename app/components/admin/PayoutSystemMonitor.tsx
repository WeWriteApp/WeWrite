/**
 * Payout System Monitoring Dashboard
 * Real-time monitoring of creator payouts, earnings distribution, and Stripe Connect health
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign,
  RefreshCw,
  Users,
  Activity,
  XCircle,
  Calendar,
  Zap
} from 'lucide-react';

interface PayoutMetrics {
  totalPayouts: number;
  payoutGrowth: number;
  activeCreators: number;
  creatorGrowth: number;
  successRate: number;
  errorRate: number;
  averagePayoutAmount: number;
  pendingPayouts: number;
  failedPayouts: number;
  stripeConnectHealth: number;
  totalEarningsDistributed: number;
  nextPayoutDate: string;
}

interface PayoutAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  payoutId?: string;
  creatorId?: string;
}

interface PayoutQueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalAmount: number;
}

export function PayoutSystemMonitor() {
  const [metrics, setMetrics] = useState<PayoutMetrics | null>(null);
  const [alerts, setAlerts] = useState<PayoutAlert[]>([]);
  const [queueStatus, setQueueStatus] = useState<PayoutQueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshData = async () => {
    setRefreshing(true);
    try {
      // Fetch payout metrics
      const metricsResponse = await fetch('/api/admin/payout-metrics', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.data);
      }

      // Fetch payout alerts
      const alertsResponse = await fetch('/api/admin/payout-alerts', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.data || []);
      }

      // Fetch queue status
      const queueResponse = await fetch('/api/admin/payout-queue-status', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (queueResponse.ok) {
        const queueData = await queueResponse.json();
        setQueueStatus(queueData.data);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching payout monitoring data:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();

    // 🚨 EMERGENCY: Disable auto-refresh to stop 13K reads/min crisis
    // const interval = setInterval(refreshData, 60000);
    // return () => clearInterval(interval);
    console.warn('🚨 EMERGENCY: PayoutSystemMonitor auto-refresh disabled to stop database read crisis');
  }, []);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      low: 'secondary',
      medium: 'default',
      high: 'destructive',
      critical: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[severity as keyof typeof variants] || 'default'}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0}).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payout System Monitor</h2>
          <p className="text-muted-foreground">
            Real-time creator earnings and payout processing monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={refreshData}
            disabled={refreshing}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {alerts.filter(alert => alert.severity === 'critical' && !alert.resolved).length > 0 && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="font-semibold text-red-700 dark:text-red-300">
                Critical Payout System Alerts
              </span>
            </div>
            <div className="space-y-1">
              {alerts
                .filter(alert => alert.severity === 'critical' && !alert.resolved)
                .slice(0, 3)
                .map(alert => (
                  <p key={alert.id} className="text-sm text-red-600 dark:text-red-400">
                    • {alert.title}: {alert.message}
                  </p>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Distributed</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalEarningsDistributed)}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {metrics.payoutGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={metrics.payoutGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {formatPercentage(metrics.payoutGrowth)}
                </span>
                <span>from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Creators</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeCreators.toLocaleString()}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {metrics.creatorGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={metrics.creatorGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {formatPercentage(metrics.creatorGrowth)}
                </span>
                <span>from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payout Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">
                {metrics.failedPayouts} failed payouts this month
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Date(metrics.nextPayoutDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics.pendingPayouts} payouts pending
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}