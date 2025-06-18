"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Coins, 
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
import { useAuth } from '../../providers/AuthProvider';
import { TokenEarningsService } from '../../services/tokenEarningsService';
import { WriterTokenBalance, WriterTokenEarnings, TokenPayout } from '../../types/database';
import { formatCurrency } from '../../utils/formatCurrency';
import EarningsChart from './EarningsChart';

interface WriterTokenDashboardProps {
  className?: string;
}

export default function WriterTokenDashboard({ className }: WriterTokenDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [balance, setBalance] = useState<WriterTokenBalance | null>(null);
  const [earnings, setEarnings] = useState<WriterTokenEarnings[]>([]);
  const [payouts, setPayouts] = useState<TokenPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadWriterData();
    }
  }, [user?.uid]);

  const loadWriterData = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      
      const [balanceData, earningsData, payoutData] = await Promise.all([
        TokenEarningsService.getWriterTokenBalance(user.uid),
        TokenEarningsService.getWriterEarningsHistory(user.uid, 6),
        TokenEarningsService.getPayoutHistory(user.uid, 10)
      ]);
      
      setBalance(balanceData);
      setEarnings(earningsData);
      setPayouts(payoutData);
      
    } catch (error) {
      console.error('Error loading writer data:', error);
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
    if (!user?.uid || !balance) return;
    
    try {
      setRequesting(true);
      
      const result = await TokenEarningsService.requestPayout(user.uid);
      
      if (result.success) {
        toast({
          title: "Payout Requested",
          description: "Your payout request has been submitted successfully!",
        });
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
            <Coins className="h-5 w-5" />
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
              </CardTitle>
              <CardDescription>
                Your earnings from token allocations
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
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(balance.pendingUsdValue)}
              </div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                Pending
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

      {/* Detailed Tables */}
      <Tabs defaultValue="earnings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="earnings">Monthly Earnings</TabsTrigger>
          <TabsTrigger value="payouts">Payout History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="earnings">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Earnings</CardTitle>
              <CardDescription>
                Your token earnings by month
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
                            {new Date(payout.requestedAt as any).toLocaleDateString()}
                          </span>
                          {getStatusBadge(payout.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {payout.tokens} tokens
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(payout.amount)}</div>
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
