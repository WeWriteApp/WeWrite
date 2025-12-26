'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface PayoutAdminData {
  payouts: any[];
  recipients: Record<string, any>;
  stats: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    totalAmount: number;
    averageAmount: number;
  };
  pagination: {
    hasMore: boolean;
    lastPayoutId: string | null;
  };
}

interface MonitoringData {
  health: {
    status: 'healthy' | 'warning' | 'critical';
    metrics: any;
    activeAlerts: any[];
  };
  stuckPayouts: any[];
  recentFailures: {
    total: number;
    byReason: Record<string, any>;
    recent: any[];
  };
  processingDelays: {
    average: number;
    median: number;
    p95: number;
    count: number;
  };
}

export default function PayoutAdminDashboard() {
  const [payoutData, setPayoutData] = useState<PayoutAdminData | null>(null);
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    recipientId: '',
    sortBy: 'scheduledAt',
    sortOrder: 'desc'
  });

  useEffect(() => {
    loadPayoutData();
    loadMonitoringData();
  }, [filters]);

  const loadPayoutData = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.recipientId) params.append('recipientId', filters.recipientId);
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder);
      params.append('pageSize', '50');

      const response = await fetch(`/api/admin/payouts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPayoutData(data.data);
      }
    } catch (error) {
      console.error('Error loading payout data:', error);
    }
  };

  const loadMonitoringData = async () => {
    try {
      const response = await fetch('/api/admin/payouts/monitoring');
      if (response.ok) {
        const data = await response.json();
        setMonitoringData(data.data);
      }
    } catch (error) {
      console.error('Error loading monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayoutAction = async (action: string, payoutId: string, reason?: string) => {
    try {
      const response = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payoutId, reason })
      });

      if (response.ok) {
        await loadPayoutData();
        await loadMonitoringData();
      } else {
        const error = await response.json();
        alert(`Action failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Error performing action:', error);
      alert('Action failed');
    }
  };

  const handleBulkAction = async (action: string, reason?: string) => {
    if (selectedPayouts.length === 0) {
      alert('Please select payouts first');
      return;
    }

    try {
      const response = await fetch('/api/admin/payouts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: `bulk_${action}`, 
          payoutIds: selectedPayouts, 
          reason 
        })
      });

      if (response.ok) {
        setSelectedPayouts([]);
        await loadPayoutData();
        await loadMonitoringData();
      } else {
        const error = await response.json();
        alert(`Bulk action failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
      alert('Bulk action failed');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      processing: 'default',
      completed: 'success',
      failed: 'destructive',
      cancelled: 'outline'
    };

    const icons = {
      pending: Clock,
      processing: RefreshCw,
      completed: CheckCircle,
      failed: XCircle,
      cancelled: AlertTriangle
    };

    const Icon = icons[status] || Clock;
    
    return (
      <Badge variant={variants[status] || 'secondary'} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon name="Loader" size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Payout Administration</h1>
        <div className="flex gap-2">
          <Button onClick={loadMonitoringData} variant="secondary" size="sm">
            <Icon name="RefreshCw" size={16} className="mr-2" />
            Refresh
          </Button>
          <Button variant="secondary" size="sm">
            <Icon name="Download" size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      {monitoringData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {monitoringData.health.status === 'healthy' && (
                  <Icon name="CheckCircle" size={20} className="text-green-600" />
                )}
                {monitoringData.health.status === 'warning' && (
                  <Icon name="AlertTriangle" size={20} className="text-yellow-600" />
                )}
                {monitoringData.health.status === 'critical' && (
                  <Icon name="AlertCircle" size={20} className="text-red-600" />
                )}
                <span className="capitalize font-medium">
                  {monitoringData.health.status}
                </span>
              </div>
              {monitoringData.health.activeAlerts.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {monitoringData.health.activeAlerts.length} active alerts
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stuck Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {monitoringData.stuckPayouts.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Processing &gt; 24h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recent Failures</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {monitoringData.recentFailures.total}
              </div>
              <p className="text-xs text-muted-foreground">
                Last 24 hours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {monitoringData.processingDelays.average.toFixed(1)}h
              </div>
              <p className="text-xs text-muted-foreground">
                P95: {monitoringData.processingDelays.p95.toFixed(1)}h
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Statistics Overview */}
      {payoutData && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payoutData.stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(payoutData.stats.totalAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {payoutData.stats.pending}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {payoutData.stats.processing}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {payoutData.stats.completed}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {payoutData.stats.failed}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">
                {payoutData.stats.cancelled}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border rounded-md"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <input
              type="text"
              placeholder="Recipient ID"
              value={filters.recipientId}
              onChange={(e) => setFilters({ ...filters, recipientId: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />

            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              className="px-3 py-2 border rounded-md"
            >
              <option value="scheduledAt">Scheduled Date</option>
              <option value="amount">Amount</option>
              <option value="status">Status</option>
            </select>

            <select
              value={filters.sortOrder}
              onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value })}
              className="px-3 py-2 border rounded-md"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          {selectedPayouts.length > 0 && (
            <div className="flex gap-2 mb-4 p-3 bg-muted/50 rounded-md">
              <span className="text-sm font-medium">
                {selectedPayouts.length} payouts selected
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleBulkAction('retry', 'Admin bulk retry')}
              >
                Bulk Retry
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleBulkAction('cancel', 'Admin bulk cancellation')}
              >
                Bulk Cancel
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedPayouts([])}
              >
                Clear Selection
              </Button>
            </div>
          )}

          {/* Payout List */}
          <div className="space-y-2">
            {payoutData?.payouts.map((payout) => (
              <div
                key={payout.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedPayouts.includes(payout.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPayouts([...selectedPayouts, payout.id]);
                      } else {
                        setSelectedPayouts(selectedPayouts.filter(id => id !== payout.id));
                      }
                    }}
                  />
                  
                  <div>
                    <div className="font-medium">{payout.id}</div>
                    <div className="text-sm text-gray-600">
                      Recipient: {payout.recipientId}
                    </div>
                    {payout.failureReason && (
                      <div className="text-sm text-red-600">
                        {payout.failureReason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(payout.amount)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(payout.scheduledAt?.seconds * 1000).toLocaleDateString()}
                    </div>
                  </div>

                  {getStatusBadge(payout.status)}

                  <div className="flex gap-1">
                    {payout.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handlePayoutAction('retry', payout.id, 'Admin manual retry')}
                      >
                        Retry
                      </Button>
                    )}
                    
                    {(payout.status === 'pending' || payout.status === 'processing') && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handlePayoutAction('cancel', payout.id, 'Admin cancellation')}
                      >
                        Cancel
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const note = prompt('Add admin note:');
                        if (note) {
                          handlePayoutAction('add_note', payout.id, note);
                        }
                      }}
                    >
                      Note
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
