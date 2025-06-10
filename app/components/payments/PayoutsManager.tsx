"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Wallet, DollarSign, TrendingUp, ExternalLink, Plus, AlertTriangle, CheckCircle } from 'lucide-react';
import { useFeatureFlag } from '../../utils/feature-flags';
import { useToast } from '../ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface EarningsTransaction {
  id: string;
  amount: number;
  source: string;
  sourcePageId?: string;
  sourcePageTitle?: string;
  date: string;
  type: 'pledge' | 'donation' | 'tip';
  status: 'completed' | 'pending';
}

interface PayoutTransaction {
  id: string;
  amount: number;
  date: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  bankAccount?: string;
  estimatedArrival?: string;
}

interface UserBalance {
  available: number;
  pending: number;
  total: number;
}

export function PayoutsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email);
  
  const [balance, setBalance] = useState<UserBalance>({ available: 0, pending: 0, total: 0 });
  const [earnings, setEarnings] = useState<EarningsTransaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<any>(null);

  // If payments feature flag is disabled, don't render anything
  if (!isPaymentsEnabled) {
    return null;
  }

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchPayoutData();
  }, [user]);

  const fetchPayoutData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user balance
      const balanceResponse = await fetch('/api/user-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        setBalance(balanceData.balance || { available: 0, pending: 0, total: 0 });
      }

      // Fetch earnings history
      const earningsResponse = await fetch('/api/user-earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (earningsResponse.ok) {
        const earningsData = await earningsResponse.json();
        setEarnings(earningsData.earnings || []);
      }

      // Fetch payout history
      const payoutsResponse = await fetch('/api/user-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (payoutsResponse.ok) {
        const payoutsData = await payoutsResponse.json();
        setPayouts(payoutsData.payouts || []);
      }

      // Fetch connected account info
      const accountResponse = await fetch('/api/connected-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        setConnectedAccount(accountData.account);
      }

    } catch (error) {
      console.error('Error fetching payout data:', error);
      setError('Failed to load payout information');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiatePayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payout amount.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(payoutAmount);
    if (amount > balance.available) {
      toast({
        title: "Insufficient Balance",
        description: "Payout amount exceeds available balance.",
        variant: "destructive",
      });
      return;
    }

    try {
      setPayoutLoading(true);

      const response = await fetch('/api/initiate-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          amount: amount,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Payout Initiated",
          description: `Your payout of $${amount.toFixed(2)} has been initiated and will arrive in 1-2 business days.`,
        });
        
        setShowPayoutDialog(false);
        setPayoutAmount('');
        fetchPayoutData(); // Refresh data
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate payout');
      }
    } catch (error) {
      console.error('Error initiating payout:', error);
      toast({
        title: "Payout Failed",
        description: error.message || "Failed to initiate payout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPayoutLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { variant: 'default' as const, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' },
      pending: { variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' },
      processing: { variant: 'secondary' as const, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' },
      failed: { variant: 'destructive' as const, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
    };

    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <Badge variant={config.variant} className={config.color}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payouts & Earnings
          </CardTitle>
          <CardDescription>Manage your earnings and payouts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payouts & Earnings
          </CardTitle>
          <CardDescription>Manage your earnings from pledges and donations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Balance Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Available</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(balance.available)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Pending</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(balance.pending)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Total Earned</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(balance.total)}</p>
            </div>
          </div>

          {/* Connected Account Status */}
          {!connectedAccount ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Bank Account Required</AlertTitle>
              <AlertDescription>
                Connect a bank account to receive payouts from your earnings.
                <Button variant="link" className="p-0 h-auto ml-2" asChild>
                  <a href="/settings/payouts/connect" className="inline-flex items-center">
                    Connect Account <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Bank Account Connected</AlertTitle>
              <AlertDescription>
                Payouts will be sent to your connected bank account ending in {connectedAccount.last4}.
              </AlertDescription>
            </Alert>
          )}

          {/* Payout Button */}
          {connectedAccount && balance.available > 0 && (
            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Ready to withdraw</p>
                <p className="text-sm text-muted-foreground">
                  You have {formatCurrency(balance.available)} available for payout
                </p>
              </div>
              <Button onClick={() => setShowPayoutDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Request Payout
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout Dialog */}
      <Dialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Enter the amount you'd like to withdraw to your connected bank account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="payout-amount">Payout Amount</Label>
              <Input
                id="payout-amount"
                type="number"
                step="0.01"
                min="0"
                max={balance.available}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum: {formatCurrency(balance.available)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayoutDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInitiatePayout} disabled={payoutLoading}>
              {payoutLoading ? 'Processing...' : 'Request Payout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
