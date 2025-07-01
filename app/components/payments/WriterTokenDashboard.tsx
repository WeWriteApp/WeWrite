"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

import {
  DollarSign,
  TrendingUp,
  Calendar,
  Wallet,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download
} from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { TokenEarningsService } from '../../services/tokenEarningsService';
import { WriterTokenBalance, WriterTokenEarnings } from '../../types/database';
import { formatCurrency } from '../../utils/formatCurrency';
import EarningsChart from './EarningsChart';
import { CompactAllocationTimer } from '../AllocationCountdownTimer';
import { getLoggedOutTokenBalance } from '../../utils/simulatedTokens';

interface WriterTokenDashboardProps {
  className?: string;
}

export default function WriterTokenDashboard({ className }: WriterTokenDashboardProps) {
  const { session } = useCurrentAccount();
  const { toast } = useToast();
  
  const [balance, setBalance] = useState<WriterTokenBalance | null>(null);
  const [earnings, setEarnings] = useState<WriterTokenEarnings[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  // Fake token data for different user states
  const [fakeTokenData, setFakeTokenData] = useState({
    notLoggedIn: 0,
    noSubscription: 0,
    pendingThisMonth: 0,
    lockedInLastMonth: 0
  });

  useEffect(() => {
    if (session?.uid) {
      loadWriterData();
    }
    loadFakeTokenData();
  }, [session?.uid]);

  const loadFakeTokenData = () => {
    // Get logged-out user allocations
    const loggedOutBalance = getLoggedOutTokenBalance();
    const notLoggedInTokens = loggedOutBalance.allocations.reduce((total, allocation) => {
      // For demo purposes, we'll assume some allocations are for this writer
      return total + (Math.random() > 0.7 ? allocation.tokens : 0);
    }, 0);

    // Get logged-in users without subscription allocations
    // This would normally come from a service, but for demo we'll simulate
    const noSubscriptionTokens = Math.floor(Math.random() * 50);

    // Simulate pending and locked-in tokens
    const pendingThisMonth = Math.floor(Math.random() * 30);
    const lockedInLastMonth = Math.floor(Math.random() * 80);

    setFakeTokenData({
      notLoggedIn: Math.floor(notLoggedInTokens),
      noSubscription: noSubscriptionTokens,
      pendingThisMonth,
      lockedInLastMonth
    });
  };

  const loadWriterData = async () => {
    if (!session?.uid) return;

    try {
      setLoading(true);

      const [balanceData, earningsData] = await Promise.all([
        TokenEarningsService.getWriterTokenBalance(session.uid),
        TokenEarningsService.getWriterEarningsHistory(session.uid, 6)
      ]);

      setBalance(balanceData);
      setEarnings(earningsData);

    } catch (error) {
      console.error('[WriterTokenDashboard] Error loading writer data:', error);
      toast({
        title: "Error",
        description: "Failed to load earnings data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!session?.uid || !balance) return;
    
    try {
      setRequesting(true);
      
      const result = await TokenEarningsService.requestPayout(session.uid);
      
      if (result.success) {
        toast({
          title: "Payout Requested",
          description: "Your payout request has been submitted successfully!"});
        loadWriterData(); // Refresh data
      } else {
        toast({
          title: "Request Failed",
          description: result.error || "Failed to request payout",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('Error requesting payout:', error);
      toast({
        title: "Error",
        description: "An error occurred while requesting payout",
        variant: "destructive"
      });
    } finally {
      setRequesting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      available: { label: 'Available', variant: 'default' as const },
      paid_out: { label: 'Paid Out', variant: 'outline' as const },
      processing: { label: 'Processing', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'default' as const },
      failed: { label: 'Failed', variant: 'destructive' as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading earnings data...</span>
        </CardContent>
      </Card>
    );
  }

  if (!balance) {
    return (
      <Card className={className}>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <DollarSign className="h-5 w-5" />
            Writer Earnings
          </CardTitle>
          <CardDescription>
            You haven't received any token allocations yet
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-4">
            When users allocate tokens to your pages, your earnings will appear here.
            Create great content to start earning!
          </p>
        </CardContent>
      </Card>
    );
  }

  const minimumThreshold = 25;
  const canRequestPayout = balance.availableUsdValue >= minimumThreshold;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Earnings Chart */}
      <EarningsChart earnings={earnings} />

      {/* Balance Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Token Earnings
                <Badge variant="secondary" className="ml-2 text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Estimated
                </Badge>
              </CardTitle>
              <CardDescription>
                Estimated earnings from token allocations
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadWriterData}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button
                onClick={handleRequestPayout}
                disabled={requesting || !canRequestPayout}
                size="sm"
              >
                {requesting ? 'Processing...' : 'Request Payout'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(balance.availableUsdValue)}
              </div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Available
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 border-2 border-dashed border-yellow-300 rounded-lg p-2">
                {formatCurrency(balance.pendingUsdValue)}
              </div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                Estimated (Pending)
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(balance.totalUsdEarned)}
              </div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Total Earned
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {formatCurrency(balance.paidOutUsdValue)}
              </div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Download className="h-3 w-3" />
                Paid Out
              </div>
            </div>
          </div>

          {/* Pending Earnings Disclaimer */}
          {balance.pendingUsdValue > 0 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                    Pending earnings may change until <CompactAllocationTimer className="inline" />
                  </p>
                </div>
              </div>
            </div>
          )}

          {!canRequestPayout && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  Minimum payout amount is {formatCurrency(minimumThreshold)}. 
                  You need {formatCurrency(minimumThreshold - balance.availableUsdValue)} more to request a payout.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fake Token Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Token Allocations
          </CardTitle>
          <CardDescription>
            Token allocations from users in different states
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {fakeTokenData.notLoggedIn}
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                Not Logged In Yet
              </div>
              <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                Users need to sign up
              </div>
            </div>

            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {fakeTokenData.noSubscription}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                No Subscription Yet
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                Users need to subscribe
              </div>
            </div>

            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {fakeTokenData.pendingThisMonth}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                Pending This Month
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Not locked in yet
              </div>
            </div>

            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {fakeTokenData.lockedInLastMonth}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">
                Locked In Last Month
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                Ready for payout
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              <strong>Note:</strong> These are simulated token allocations from users in different states.
              Only "Locked In" tokens from previous months can be included in payouts.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Earnings */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Earnings</CardTitle>
          <CardDescription>
            Monthly token earnings
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
                      <span className="font-medium">{earning.month}</span>
                      {getStatusBadge(earning.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {earning.totalTokensReceived} tokens from {earning.allocations.length} allocation(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(earning.totalUsdValue)}</div>
                    <div className="text-sm text-muted-foreground">
                      {earning.totalTokensReceived} tokens
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}