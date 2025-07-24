"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '../ui/use-toast';
import { TokenEarningsService } from '../../services/tokenEarningsService';
import {
  calculateFeeBreakdown,
  calculateFeeBreakdownAsync,
  meetsMinimumThreshold,
  formatCurrency,
  getFeeExplanation,
  WEWRITE_FEE_STRUCTURE,
  assessPayoutRisk,
  assessPayoutRiskAsync,
  getPayoutProtectionWarnings,
  type FeeBreakdown,
  type PayoutRiskAssessment
} from '../../utils/feeCalculations';
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Settings,
  Download,
  RefreshCw,
  Zap,
  Wallet
} from 'lucide-react';
import { useLogRocket } from '../../providers/LogRocketProvider';

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
    tokens: number;
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

  const { trackPayoutFlow } = useLogRocket();

  const [setup, setSetup] = useState<PayoutSetup | null>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [, sessionEarnings, setUserEarnings] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [preferences, setPreferences] = useState<any>(null);
  const [updatingPreferences, setUpdatingPreferences] = useState(false);
  const [stripeAccountStatus, setStripeAccountStatus] = useState<any>(null);
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<'standard' | 'instant'>('standard');
  const [riskAssessment, setRiskAssessment] = useState<PayoutRiskAssessment | null>(null);

  useEffect(() => {
    if (user) {
      loadPayoutData();
    }
  }, [user]);

  // Calculate fee breakdown and risk assessment when earnings change
  const updateFeeBreakdown = async (availableBalance: number) => {
    if (availableBalance > 0) {
      try {
        // Use async version to get dynamic fee structure
        const breakdown = await calculateFeeBreakdownAsync(availableBalance, 'usd', payoutMethod);
        setFeeBreakdown(breakdown);

        // Assess payout risk (using mock data for account creation date and recent payouts)
        const accountCreatedDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const recentPayouts = payouts.map(p => ({
          amount: p.amount,
          date: new Date(p.scheduledAt)
        }));

        const risk = await assessPayoutRiskAsync(
          availableBalance,
          accountCreatedDate,
          recentPayouts,
          'usd',
          payoutMethod
        );
        setRiskAssessment(risk);
      } catch (error) {
        console.error('Error calculating fee breakdown:', error);
        // Fallback to static calculation
        const breakdown = calculateFeeBreakdown(availableBalance, 'usd', payoutMethod);
        setFeeBreakdown(breakdown);

        const accountCreatedDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentPayouts = payouts.map(p => ({
          amount: p.amount,
          date: new Date(p.scheduledAt)
        }));

        const risk = assessPayoutRisk(
          availableBalance,
          accountCreatedDate,
          recentPayouts,
          'usd',
          payoutMethod
        );
        setRiskAssessment(risk);
      }
    } else {
      setFeeBreakdown(null);
      setRiskAssessment(null);
    }
  };

  const loadBankAccountStatus = async () => {
    if (!user?.stripeConnectedAccountId) {
      setStripeAccountStatus(null);
      return;
    }

    try {
      const response = await fetch('/api/stripe/account-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeConnectedAccountId: user.stripeConnectedAccountId
        })});

      if (response.ok) {
        const result = await response.json();
        setStripeAccountStatus(result.data);
      }
    } catch (error) {
      console.error('Error loading bank account status:', error);
    }
  };

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

      // Load payout preferences
      await loadPayoutPreferences();

      // Load bank account status
      await loadBankAccountStatus();

      // Load token earnings data
      const tokenBalance = await TokenEarningsService.getWriterTokenBalance(user.uid);
      if (tokenBalance) {
        const earnings = {
          totalEarnings: tokenBalance.totalUsdEarned,
          availableBalance: tokenBalance.availableUsdValue,
          pendingBalance: tokenBalance.pendingUsdValue,
          totalPlatformFees: 0, // Platform fees handled at subscription level
          currency: 'usd'
        };
        setUserEarnings(earnings);

        // Calculate fee breakdown for available balance
        updateFeeBreakdown(earnings.availableBalance);
      }

      // Load token earnings history
      const tokenEarnings = await TokenEarningsService.getWriterTokenEarnings(user.uid);
      setEarnings(tokenEarnings.map(earning => ({
        id: earning.id,
        amount: earning.totalUsdValue,
        source: 'Token Allocation',
        date: earning.createdAt,
        type: 'token' as any,
        status: earning.status === 'available' ? 'completed' : 'pending' as any,
        pageId: earning.allocations?.[0]?.resourceId,
        pageTitle: 'Token Earnings'
      })));

      // Recent transactions are now token allocations
      setRecentTransactions([]);

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
        variant: "destructive"});
    } finally {
      setLoading(false);
    }
  };

  const loadPayoutPreferences = async () => {
    try {
      const response = await fetch('/api/payouts/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.data);
      } else if (response.status === 404) {
        // If no payout recipient exists yet, set default preferences
        // This allows the automatic payout settings to be visible even before setup
        setPreferences({
          autoPayoutEnabled: false,
          minimumThreshold: 25,
          currency: 'usd',
          schedule: 'monthly',
          notificationsEnabled: true
        });
      }
    } catch (error) {
      console.error('Error loading payout preferences:', error);
      // Set default preferences on error to ensure UI is visible
      setPreferences({
        autoPayoutEnabled: false,
        minimumThreshold: 25,
        currency: 'usd',
        schedule: 'monthly',
        notificationsEnabled: true
      });
    }
  };

  const updatePayoutPreferences = async (updates: any) => {
    try {
      setUpdatingPreferences(true);

      const response = await fetch('/api/payouts/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)});

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.data);
        toast({
          title: "Settings Updated",
          description: "Your payout preferences have been updated successfully."});
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update preferences');
      }
    } catch (error) {
      console.error('Error updating payout preferences:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update preferences",
        variant: "destructive"});
    } finally {
      setUpdatingPreferences(false);
    }
  };

  const requestPayout = async () => {
    try {
      setRequesting(true);

      // Track payout flow start
      trackPayoutFlow({
        step: 'start',
        payoutAmount: setup?.earnings?.availableAmount
      });

      const response = await fetch('/api/payouts/earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_payout' })
      });

      if (response.ok) {
        // Track successful payout
        trackPayoutFlow({
          step: 'complete',
          payoutAmount: setup?.earnings?.availableAmount
        });

        toast({
          title: "Payout Requested",
          description: "Your payout has been scheduled for processing"});
        loadPayoutData();
      } else {
        const error = await response.json();

        // Track payout error
        trackPayoutFlow({
          step: 'error',
          errorType: error.error || 'unknown_error'
        });

        throw new Error(error.error);
      }

    } catch (error: any) {
      // Track payout error
      trackPayoutFlow({
        step: 'error',
        errorType: error.message || 'request_failed'
      });

      toast({
        title: "Request Failed",
        description: error.message || "Failed to request payout",
        variant: "destructive"});
    } finally {
      setRequesting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'}).format(amount);
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

  // Payments are always enabled - no feature flag check needed

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
      tokens: userEarnings.totalEarnings || 0,
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
    earningsBySource: { tokens: 0, subscriptions: 0, bonuses: 0 }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="wewrite-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Available</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(earnings_breakdown.availableAmount)}
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              Ready for payout
            </div>
          </CardContent>
        </Card>

        <Card className="wewrite-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">
              {formatCurrency(earnings_breakdown.pendingAmount)}
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              Processing
            </div>
          </CardContent>
        </Card>

        <Card className="wewrite-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Total Earned</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(earnings_breakdown.totalEarnings)}
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              All time
            </div>
          </CardContent>
        </Card>

        <Card className="wewrite-card">
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
            <div className="text-xs text-muted-foreground mt-1">
              {earnings_breakdown.lastPayoutDate
                ? new Date(earnings_breakdown.lastPayoutDate).toLocaleDateString()
                : 'No payouts yet'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fee Breakdown Section */}
      {feeBreakdown && (
        <Card className="wewrite-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Fee Breakdown
            </CardTitle>
            <CardDescription>
              Transparent breakdown of all fees and your net payout amount
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Gross Earnings</span>
                  <span className="font-medium">{formatCurrency(feeBreakdown.grossEarnings)}</span>
                </div>

                {feeBreakdown.wewritePlatformFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">WeWrite Platform Fee</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(feeBreakdown.wewritePlatformFee)}
                    </span>
                  </div>
                )}

                {feeBreakdown.stripePayoutFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Payout Fee ({payoutMethod === 'instant' ? 'Instant' : 'Standard'})
                    </span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(feeBreakdown.stripePayoutFee)}
                    </span>
                  </div>
                )}

                {feeBreakdown.taxWithholding > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tax Withholding</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(feeBreakdown.taxWithholding)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-theme-strong">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      Net Payout Amount
                    </span>
                    <span className="text-lg font-bold text-green-800 dark:text-green-200">
                      {formatCurrency(feeBreakdown.netPayoutAmount)}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  {getFeeExplanation(payoutMethod)}
                </div>

                {!meetsMinimumThreshold(feeBreakdown.grossEarnings, 'usd', payoutMethod) && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-theme-strong">
                    <div className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Minimum not met:</strong> You need at least {formatCurrency(WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold)} after fees to request a payout.
                    </div>
                  </div>
                )}

                {/* Risk Assessment Warnings */}
                {riskAssessment && !riskAssessment.canPayout && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border-theme-strong">
                    <div className="text-sm text-red-800 dark:text-red-200">
                      <strong>Payout Blocked:</strong>
                      <ul className="mt-1 list-disc list-inside">
                        {riskAssessment.reasons.map((reason, index) => (
                          <li key={index}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Protection Warnings */}
                {riskAssessment && riskAssessment.canPayout && riskAssessment.riskLevel !== 'low' && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-theme-strong">
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Security Notice:</strong> {riskAssessment.recommendedAction}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Status & Actions */}
      <Card className="wewrite-card">
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
              {/* Automatic Payout Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={preferences?.autoPayoutEnabled || false}
                  onCheckedChange={(checked) =>
                    updatePayoutPreferences({ autoPayoutEnabled: checked })
                  }
                  disabled={updatingPreferences || !riskAssessment?.canPayout}
                />
                <span className="text-sm font-medium">
                  {preferences?.autoPayoutEnabled ? 'Auto Payouts On' : 'Auto Payouts Off'}
                </span>
              </div>

              {/* Manual Payout Button */}
              <Button
                onClick={requestPayout}
                disabled={requesting || !riskAssessment?.canPayout}
                size="sm"
                variant={preferences?.autoPayoutEnabled ? "outline" : "default"}
              >
                {requesting ? 'Processing...' : 'Request Payout Now'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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

            {/* Bank Account Details */}
            {stripeAccountStatus?.bank_account && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Connected Bank Account</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank:</span>
                    <span className="font-medium">
                      {stripeAccountStatus.bank_account.bank_name || 'Bank Account'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account:</span>
                    <span className="font-medium">
                      ****{stripeAccountStatus.bank_account.last4}
                    </span>
                  </div>
                  {stripeAccountStatus.bank_account.routing_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Routing:</span>
                      <span className="font-medium">
                        {stripeAccountStatus.bank_account.routing_number}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency:</span>
                    <span className="font-medium uppercase">
                      {stripeAccountStatus.bank_account.currency}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Automatic Payout Settings */}
      {preferences && (
        <Card className="wewrite-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Automatic Payouts
            </CardTitle>
            <CardDescription>
              Configure automatic payout processing for your earnings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Auto Payout Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium">Enable Automatic Payouts</div>
                <div className="text-sm text-muted-foreground">
                  Automatically process payouts when your balance reaches {formatCurrency(WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold)} (after fees)
                </div>
              </div>
              <Switch
                checked={preferences.autoPayoutEnabled}
                onCheckedChange={(checked) =>
                  updatePayoutPreferences({ autoPayoutEnabled: checked })
                }
                disabled={updatingPreferences}
              />
            </div>

            {/* Payout Method Selection */}
            <div className="space-y-3">
              <div className="font-medium text-sm">Payout Method</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  className={`p-3 border-theme-strong rounded-lg cursor-pointer transition-colors ${
                    payoutMethod === 'standard'
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => {
                    setPayoutMethod('standard');
                    if (userEarnings) updateFeeBreakdown(userEarnings.availableBalance);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      payoutMethod === 'standard' ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`} />
                    <span className="font-medium text-sm">Standard Payout</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Free • 2-5 business days
                  </div>
                </div>

                <div
                  className={`p-3 border-theme-strong rounded-lg cursor-pointer transition-colors ${
                    payoutMethod === 'instant'
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => {
                    setPayoutMethod('instant');
                    if (userEarnings) updateFeeBreakdown(userEarnings.availableBalance);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      payoutMethod === 'instant' ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`} />
                    <span className="font-medium text-sm">Instant Payout</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    1.5% fee (min 50¢) • Within minutes
                  </div>
                </div>
              </div>
            </div>

            {/* Payout Schedule Information */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="font-medium text-sm">Automatic Payout Schedule</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Processing Date:</span>
                  <span className="ml-2 font-medium">1st of each month</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Minimum Threshold:</span>
                  <span className="ml-2 font-medium">{formatCurrency(preferences.minimumThreshold || WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Processing Time:</span>
                  <span className="ml-2 font-medium">
                    {payoutMethod === 'instant' ? 'Within minutes' : '2-5 business days'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Currency:</span>
                  <span className="ml-2 font-medium uppercase">{preferences.currency || 'USD'}</span>
                </div>
              </div>

              {/* Additional Information */}
              <div className="pt-3 border-t border-theme-medium">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• Automatic payouts are processed on the 1st of each month if your balance meets the minimum threshold</div>
                  <div>• You can still request manual payouts at any time using the "Request Payout Now" button</div>
                  <div>• All fees are clearly displayed before processing any payout</div>
                  {stripeAccountStatus?.bank_account && (
                    <div>• Payouts will be sent to your connected bank account: ****{stripeAccountStatus.bank_account.last4}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Status Information */}
            <div className="flex items-start gap-3 p-4 border-theme-strong rounded-lg">
              {preferences.autoPayoutEnabled ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-green-900 dark:text-green-100">
                      Automatic Payouts Enabled
                    </div>
                    <div className="text-sm text-success-foreground">
                      Automatic monthly payouts when balance ≥ ${preferences.minimumThreshold}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-yellow-900 dark:text-yellow-100">
                      Manual Payouts Only
                    </div>
                    <div className="text-sm text-yellow-700 dark:text-yellow-300">
                      Request payouts manually when ready
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Earnings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Earnings</CardTitle>
          <CardDescription>
            Latest token earnings
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
                <div key={earning.id} className="flex items-center justify-between p-3 border-theme-strong rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {earning.pageId ? 'Token Allocation' : 'Token Earnings'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        tokens
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
    </div>
  );
}