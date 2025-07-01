"use client";

/**
 * Security Monitoring Dashboard
 * 
 * Comprehensive security monitoring interface that provides real-time visibility
 * into fraud detection, compliance status, audit trails, and security metrics.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  Eye, 
  Users, 
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface SecurityMetrics {
  fraudDetection: {
    totalAlerts: number;
    activeAlerts: number;
    riskScore: number;
    detectionRate: number;
    falsePositiveRate: number;
  };
  compliance: {
    overallScore: number;
    kycCompliance: number;
    gdprCompliance: number;
    pciCompliance: number;
    pendingReviews: number;
  };
  auditTrail: {
    totalEvents: number;
    last24Hours: number;
    integrityScore: number;
    retentionCompliance: number;
  };
  userSecurity: {
    totalUsers: number;
    verifiedUsers: number;
    suspendedUsers: number;
    flaggedUsers: number;
  };
}

interface SecurityAlert {
  id: string;
  type: 'fraud' | 'compliance' | 'audit' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  status: 'open' | 'investigating' | 'resolved';
  userId?: string;
}

export function SecurityMonitoringDashboard() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const refreshData = async () => {
    setRefreshing(true);
    try {
      // Fetch security metrics
      const metricsResponse = await fetch('/api/admin/security-metrics', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.data);
      }

      // Fetch security alerts
      const alertsResponse = await fetch('/api/admin/security-alerts', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.data || []);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing security data:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'investigating': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'open': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const exportSecurityReport = async () => {
    try {
      const response = await fetch('/api/admin/security-report', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generateReport',
          config: {
            title: 'Security Monitoring Report',
            description: 'Comprehensive security status report',
            includeMetrics: true,
            includeAlerts: true,
            format: 'pdf'
          }
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-report-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting security report:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Security Monitoring</h1>
          <p className="text-gray-600 mt-1">
            Real-time security metrics and threat monitoring
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={refreshData}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={exportSecurityReport}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Last Refresh Indicator */}
      {lastRefresh && (
        <div className="text-sm text-gray-500">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>
      )}

      {/* Security Overview Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Fraud Detection Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fraud Detection</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.fraudDetection.activeAlerts}</div>
              <p className="text-xs text-muted-foreground">
                Active alerts ({metrics.fraudDetection.totalAlerts} total)
              </p>
              <div className="mt-2">
                <Badge variant={metrics.fraudDetection.riskScore > 70 ? 'destructive' : 'secondary'}>
                  Risk Score: {metrics.fraudDetection.riskScore}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.compliance.overallScore}%</div>
              <p className="text-xs text-muted-foreground">
                Overall compliance score
              </p>
              <div className="mt-2">
                <Badge variant={metrics.compliance.pendingReviews > 0 ? 'destructive' : 'secondary'}>
                  {metrics.compliance.pendingReviews} pending reviews
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Audit Trail Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Audit Trail</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.auditTrail.last24Hours}</div>
              <p className="text-xs text-muted-foreground">
                Events in last 24h ({metrics.auditTrail.totalEvents} total)
              </p>
              <div className="mt-2">
                <Badge variant={metrics.auditTrail.integrityScore === 100 ? 'secondary' : 'destructive'}>
                  Integrity: {metrics.auditTrail.integrityScore}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* User Security Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">User Security</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.userSecurity.verifiedUsers}</div>
              <p className="text-xs text-muted-foreground">
                Verified users ({metrics.userSecurity.totalUsers} total)
              </p>
              <div className="mt-2">
                <Badge variant={metrics.userSecurity.flaggedUsers > 0 ? 'destructive' : 'secondary'}>
                  {metrics.userSecurity.flaggedUsers} flagged
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Status Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {metrics?.fraudDetection.detectionRate || 0}%
                    </div>
                    <div className="text-sm text-gray-600">Fraud Detection Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {metrics?.compliance.overallScore || 0}%
                    </div>
                    <div className="text-sm text-gray-600">Compliance Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {metrics?.auditTrail.integrityScore || 0}%
                    </div>
                    <div className="text-sm text-gray-600">Audit Integrity</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No security alerts at this time
                  </div>
                ) : (
                  alerts.slice(0, 10).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(alert.status)}
                        <div>
                          <div className="font-medium">{alert.title}</div>
                          <div className="text-sm text-gray-600">{alert.description}</div>
                          <div className="text-xs text-gray-500">
                            {alert.timestamp.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline">{alert.type}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Framework Status</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold">{metrics.compliance.kycCompliance}%</div>
                      <div className="text-sm text-gray-600">KYC/AML Compliance</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold">{metrics.compliance.gdprCompliance}%</div>
                      <div className="text-sm text-gray-600">GDPR Compliance</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold">{metrics.compliance.pciCompliance}%</div>
                      <div className="text-sm text-gray-600">PCI DSS Compliance</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold">{metrics.auditTrail.totalEvents}</div>
                      <div className="text-sm text-gray-600">Total Audit Events</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold">{metrics.auditTrail.retentionCompliance}%</div>
                      <div className="text-sm text-gray-600">Retention Compliance</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}