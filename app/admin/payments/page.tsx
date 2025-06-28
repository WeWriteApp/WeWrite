"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from "../../providers/AuthProvider";
import { Button } from '../../components/ui/button';
import { ChevronLeft, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { isAdmin } from "../../utils/isAdmin";
import { PaymentSystemMonitor } from "../../components/admin/PaymentSystemMonitor";
import { PayoutSystemMonitor } from "../../components/admin/PayoutSystemMonitor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

interface SystemHealthStatus {
  payments: 'healthy' | 'warning' | 'critical';
  payouts: 'healthy' | 'warning' | 'critical';
  webhooks: 'healthy' | 'warning' | 'critical';
  overall: 'healthy' | 'warning' | 'critical';
}

export default function PaymentsAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<SystemHealthStatus>({
    payments: 'healthy',
    payouts: 'healthy',
    webhooks: 'healthy',
    overall: 'healthy'
  });
  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);

  useEffect(() => {
    if (user && !isAdmin(user)) {
      router.push('/');
      return;
    }
    
    if (user) {
      setLoading(false);
      checkSystemHealth();
    }
  }, [user, router]);

  const checkSystemHealth = async () => {
    try {
      // Check payment system health
      const paymentHealthResponse = await fetch('/api/admin/payment-metrics');
      const paymentHealth = paymentHealthResponse.ok ? 'healthy' : 'critical';

      // Check payout system health
      const payoutHealthResponse = await fetch('/api/admin/payout-metrics');
      const payoutHealth = payoutHealthResponse.ok ? 'healthy' : 'critical';

      // Check webhook health
      const webhookHealthResponse = await fetch('/api/admin/webhook-validation');
      const webhookHealth = webhookHealthResponse.ok ? 'healthy' : 'critical';

      // Determine overall health
      const statuses = [paymentHealth, payoutHealth, webhookHealth];
      const overall = statuses.includes('critical') ? 'critical' : 
                     statuses.includes('warning') ? 'warning' : 'healthy';

      setSystemHealth({
        payments: paymentHealth,
        payouts: payoutHealth,
        webhooks: webhookHealth,
        overall
      });

      setLastHealthCheck(new Date());
    } catch (error) {
      console.error('Error checking system health:', error);
      setSystemHealth({
        payments: 'critical',
        payouts: 'critical',
        webhooks: 'critical',
        overall: 'critical'
      });
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getHealthBadge = (status: string) => {
    const variants = {
      healthy: 'default',
      warning: 'secondary',
      critical: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isAdmin(user)) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin')}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Payment & Payout Systems</h1>
            <p className="text-muted-foreground">
              Real-time monitoring and management of financial operations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastHealthCheck && (
            <span className="text-sm text-muted-foreground">
              Last check: {lastHealthCheck.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={checkSystemHealth}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Health
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getHealthIcon(systemHealth.overall)}
            System Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">Overall Status</div>
                <div className="text-sm text-muted-foreground">System-wide health</div>
              </div>
              <div className="flex items-center gap-2">
                {getHealthIcon(systemHealth.overall)}
                {getHealthBadge(systemHealth.overall)}
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">Payment Processing</div>
                <div className="text-sm text-muted-foreground">Subscriptions & billing</div>
              </div>
              <div className="flex items-center gap-2">
                {getHealthIcon(systemHealth.payments)}
                {getHealthBadge(systemHealth.payments)}
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">Payout System</div>
                <div className="text-sm text-muted-foreground">Creator earnings</div>
              </div>
              <div className="flex items-center gap-2">
                {getHealthIcon(systemHealth.payouts)}
                {getHealthBadge(systemHealth.payouts)}
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">Webhook Processing</div>
                <div className="text-sm text-muted-foreground">Stripe integration</div>
              </div>
              <div className="flex items-center gap-2">
                {getHealthIcon(systemHealth.webhooks)}
                {getHealthBadge(systemHealth.webhooks)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts Banner */}
      {systemHealth.overall === 'critical' && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="font-semibold text-red-700 dark:text-red-300">
                Critical System Issues Detected
              </span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400">
              One or more payment/payout systems are experiencing critical issues. 
              Immediate attention required to prevent service disruption.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Monitoring Dashboards */}
      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="payments">Payment System</TabsTrigger>
          <TabsTrigger value="payouts">Payout System</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
          <PaymentSystemMonitor />
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <PayoutSystemMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
