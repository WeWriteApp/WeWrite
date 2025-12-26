/**
 * Platform Account Configuration Component
 * 
 * Admin interface for configuring Stripe platform account
 * for the new fund holding model.
 */

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useToast } from '../ui/use-toast';

interface PlatformAccountStatus {
  accountId: string;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  currentPayoutSchedule: string;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  fundHoldingConfigured: boolean;
  lastConfigUpdate: Date;
}

interface BalanceBreakdown {
  available: number;
  pending: number;
  currency: string;
  lastUpdated: Date;
}

export const PlatformAccountConfig: React.FC = () => {
  const [status, setStatus] = useState<PlatformAccountStatus | null>(null);
  const [balance, setBalance] = useState<BalanceBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutDescription, setPayoutDescription] = useState('');
  const [checkBalanceAmount, setCheckBalanceAmount] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadPlatformStatus();
  }, []);

  const loadPlatformStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/configure-platform-account');
      const data = await response.json();

      if (data.success) {
        setStatus(data.platformAccount);
        setBalance(data.balance);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load platform status",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading platform status:', error);
      toast({
        title: "Error",
        description: "Failed to load platform status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, payload?: any) => {
    try {
      setActionLoading(action);
      
      const response = await fetch('/api/admin/configure-platform-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: data.message || `${action} completed successfully`
        });
        
        // Reload status after successful action
        await loadPlatformStatus();
      } else {
        toast({
          title: "Error",
          description: data.error || `Failed to ${action}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action}`,
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreatePayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payout amount",
        variant: "destructive"
      });
      return;
    }

    await handleAction('create_platform_payout', {
      amount,
      description: payoutDescription || 'Platform revenue payout'
    });

    // Clear form
    setPayoutAmount('');
    setPayoutDescription('');
  };

  const handleCheckBalance = async () => {
    const amount = parseFloat(checkBalanceAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount to check",
        variant: "destructive"
      });
      return;
    }

    try {
      setActionLoading('check_balance');
      
      const response = await fetch('/api/admin/configure-platform-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_balance', requiredAmount: amount })
      });

      const data = await response.json();

      if (data.success) {
        const { balanceSufficiency } = data;
        const statusColor = balanceSufficiency.sufficient ? 'default' : 'destructive';
        
        toast({
          title: balanceSufficiency.sufficient ? "Balance Sufficient" : "Insufficient Balance",
          description: `Available: $${balanceSufficiency.availableBalance.toFixed(2)} | Required: $${amount} | Risk: ${balanceSufficiency.riskLevel}`,
          variant: statusColor
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to check balance",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error checking balance:', error);
      toast({
        title: "Error",
        description: "Failed to check balance",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (configured: boolean) => {
    return configured ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <Icon name="CheckCircle" size={12} className="mr-1" />
        Configured
      </Badge>
    ) : (
      <Badge variant="destructive">
        <Icon name="XCircle" size={12} className="mr-1" />
        Not Configured
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Icon name="Loader" size={32} className="text-muted-foreground" />
        <span className="ml-2">Loading platform configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Account Configuration</h1>
          <p className="text-muted-foreground">
            Configure Stripe platform account for the fund holding model
          </p>
        </div>
        <Button 
          onClick={loadPlatformStatus} 
          variant="secondary"
          className="flex items-center gap-2"
        >
          <Icon name="RefreshCw" size={16} />
          Refresh
        </Button>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Settings" size={20} />
            Current Platform Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Account ID</Label>
                <p className="text-sm text-muted-foreground font-mono">{status.accountId}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Fund Holding Model</Label>
                <div className="mt-1">
                  {getStatusBadge(status.fundHoldingConfigured)}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Payout Schedule</Label>
                <p className="text-sm text-muted-foreground">{status.currentPayoutSchedule}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Payouts Enabled</Label>
                <p className="text-sm text-muted-foreground">
                  {status.payoutsEnabled ? '✅ Yes' : '❌ No'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Balance Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Wallet" size={20} />
            Platform Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balance && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="DollarSign" size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-green-800">Available Balance</span>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  ${balance.available.toFixed(2)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="TrendingUp" size={16} className="text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Pending Balance</span>
                </div>
                <p className="text-2xl font-bold text-yellow-600">
                  ${balance.pending.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => handleAction('initialize')}
              disabled={actionLoading === 'initialize'}
              className="w-full"
            >
              {actionLoading === 'initialize' && <Icon name="RefreshCw" size={16} className="mr-2 animate-spin" />}
              Initialize Fund Holding Model
            </Button>
            
            <Button
              onClick={() => handleAction('enable_manual_payouts')}
              disabled={actionLoading === 'enable_manual_payouts'}
              variant="secondary"
              className="w-full"
            >
              {actionLoading === 'enable_manual_payouts' && <Icon name="RefreshCw" size={16} className="mr-2 animate-spin" />}
              Enable Manual Payouts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Platform Payout */}
      <Card>
        <CardHeader>
          <CardTitle>Create Platform Payout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="payoutAmount">Amount ($)</Label>
              <Input
                id="payoutAmount"
                type="number"
                step="0.01"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="payoutDescription">Description</Label>
              <Input
                id="payoutDescription"
                value={payoutDescription}
                onChange={(e) => setPayoutDescription(e.target.value)}
                placeholder="Platform revenue payout"
              />
            </div>
          </div>
          <Button
            onClick={handleCreatePayout}
            disabled={actionLoading === 'create_platform_payout'}
            className="w-full"
          >
            {actionLoading === 'create_platform_payout' && <Icon name="RefreshCw" size={16} className="mr-2 animate-spin" />}
            Create Payout
          </Button>
        </CardContent>
      </Card>

      {/* Balance Check */}
      <Card>
        <CardHeader>
          <CardTitle>Check Balance Sufficiency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="checkAmount">Required Amount ($)</Label>
              <Input
                id="checkAmount"
                type="number"
                step="0.01"
                value={checkBalanceAmount}
                onChange={(e) => setCheckBalanceAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCheckBalance}
                disabled={actionLoading === 'check_balance'}
              >
                {actionLoading === 'check_balance' && <Icon name="RefreshCw" size={16} className="mr-2 animate-spin" />}
                Check Balance
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
