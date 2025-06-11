"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useFeatureFlag } from '../../utils/feature-flags';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '../ui/use-toast';
import { realPledgeService } from '../../services/realPledgeService';
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Settings,
  Download,
  RefreshCw
} from 'lucide-react';

interface EarningsBreakdown {
  totalEarnings: number;
  platformFees: number;
  netEarnings: number;
  pendingAmount: number;
  availableAmount: number;
  lastPayoutAmount?: number;
  lastPayoutDate?: string;
  nextPayoutDate?: string;
  earningsBySource: {
    pledges: number;
    subscriptions: number;
    bonuses: number;
  };
}

interface PayoutSetup {
  recipient: any;
  accountStatus: any;
  earnings: EarningsBreakdown;
}

export default function PayoutDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email, user?.uid);

  const [setup, setSetup] = useState<PayoutSetup | null>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [userEarnings, setUserEarnings] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (user && isPaymentsEnabled) {
      loadPayoutData();
    }
  }, [user, isPaymentsEnabled]);

  const loadPayoutData = async () => {
    try {
      setLoading(true);

      if (!user?.uid) return;

      // Load payout setup
      const setupResponse = await fetch('/api/payouts/setup');
      if (setupResponse.ok) {
        const setupData = await setupResponse.json();
        setSetup(setupData.data);
      }

      // Load real user earnings data
      const realUserEarnings = await realPledgeService.getUserEarnings(user.uid);
      setUserEarnings(realUserEarnings);

      // Load real transaction data as recipient (earnings)
      const realEarningsTransactions = await realPledgeService.getUserTransactions(user.uid, true);
      setEarnings(realEarningsTransactions);

      // Load real transaction data as pledger (for reference)
      const realPledgeTransactions = await realPledgeService.getUserTransactions(user.uid, false);
      setRecentTransactions(realPledgeTransactions);

      // Load payout history from API
      const earningsResponse = await fetch('/api/payouts/earnings');
      if (earningsResponse.ok) {
        const earningsData = await earningsResponse.json();
        setPayouts(earningsData.data.payouts || []);
      }

    } catch (error) {
      console.error('Error loading payout data:', error);
      toast({
        title: "Error",
        description: "Failed to load payout data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const requestPayout = async () => {
    try {
      setRequesting(true);
      
      const response = await fetch('/api/payouts/earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_payout' })
      });
      
      if (response.ok) {
        toast({
          title: "Payout Requested",
          description: "Your payout has been scheduled for processing",
        });
        loadPayoutData();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
      
    } catch (error: any) {
      toast({
        title: "Request Failed",
        description: error.message || "Failed to request payout",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      processing: 'default',
      completed: 'default',
      failed: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (!isPaymentsEnabled) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4">Loading payout dashboard...</p>
      </div>
    );
  }

  if (!setup?.recipient) {
    return (
      <div className="text-center py-6">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Payouts Not Set Up</h3>
        <p className="text-muted-foreground mb-4">
          Connect your bank account to start receiving payments from supporters.
        </p>
        <Button onClick={() => window.location.href = '/settings/payouts'}>
          Set Up Payouts
        </Button>
      </div>
    );
  }

  // Use real earnings data or fallback to setup data
  const earnings_breakdown = userEarnings ? {
    availableAmount: userEarnings.availableBalance || 0,
    pendingAmount: userEarnings.pendingBalance || 0,
    totalEarnings: userEarnings.totalEarnings || 0,
    platformFees: userEarnings.totalPlatformFees || 0,
    netEarnings: (userEarnings.totalEarnings || 0) - (userEarnings.totalPlatformFees || 0),
    lastPayoutAmount: payouts.length > 0 ? payouts[0].amount : 0,
    lastPayoutDate: payouts.length > 0 ? payouts[0].completedAt : null,
    nextPayoutDate: '2024-02-01', // Calculate based on schedule
    earningsBySource: {
      pledges: userEarnings.totalEarnings || 0,
      subscriptions: 0,
      bonuses: 0
    }
  } : setup?.earnings || {
    availableAmount: 0,
    pendingAmount: 0,
    totalEarnings: 0,
    platformFees: 0,
    netEarnings: 0,
    lastPayoutAmount: 0,
    earningsBySource: { pledges: 0, subscriptions: 0, bonuses: 0 }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Available</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(earnings_breakdown.availableAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">
              {formatCurrency(earnings_breakdown.pendingAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Total Earned</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(earnings_breakdown.totalEarnings)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">Last Payout</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {earnings_breakdown.lastPayoutAmount
                ? formatCurrency(earnings_breakdown.lastPayoutAmount)
                : '$0.00'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account Status & Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payout Account</CardTitle>
              <CardDescription>
                {setup.accountStatus.canReceivePayouts 
                  ? 'Your account is ready to receive payouts'
                  : 'Account setup required to receive payouts'
                }
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadPayoutData}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button
                onClick={requestPayout}
                disabled={requesting || earnings_breakdown.availableAmount < 25}
                size="sm"
              >
                {requesting ? 'Processing...' : 'Request Payout'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {setup.accountStatus.canReceivePayouts ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              <div>
                <p className="font-medium">
                  {setup.accountStatus.canReceivePayouts ? 'Verified' : 'Pending Verification'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Minimum payout: $25.00
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-1" />
              Manage Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Tables */}
      <Tabs defaultValue="earnings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="earnings">Recent Earnings</TabsTrigger>
          <TabsTrigger value="payouts">Payout History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="earnings">
          <Card>
            <CardHeader>
              <CardTitle>Recent Earnings</CardTitle>
              <CardDescription>
                Your latest earnings from pledges and subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {earnings.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No earnings yet
                </div>
              ) : (
                <div className="space-y-3">
                  {earnings.map((earning) => (
                    <div key={earning.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">
                            {earning.pageId ? 'Page Pledge' : earning.groupId ? 'Group Pledge' : 'Payment'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            pledge
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(earning.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(earning.netAmount)}</p>
                        <p className="text-xs text-muted-foreground">
                          Fee: {formatCurrency(earning.platformFee)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle>Payout History</CardTitle>
              <CardDescription>
                Track your completed and pending payouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No payouts yet
                </div>
              ) : (
                <div className="space-y-3">
                  {payouts.map((payout) => (
                    <div key={payout.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">
                            {new Date(payout.scheduledAt).toLocaleDateString()}
                          </span>
                          {getStatusBadge(payout.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Period: {payout.period}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(payout.amount)}</p>
                        {payout.completedAt && (
                          <p className="text-xs text-muted-foreground">
                            Completed: {new Date(payout.completedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
