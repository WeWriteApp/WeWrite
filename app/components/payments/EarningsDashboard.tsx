'use client';

/**
 * Earnings Dashboard
 *
 * Unified earnings management component showing:
 * - Current earnings balance
 * - Request payout button
 * - Payout history
 * - Bank account status
 */

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '../ui/use-toast';
// Use API calls instead of complex services
import { BankAccountManager } from './BankAccountManager';
import { Progress } from '../ui/progress';
import { PLATFORM_FEE_CONFIG } from '../../config/platformFee';

// Extract constants for easier use
const MINIMUM_PAYOUT_CENTS = PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_CENTS;
const MINIMUM_PAYOUT_DOLLARS = PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_DOLLARS;

interface EarningsData {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  paidOutBalance: number;
}

interface SimplePayout {
  id: string;
  userId: string;
  amountCents: number;
  status: 'pending' | 'completed' | 'failed';
  stripePayoutId?: string;
  requestedAt: any;
  completedAt?: any;
  failureReason?: string;
}

interface BankStatus {
  isConnected: boolean;
  isVerified: boolean;
  bankName?: string;
  last4?: string;
}

export default function EarningsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [bankStatus, setBankStatus] = useState<BankStatus | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<SimplePayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const bankData: any = bankStatus?.data;
  const isBankConnected = bankStatus?.isConnected ?? !!bankData?.bankAccount;
  const [linkLoading, setLinkLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const stripeAccountId = bankData?.id;

  useEffect(() => {
    if (user?.uid) {
      loadAllData();
    }
  }, [user?.uid]);

  const loadAllData = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);

      // Load all data in parallel - SIMPLE API approach
      const [earningsResponse, bankResponse, payoutsResponse] = await Promise.all([
        fetch('/api/earnings/user'),
        fetch('/api/stripe/account-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid })
        }),
        fetch('/api/payouts/history')
      ]);

      const earningsBreakdown = earningsResponse.ok ? await earningsResponse.json() : null;
      const bankAccountStatus = bankResponse.ok ? await bankResponse.json() : null;
      const payouts = payoutsResponse.ok ? await payoutsResponse.json() : [];

      // Extract earnings data from the API response (API returns { success: true, earnings: {...}, data: {...} })
      setEarnings(earningsBreakdown?.earnings || earningsBreakdown?.data || null);
      setBankStatus(bankAccountStatus);
      setPayoutHistory(payouts);

    } catch (error) {
      console.error('[EarningsDashboard] Error loading data:', error);
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
    if (!user?.uid || !earnings?.availableBalance) return;

    try {
      setRequesting(true);

      const response = await fetch('/api/payouts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Payout Requested",
          description: "Your payout request has been submitted successfully!"
        });
        await loadAllData(); // Refresh data
      } else {
        toast({
          title: "Request Failed",
          description: result.error || "Failed to request payout",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('[EarningsDashboard] Error requesting payout:', error);
      toast({
        title: "Error",
        description: "An error occurred while requesting payout",
        variant: "destructive"
      });
    } finally {
      setRequesting(false);
    }
  };

  const openStripeAccountLink = async (
    type: 'account_onboarding' | 'account_update' = 'account_update',
    allowRetry = true
  ) => {
    if (!user?.uid) return;
    try {
      setLinkLoading(true);
      const currentUrl = window.location.href;
      const res = await fetch('/api/stripe/account-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          type,
          returnUrl: currentUrl,
          refreshUrl: currentUrl
        })
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        // If account_update isn't allowed, fall back to onboarding once
        const message = data.error || 'Failed to create Stripe link';
        const cannotUpdate = message?.toLowerCase().includes('account_update');
        if (allowRetry && cannotUpdate) {
          return openStripeAccountLink('account_onboarding', false);
        }
        throw new Error(message);
      }
      // Use location.href instead of window.open for PWA compatibility
      window.location.href = data.url;
    } catch (error: any) {
      console.error('[EarningsDashboard] Error creating account link:', error);
      toast({
        title: 'Stripe link failed',
        description: error?.message || 'Unable to open Stripe account link.',
        variant: 'destructive'
      });
    } finally {
      setLinkLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><Icon name="CheckCircle" size={12} className="mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Icon name="Clock" size={12} className="mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><Icon name="AlertCircle" size={12} className="mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payout Threshold - Simple progress indicator */}
      {(() => {
        const availableBalance = Number(earnings?.availableBalance) || 0;
        const availableCents = Math.round(availableBalance * 100);
        const progressPercent = Math.min((availableCents / MINIMUM_PAYOUT_CENTS) * 100, 100);
        const isAboveThreshold = availableCents >= MINIMUM_PAYOUT_CENTS;
        const amountNeeded = Math.max(0, (MINIMUM_PAYOUT_CENTS - availableCents) / 100);

        return (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">Payout Threshold</span>
                <span className="text-sm text-muted-foreground">
                  ${availableBalance.toFixed(2)} / ${MINIMUM_PAYOUT_DOLLARS.toFixed(2)}
                </span>
              </div>
              <Progress
                value={progressPercent}
                className={`h-2 ${isAboveThreshold ? '[&>div]:bg-green-500' : ''}`}
              />
              <p className="text-sm text-muted-foreground mt-2">
                {isAboveThreshold
                  ? 'Ready to pay out'
                  : `$${amountNeeded.toFixed(2)} more needed to pay out`
                }
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Stripe Connected Account & Bank */}
      <Card className="border-border bg-card">
        <CardContent className="pt-6 space-y-4">
          <div>
            <p className="font-medium text-lg">Stripe payouts & bank</p>
            <p className="text-xs text-muted-foreground">Status of your connected account and payout destination.</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Account ID</p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
              <span className="text-sm font-medium truncate flex-1">
                {stripeAccountId || 'Not connected'}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (stripeAccountId) {
                    navigator.clipboard.writeText(stripeAccountId);
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 1500);
                  }
                }}
                disabled={!stripeAccountId}
                aria-label="Copy account ID"
              >
                {copiedId ? <Icon name="CheckCircle" size={16} /> : <Icon name="Copy" size={16} />}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className={bankStatus?.data?.payouts_enabled ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100' : 'bg-muted text-muted-foreground'}>
              Payouts {bankStatus?.data?.payouts_enabled ? 'enabled' : 'disabled'}
            </Badge>
            <Badge className={bankStatus?.data?.charges_enabled ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100' : 'bg-muted text-muted-foreground'}>
              Charges {bankStatus?.data?.charges_enabled ? 'enabled' : 'disabled'}
            </Badge>
            <Badge className={bankStatus?.data?.details_submitted ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100' : 'bg-muted text-muted-foreground'}>
              Details {bankStatus?.data?.details_submitted ? 'submitted' : 'incomplete'}
            </Badge>
          </div>

          {isBankConnected && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div>
                <p className="font-medium">{bankStatus?.bankName || bankData?.bankAccount?.bankName || 'Bank account'}</p>
                <p className="text-sm text-muted-foreground">
                  ****{bankStatus?.last4 || bankData?.bankAccount?.last4 || '----'}
                </p>
              </div>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100">
                <Icon name="CheckCircle" size={12} className="mr-1" />Connected
              </Badge>
            </div>
          )}

          {bankStatus?.data?.requirements?.currently_due?.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-900/50 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              <div className="font-semibold mb-1">Action required</div>
              <ul className="list-disc list-inside space-y-1">
                {bankStatus.data.requirements.currently_due.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {!isBankConnected && (
            <div className="pt-2">
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={() => openStripeAccountLink('account_onboarding')}
                disabled={linkLoading}
              >
                {linkLoading ? 'Opening...' : 'Connect payouts in Stripe'}
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => openStripeAccountLink('account_update')}
            disabled={linkLoading}
          >
            {linkLoading ? 'Opening...' : 'Edit bank in Stripe'}
          </Button>
        </CardContent>
      </Card>

      {/* Earnings Overview */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card>
          <CardHeader className="p-2 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium flex items-center">
              <Icon name="DollarSign" size={12} className="md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Available Balance</span>
              <span className="sm:hidden">Available</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-bold">
              ${(Number(earnings?.availableBalance) || 0).toFixed(2)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">Ready for payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-2 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium flex items-center">
              <Icon name="Clock" size={12} className="md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Pending Balance</span>
              <span className="sm:hidden">Pending</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-bold">
              ${(Number(earnings?.pendingBalance) || 0).toFixed(2)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">This month's earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-2 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium flex items-center">
              <Icon name="CheckCircle" size={12} className="md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Total Earned</span>
              <span className="sm:hidden">Total</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-4 pt-0">
            <div className="text-base md:text-2xl font-bold">
              ${(Number(earnings?.totalEarnings) || 0).toFixed(2)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Request Payout Button */}
      {(() => {
        const availableBalance = Number(earnings?.availableBalance) || 0;
        const availableCents = Math.round(availableBalance * 100);
        const isAboveThreshold = availableCents >= MINIMUM_PAYOUT_CENTS;
        const amountNeeded = Math.max(0, (MINIMUM_PAYOUT_CENTS - availableCents) / 100);

        return isAboveThreshold && isBankConnected ? (
          <Button
            onClick={handleRequestPayout}
            disabled={requesting}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {requesting ? 'Processing...' : `Request Payout ($${availableBalance.toFixed(2)})`}
          </Button>
        ) : null;
      })()}

      {/* Payout History */}
      {payoutHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payoutHistory.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">${(payout.amountCents / 100).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      {payout.requestedAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                    </p>
                  </div>
                  {getStatusBadge(payout.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!earnings?.totalEarnings && !loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <Icon name="DollarSign" size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Earnings Yet</h3>
            <p className="text-muted-foreground">
              Start creating content to earn from supporters!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
