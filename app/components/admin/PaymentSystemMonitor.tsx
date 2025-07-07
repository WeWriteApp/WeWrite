/**
 * Payment System Monitoring Dashboard
 * Real-time monitoring of payment processing, subscription health, and error rates
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { CopyErrorButton } from '../ui/CopyErrorButton';
import { 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign,
  RefreshCw,
  Zap,
  Users,
  Activity,
  XCircle
} from 'lucide-react';

interface PaymentMetrics {
  totalRevenue: number;
  revenueGrowth: number;
  activeSubscriptions: number;
  subscriptionGrowth: number;
  successRate: number;
  errorRate: number;
  averageTransactionValue: number;
  failedPayments: number;
  retrySuccessRate: number;
  webhookHealth: number;
}

interface PaymentAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface TransactionVolume {
  timestamp: Date;
  successful: number;
  failed: number;
  pending: number;
}

export function PaymentSystemMonitor() {
  const [metrics, setMetrics] = useState<PaymentMetrics | null>(null);
  const [alerts, setAlerts] = useState<PaymentAlert[]>([]);
  const [transactionVolume, setTransactionVolume] = useState<TransactionVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshData = async () => {
    setRefreshing(true);
    try {
      // Fetch payment metrics
      const metricsResponse = await fetch('/api/admin/payment-metrics', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.data);
      }

      // Fetch payment alerts
      const alertsResponse = await fetch('/api/admin/payment-alerts', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        // Convert timestamp strings back to Date objects
        const processedAlertsData = (alertsData.data || []).map((alert: any) => ({
          ...alert,
          timestamp: new Date(alert.timestamp)
        }));
        setAlerts(processedAlertsData);
      }

      // Fetch transaction volume data
      const volumeResponse = await fetch('/api/admin/transaction-volume', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (volumeResponse.ok) {
        const volumeData = await volumeResponse.json();
        // Convert timestamp strings back to Date objects
        const processedVolumeData = (volumeData.data || []).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        setTransactionVolume(processedVolumeData);
      }

      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Error fetching payment monitoring data:', error);

      // Add a synthetic error alert for display
      const errorAlert = {
        id: `fetch-error-${Date.now()}`,
        title: 'Data Fetch Error',
        message: `Failed to load payment monitoring data: ${error.message || 'Unknown error'}`,
        type: 'system_error',
        severity: 'critical' as const,
        timestamp: new Date(),
        resolved: false,
        metadata: {
          errorType: 'FETCH_ERROR',
          endpoint: 'payment-monitoring',
          errorMessage: error.message,
          errorStack: error.stack,
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      };

      setAlerts(prev => [errorAlert, ...prev]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
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
          <h2 className="text-2xl font-bold">Payment System Monitor</h2>
          <p className="text-muted-foreground">
            Real-time payment processing and subscription health monitoring
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
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-red-700 dark:text-red-300">
                  Critical Payment System Alerts ({alerts.filter(alert => alert.severity === 'critical' && !alert.resolved).length})
                </span>
              </div>
              <CopyErrorButton
                error={`Critical Payment System Alerts - ${new Date().toISOString()}\n\n${alerts
                  .filter(alert => alert.severity === 'critical' && !alert.resolved)
                  .map(alert => `Alert: ${alert.title}\nMessage: ${alert.message}\nType: ${alert.type}\nTimestamp: ${alert.timestamp.toISOString()}\nID: ${alert.id}\n${alert.metadata ? `Metadata: ${JSON.stringify(alert.metadata, null, 2)}` : ''}\n`)
                  .join('\n')}\nSystem Info:\nURL: ${window.location.href}\nUser Agent: ${navigator.userAgent}`}
                size="sm"
                variant="outline"
                className="text-red-700 dark:text-red-300 border-red-300"
              />
            </div>
            <div className="space-y-2">
              {alerts
                .filter(alert => alert.severity === 'critical' && !alert.resolved)
                .slice(0, 3)
                .map(alert => (
                  <div key={alert.id} className="flex items-start gap-2">
                    <span className="text-red-600 dark:text-red-400 mt-0.5">•</span>
                    <div className="flex-1">
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                        {alert.title}
                      </p>
                      <p className="text-xs text-red-500 dark:text-red-400">
                        {alert.message}
                      </p>
                      <p className="text-xs text-red-400 dark:text-red-500 mt-1">
                        {alert.type} • {alert.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              {alerts.filter(alert => alert.severity === 'critical' && !alert.resolved).length > 3 && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                  + {alerts.filter(alert => alert.severity === 'critical' && !alert.resolved).length - 3} more critical alerts
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {metrics.revenueGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={metrics.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {formatPercentage(metrics.revenueGrowth)}
                </span>
                <span>from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeSubscriptions.toLocaleString()}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {metrics.subscriptionGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={metrics.subscriptionGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {formatPercentage(metrics.subscriptionGrowth)}
                </span>
                <span>from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">
                {metrics.failedPayments} failed payments today
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Webhook Health</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.webhookHealth.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">
                Webhook processing success rate
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Monitoring Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {metrics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Success Rate</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${metrics.successRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold">{metrics.successRate.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Error Rate</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-red-500 h-2 rounded-full"
                          style={{ width: `${metrics.errorRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold">{metrics.errorRate.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Retry Success Rate</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${metrics.retrySuccessRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold">{metrics.retrySuccessRate.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Average Transaction Value</span>
                      <span className="text-sm font-bold">{formatCurrency(metrics.averageTransactionValue)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Health */}
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Webhook Processing</span>
                    <div className="flex items-center gap-2">
                      {metrics.webhookHealth >= 95 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : metrics.webhookHealth >= 90 ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-bold">{metrics.webhookHealth.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Failed Payments (24h)</span>
                    <div className="flex items-center gap-2">
                      {metrics.failedPayments === 0 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : metrics.failedPayments < 10 ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-bold">{metrics.failedPayments}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Active Alerts</span>
                    <div className="flex items-center gap-2">
                      {alerts.filter(a => !a.resolved).length === 0 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : alerts.filter(a => !a.resolved && a.severity === 'critical').length > 0 ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                      <span className="text-sm font-bold">
                        {alerts.filter(a => !a.resolved).length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Volume (Last 24 Hours)</CardTitle>
            </CardHeader>
            <CardContent>
              {transactionVolume.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {transactionVolume.reduce((sum, tv) => sum + tv.successful, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Successful</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">
                        {transactionVolume.reduce((sum, tv) => sum + tv.failed, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-600">
                        {transactionVolume.reduce((sum, tv) => sum + tv.pending, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Pending</div>
                    </div>
                  </div>

                  {/* Simple transaction volume visualization */}
                  <div className="space-y-2">
                    {transactionVolume.slice(-12).map((tv, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <span className="w-16 text-muted-foreground">
                          {tv.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="flex-1 flex gap-1">
                          <div
                            className="bg-green-500 h-4 rounded-l"
                            style={{ width: `${(tv.successful / Math.max(tv.successful + tv.failed + tv.pending, 1)) * 100}%` }}
                          />
                          <div
                            className="bg-red-500 h-4"
                            style={{ width: `${(tv.failed / Math.max(tv.successful + tv.failed + tv.pending, 1)) * 100}%` }}
                          />
                          <div
                            className="bg-yellow-500 h-4 rounded-r"
                            style={{ width: `${(tv.pending / Math.max(tv.successful + tv.failed + tv.pending, 1)) * 100}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-muted-foreground">
                          {tv.successful + tv.failed + tv.pending}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No transaction data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment System Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.slice(0, 20).map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="flex-shrink-0 mt-0.5">
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{alert.title}</span>
                          {getSeverityBadge(alert.severity)}
                          {alert.resolved && (
                            <Badge variant="outline" className="text-green-600">
                              RESOLVED
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {alert.message}
                        </p>

                        {/* Enhanced error details */}
                        <div className="text-xs text-muted-foreground space-y-1 mb-2">
                          <div><strong>Alert ID:</strong> {alert.id}</div>
                          <div><strong>Type:</strong> {alert.type}</div>
                          <div><strong>Severity:</strong> {alert.severity}</div>
                          <div><strong>Timestamp:</strong> {alert.timestamp.toLocaleString()}</div>
                          {alert.metadata && (
                            <div><strong>Details:</strong> {JSON.stringify(alert.metadata, null, 2)}</div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {alert.timestamp.toLocaleString()}
                          </span>
                          <CopyErrorButton
                            error={`Payment System Alert\n\nAlert ID: ${alert.id}\nTitle: ${alert.title}\nMessage: ${alert.message}\nType: ${alert.type}\nSeverity: ${alert.severity}\nTimestamp: ${alert.timestamp.toISOString()}\nResolved: ${alert.resolved}\n${alert.metadata ? `\nMetadata:\n${JSON.stringify(alert.metadata, null, 2)}` : ''}\n\nSystem Info:\nURL: ${window.location.href}\nUser Agent: ${navigator.userAgent}`}
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No alerts found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}