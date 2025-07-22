'use client';

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { AlertTriangle, CheckCircle, Monitor, Trash2, RefreshCw } from 'lucide-react';
import { useCurrentAccount } from '../../hooks/useAuth';

interface MonitoringReport {
  timestamp: string;
  totalCustomersScanned: number;
  customersWithIssues: number;
  issueBreakdown: {
    multipleActive: number;
    multipleTotal: number;
    orphanedSubscriptions: number;
  };
  recommendations: string[];
}

interface CleanupSummary {
  totalCustomersProcessed: number;
  totalSubscriptionsCancelled: number;
  customersWithMultipleSubscriptions: number;
  errors: string[];
}

export default function SubscriptionManagement() {
  const { user } = useAuth();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [monitoringReport, setMonitoringReport] = useState<MonitoringReport | null>(null);
  const [cleanupResult, setCleanupResult] = useState<{ summary: CleanupSummary; dryRun: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runMonitoring = async () => {
    if (!user) return;
    
    setIsMonitoring(true);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/subscription-monitor?maxCustomers=100', {
        headers: {
          'Authorization': `Bearer ${token}`}});

      if (!response.ok) {
        throw new Error(`Monitoring failed: ${response.statusText}`);
      }

      const data = await response.json();
      setMonitoringReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Monitoring failed');
    } finally {
      setIsMonitoring(false);
    }
  };

  const runCleanup = async (dryRun: boolean = true) => {
    if (!user) return;
    
    setIsCleaningUp(true);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/subscription-cleanup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'},
        body: JSON.stringify({
          dryRun,
          maxCustomers: 50,
          includeStatuses: ['canceled', 'incomplete', 'past_due', 'unpaid']
        })});

      if (!response.ok) {
        throw new Error(`Cleanup failed: ${response.statusText}`);
      }

      const data = await response.json();
      setCleanupResult({ summary: data.summary, dryRun });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup failed');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const getSeverityBadge = (count: number, type: 'critical' | 'warning' | 'info') => {
    if (count === 0) return null;
    
    const variants = {
      critical: 'destructive',
      warning: 'secondary',
      info: 'outline'
    } as const;

    return <Badge variant={variants[type]}>{count}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Subscription Management</h2>
        <div className="flex gap-2">
          <Button 
            onClick={runMonitoring} 
            disabled={isMonitoring}
            variant="outline"
          >
            <Monitor className="w-4 h-4 mr-2" />
            {isMonitoring ? 'Scanning...' : 'Run Monitor'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monitoring Results */}
      {monitoringReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Monitoring Report
            </CardTitle>
            <CardDescription>
              Scanned {monitoringReport.totalCustomersScanned} customers at {new Date(monitoringReport.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{monitoringReport.customersWithIssues}</div>
                <div className="text-sm text-gray-600">Issues Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold flex items-center justify-center gap-2">
                  {monitoringReport.issueBreakdown.multipleActive}
                  {getSeverityBadge(monitoringReport.issueBreakdown.multipleActive, 'critical')}
                </div>
                <div className="text-sm text-gray-600">Multiple Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold flex items-center justify-center gap-2">
                  {monitoringReport.issueBreakdown.multipleTotal}
                  {getSeverityBadge(monitoringReport.issueBreakdown.multipleTotal, 'warning')}
                </div>
                <div className="text-sm text-gray-600">Multiple Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold flex items-center justify-center gap-2">
                  {monitoringReport.issueBreakdown.orphanedSubscriptions}
                  {getSeverityBadge(monitoringReport.issueBreakdown.orphanedSubscriptions, 'info')}
                </div>
                <div className="text-sm text-gray-600">Orphaned</div>
              </div>
            </div>

            {monitoringReport.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Recommendations:</h4>
                <ul className="space-y-1">
                  {monitoringReport.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {monitoringReport.customersWithIssues > 0 && (
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  onClick={() => runCleanup(true)} 
                  disabled={isCleaningUp}
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Preview Cleanup
                </Button>
                <Button 
                  onClick={() => runCleanup(false)} 
                  disabled={isCleaningUp}
                  variant="destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Execute Cleanup
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cleanup Results */}
      {cleanupResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {cleanupResult.dryRun ? <RefreshCw className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
              Cleanup {cleanupResult.dryRun ? 'Preview' : 'Results'}
            </CardTitle>
            <CardDescription>
              {cleanupResult.dryRun ? 'Preview of changes (no actual modifications made)' : 'Cleanup has been executed'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{cleanupResult.summary.totalCustomersProcessed}</div>
                <div className="text-sm text-gray-600">Customers Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{cleanupResult.summary.customersWithMultipleSubscriptions}</div>
                <div className="text-sm text-gray-600">Had Multiple Subs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{cleanupResult.summary.totalSubscriptionsCancelled}</div>
                <div className="text-sm text-gray-600">{cleanupResult.dryRun ? 'Would Cancel' : 'Cancelled'}</div>
              </div>
            </div>

            {cleanupResult.summary.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-red-600">Errors:</h4>
                <ul className="space-y-1">
                  {cleanupResult.summary.errors.map((error, index) => (
                    <li key={index} className="text-sm text-red-600 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cleanupResult.dryRun && cleanupResult.summary.totalSubscriptionsCancelled > 0 && (
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  onClick={() => runCleanup(false)} 
                  disabled={isCleaningUp}
                  variant="destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Execute This Cleanup
                </Button>
              </div>
            )}

            {!cleanupResult.dryRun && (
              <div className="flex items-center gap-2 text-green-600 pt-4 border-t">
                <CheckCircle className="w-4 h-4" />
                <span>Cleanup completed successfully</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common subscription management tasks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={() => runCleanup(true)} 
              disabled={isCleaningUp}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start"
            >
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-4 h-4" />
                <span className="font-semibold">Preview Cleanup</span>
              </div>
              <span className="text-sm text-gray-600 text-left">
                See what subscriptions would be cleaned up without making changes
              </span>
            </Button>

            <Button 
              onClick={runMonitoring} 
              disabled={isMonitoring}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start"
            >
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-4 h-4" />
                <span className="font-semibold">Health Check</span>
              </div>
              <span className="text-sm text-gray-600 text-left">
                Scan for subscription issues and get recommendations
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}