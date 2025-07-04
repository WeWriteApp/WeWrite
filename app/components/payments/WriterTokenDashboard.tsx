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
import { useSimulatedState } from '../../hooks/useAdminStateSimulator';

interface WriterTokenDashboardProps {
  className?: string;
}

export default function WriterTokenDashboard({ className }: WriterTokenDashboardProps) {
  const { session } = useCurrentAccount();
  const { toast } = useToast();
  const simulatedState = useSimulatedState();

  const [balance, setBalance] = useState<WriterTokenBalance | null>(null);
  const [earnings, setEarnings] = useState<WriterTokenEarnings[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [unfundedMessage, setUnfundedMessage] = useState<string | null>(null);

  // Generate simulated token data based on admin state simulator
  const getSimulatedTokenData = () => {
    const { tokenEarnings } = simulatedState;

    if (tokenEarnings.none) {
      return {
        balance: null,
        earnings: [],
        isEmpty: true
      };
    }

    // For unfunded states, show a special message since these tokens aren't in the WriterTokenBalance system
    if (tokenEarnings.unfundedLoggedOut || tokenEarnings.unfundedNoSubscription) {
      const tokenCount = tokenEarnings.unfundedLoggedOut ? 25 : 45;
      const source = tokenEarnings.unfundedLoggedOut ? 'logged-out users' : 'users without subscriptions';

      return {
        balance: null, // No balance since these are unfunded
        earnings: [],
        isEmpty: false,
        unfundedMessage: `You have ${tokenCount} unfunded tokens from ${source}. These tokens will become funded when those users sign up and subscribe.`
      };
    }

    if (tokenEarnings.fundedPending) {
      return {
        balance: {
          userId: session?.uid || 'simulated',
          totalTokensEarned: 120,
          totalUsdEarned: 12.0,
          pendingTokens: 120,
          pendingUsdValue: 12.0,
          availableTokens: 0,
          availableUsdValue: 0,
          paidOutTokens: 0,
          paidOutUsdValue: 0,
          lastProcessedMonth: '',
          createdAt: new Date(),
          updatedAt: new Date()
        } as WriterTokenBalance,
        earnings: [
          {
            id: 'sim-1',
            userId: session?.uid || 'simulated',
            month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
            totalTokensReceived: 120,
            totalUsdValue: 12.0,
            status: 'pending',
            allocations: [
              {
                allocationId: 'sim-alloc-1',
                fromUserId: 'sim-user-1',
                fromUsername: 'subscriber1',
                resourceType: 'page',
                resourceId: 'sim-page-1',
                resourceTitle: 'Sample Article',
                tokens: 120,
                usdValue: 12.0
              }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ] as WriterTokenEarnings[],
        isEmpty: false
      };
    }

    if (tokenEarnings.lockedAvailable) {
      const currentDate = new Date();
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
      const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      return {
        balance: {
          userId: session?.uid || 'simulated',
          totalTokensEarned: 250,
          totalUsdEarned: 25.0,
          pendingTokens: 85,
          pendingUsdValue: 8.5,
          availableTokens: 165,
          availableUsdValue: 16.5,
          paidOutTokens: 0,
          paidOutUsdValue: 0,
          lastProcessedMonth: lastMonthStr,
          createdAt: new Date(),
          updatedAt: new Date()
        } as WriterTokenBalance,
        earnings: [
          {
            id: 'sim-1',
            userId: session?.uid || 'simulated',
            month: lastMonthStr,
            totalTokensReceived: 165,
            totalUsdValue: 16.5,
            status: 'available',
            allocations: [
              {
                allocationId: 'sim-alloc-1',
                fromUserId: 'sim-user-1',
                fromUsername: 'subscriber1',
                resourceType: 'page',
                resourceId: 'sim-page-1',
                resourceTitle: 'Popular Article',
                tokens: 165,
                usdValue: 16.5
              }
            ],
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          },
          {
            id: 'sim-2',
            userId: session?.uid || 'simulated',
            month: currentMonthStr,
            totalTokensReceived: 85,
            totalUsdValue: 8.5,
            status: 'pending',
            allocations: [
              {
                allocationId: 'sim-alloc-2',
                fromUserId: 'sim-user-2',
                fromUsername: 'subscriber2',
                resourceType: 'page',
                resourceId: 'sim-page-2',
                resourceTitle: 'Recent Article',
                tokens: 85,
                usdValue: 8.5
              }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ] as WriterTokenEarnings[],
        isEmpty: false
      };
    }

    return null;
  };

  useEffect(() => {
    // Check if we should use simulated data from admin state simulator
    const simulatedData = getSimulatedTokenData();

    if (simulatedData) {
      // Use simulated data
      setBalance(simulatedData.balance);
      setEarnings(simulatedData.earnings);
      setUnfundedMessage((simulatedData as any).unfundedMessage || null);
      setLoading(false);
      console.log('🎭 Using simulated token earnings data:', simulatedData);
      return;
    }

    // Use real data
    if (session?.uid) {
      setUnfundedMessage(null);
      loadWriterData();
    } else {
      // Show empty state for logged-out users (unless simulated)
      setBalance(null);
      setEarnings([]);
      setUnfundedMessage(null);
      setLoading(false);
    }
  }, [session?.uid, simulatedState.tokenEarnings]);



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
            {unfundedMessage ? 'Unfunded Token Allocations' : 'You haven\'t received any token allocations yet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {unfundedMessage ? (
            <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
              <p className="text-orange-800 dark:text-orange-200 text-sm">
                {unfundedMessage}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground mb-4">
              When users allocate tokens to your pages, your earnings will appear here.
              Create great content to start earning!
            </p>
          )}
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