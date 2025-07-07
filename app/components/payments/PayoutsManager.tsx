"use client";

import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Wallet, DollarSign, TrendingUp, ExternalLink, Plus, AlertTriangle, CheckCircle } from 'lucide-react';
import { useFeatureFlag } from '../../utils/feature-flags';
import { useToast } from '../ui/use-toast';
import { showErrorToastWithCopy } from '../../utils/clipboard';
import Cookies from 'js-cookie';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import PayoutDashboard from './PayoutDashboard';
import { TokenEarningsService } from '../../services/tokenEarningsService';
import { TokenPayout } from '../../types/database';
import { formatCurrency } from '../../utils/formatCurrency';

interface EarningsTransaction {
  id: string;
  amount: number;
  source: string;
  sourcePageId?: string;
  sourcePageTitle?: string;
  date: string;
  type: 'token' | 'donation' | 'tip';
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
  const { currentAccount } = useCurrentAccount();
  const { toast } = useToast();
  const isPaymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  const [setup, setSetup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [realEarnings, setRealEarnings] = useState<any>(null);
  const [bankAccountConnected, setBankAccountConnected] = useState(false);
  const [stripeAccountStatus, setStripeAccountStatus] = useState<any>(null);
  const [payouts, setPayouts] = useState<TokenPayout[]>([]);

  useEffect(() => {
    if (currentAccount && isPaymentsEnabled) {
      loadPayoutSetup();
      loadRealEarningsData();
      checkBankAccountStatus();
      loadPayoutHistory();
    }
  }, [currentAccount, isPaymentsEnabled]);

  const loadRealEarningsData = async () => {
    if (!currentAccount?.uid) return;

    try {
      // Get token earnings
      const tokenBalance = await TokenEarningsService.getWriterTokenBalance(currentAccount.uid);
      if (tokenBalance) {
        setRealEarnings({
          totalEarnings: tokenBalance.totalUsdEarned,
          availableBalance: tokenBalance.availableUsdValue,
          pendingBalance: tokenBalance.pendingUsdValue,
          totalPlatformFees: 0,
          currency: 'usd'
        });
      }
    } catch (error) {
      console.error('Error loading token earnings data:', error);
    }
  };

  const loadPayoutHistory = async () => {
    if (!currentAccount?.uid) return;

    try {
      const payoutHistory = await TokenEarningsService.getPayoutHistory(currentAccount.uid, 10);
      setPayouts(payoutHistory);
    } catch (error) {
      console.error('Error loading payout history:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'secondary' as const, label: 'Pending' },
      processing: { variant: 'default' as const, label: 'Processing' },
      completed: { variant: 'default' as const, label: 'Completed' },
      failed: { variant: 'destructive' as const, label: 'Failed' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Helper function to refresh session cookie
  const refreshSessionCookie = async () => {
    try {
      const { auth } = await import('../../firebase/config');
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken(true); // Force refresh
        Cookies.set('session', token, { expires: 7 });
        console.log('Refreshed session cookie');
        return true;
      }
    } catch (error) {
      console.warn('Could not refresh session cookie:', error);
    }
    return false;
  };

  const checkBankAccountStatus = async () => {
    if (!currentAccount?.stripeConnectedAccountId) {
      setBankAccountConnected(false);
      return;
    }

    try {
      // Check if Stripe account exists and is set up
      const response = await fetch('/api/stripe/account-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeConnectedAccountId: currentAccount.stripeConnectedAccountId
        })});

      if (response.ok) {
        const result = await response.json();
        setStripeAccountStatus(result.data);
        setBankAccountConnected(result.data?.payouts_enabled || false);
      }
    } catch (error) {
      console.error('Error checking bank account status:', error);
    }
  };

  // If payments feature flag is disabled, don't render anything
  if (!isPaymentsEnabled) {
    return null;
  }

  const loadPayoutSetup = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/payouts/setup');
      if (response.ok) {
        const data = await response.json();
        setSetup(data.data);
      }
    } catch (error: any) {
      console.error('Error loading payout setup:', error);

      // Use enhanced error toast with copy functionality
      showErrorToastWithCopy("Failed to load payout information", {
        description: "Unable to retrieve your payout setup details",
        additionalInfo: {
          errorType: "PAYOUT_LOAD_ERROR",
          userId: currentAccount?.uid,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          errorMessage: error.message,
          errorStack: error.stack}});
    } finally {
      setLoading(false);
    }
  };

  const handleSetupBankAccount = async () => {
    try {
      setSetupLoading(true);

      // Ensure we have a valid user
      if (!currentAccount?.uid) {
        throw new Error('User not authenticated');
      }

      // Get fresh ID token for authentication
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };

      try {
        // Try to get fresh Firebase ID token if available
        const { auth } = await import('../../firebase/config');
        if (auth.currentUser) {
          const token = await auth.currentUser.getIdToken(true); // Force refresh
          headers['Authorization'] = `Bearer ${token}`;
          // Also update the session cookie
          Cookies.set('session', token, { expires: 7 });
          console.log('Using fresh Firebase ID token for bank account setup');
        } else {
          console.log('No Firebase user available, using session-based auth');
          // Ensure we have session cookies set
          if (currentAccount.uid) {
            Cookies.set('wewrite_user_id', currentAccount.uid, { expires: 7 });
            Cookies.set('wewrite_authenticated', 'true', { expires: 7 });
            Cookies.set('userSession', JSON.stringify({
              uid: currentAccount.uid,
              email: currentAccount.email,
              username: currentAccount.username
            }), { expires: 7 });
          }
        }
      } catch (tokenError) {
        console.warn('Could not get Firebase ID token, using session-based auth:', tokenError);
        // Ensure session cookies are set as fallback
        if (currentAccount.uid) {
          Cookies.set('wewrite_user_id', currentAccount.uid, { expires: 7 });
          Cookies.set('wewrite_authenticated', 'true', { expires: 7 });
        }
      }

      // Debug: Log current cookies
      console.log('Current cookies before API call:', {
        session: Cookies.get('session') ? 'exists' : 'missing',
        wewrite_user_id: Cookies.get('wewrite_user_id'),
        wewrite_authenticated: Cookies.get('wewrite_authenticated'),
        userSession: Cookies.get('userSession') ? 'exists' : 'missing'
      });

      // Always create/redirect to Stripe Connect account setup
      const connectResponse = await fetch('/api/create-connect-account', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: currentAccount.uid })});

      if (connectResponse.ok) {
        const result = await connectResponse.json();
        window.location.href = result.url;
        return;
      } else {
        const errorData = await connectResponse.json();
        console.error('Connect account API error:', {
          status: connectResponse.status,
          statusText: connectResponse.statusText,
          errorData
        });

        // If it's an authentication error, try refreshing the session and retry once
        if (connectResponse.status === 401 || connectResponse.status === 403) {
          console.log('Authentication error, trying to refresh session...');
          const refreshed = await refreshSessionCookie();

          if (refreshed) {
            console.log('Session refreshed, retrying bank account setup...');
            // Retry with fresh session
            const retryResponse = await fetch('/api/create-connect-account', {
              method: 'POST',
              headers,
              body: JSON.stringify({ userId: currentAccount.uid })});

            if (retryResponse.ok) {
              const retryResult = await retryResponse.json();
              window.location.href = retryResult.url;
              return;
            } else {
              const retryErrorData = await retryResponse.json();
              console.error('Retry also failed:', retryErrorData);
              throw new Error(retryErrorData.error || `Failed to create Stripe account after retry (${retryResponse.status})`);
            }
          }
        }

        throw new Error(errorData.error || `Failed to create Stripe account (${connectResponse.status})`);
      }
    } catch (error: any) {
      console.error('Error setting up bank account:', error);

      // Use enhanced error toast with copy functionality
      showErrorToastWithCopy("Bank account setup failed", {
        description: error.message || "Failed to setup bank account. Please try again.",
        additionalInfo: {
          errorType: "BANK_ACCOUNT_SETUP_ERROR",
          userId: currentAccount?.uid,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          stripeConnectedAccountId: currentAccount?.stripeConnectedAccountId,
          errorMessage: error.message,
          errorStack: error.stack}});
    } finally {
      setSetupLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    try {
      setSetupLoading(true);

      // First ensure payout recipient exists - force creation since user has earnings
      if (!setup?.recipient) {
        const setupResponse = await fetch('/api/payouts/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stripeConnectedAccountId: currentAccount.stripeConnectedAccountId,
            country: 'US', // Default to US, could be made dynamic
            forceCreate: true // Force creation of payout recipient
          })});

        if (!setupResponse.ok) {
          const errorData = await setupResponse.json();
          throw new Error(errorData.error || 'Failed to setup payout recipient');
        }

        const setupResult = await setupResponse.json();
        setSetup(setupResult.data);
      }

      // Request payout
      const response = await fetch('/api/payouts/earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_payout' })});

      if (response.ok) {
        toast({
          title: "Payout Requested",
          description: "Your payout request has been submitted successfully!"});
        loadPayoutSetup(); // Refresh data
        loadRealEarningsData(); // Refresh earnings data
        loadPayoutHistory(); // Refresh payout history
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to request payout');
      }
    } catch (error: any) {
      console.error('Error requesting payout:', error);

      showErrorToastWithCopy("Payout request failed", {
        description: error.message || "Failed to request payout. Please try again.",
        additionalInfo: {
          errorType: "PAYOUT_REQUEST_ERROR",
          userId: currentAccount?.uid,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          errorMessage: error.message,
          errorStack: error.stack}});
    } finally {
      setSetupLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="wewrite-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payouts
          </CardTitle>
          <CardDescription>Manage earnings and payouts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If user has payout setup, show the full dashboard
  if (setup?.recipient) {
    return (
      <Card className="wewrite-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payouts
          </CardTitle>
          <CardDescription>
            Manage earnings and payout settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PayoutDashboard />
        </CardContent>
      </Card>
    );
  }

  // Calculate current earnings
  const currentEarnings = realEarnings?.totalEarnings || 0;
  const minimumThreshold = 25; // $25 minimum payout
  const canRequestPayout = bankAccountConnected && currentEarnings >= minimumThreshold;

  // Show comprehensive payout interface
  return (
    <Card className="wewrite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
          Payouts
        </CardTitle>
        <CardDescription className="text-sm">
          Manage earnings and payout settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {/* Current Earnings Display */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-xs sm:text-sm font-medium">Current Earnings</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-green-600">${currentEarnings.toFixed(2)}</p>
          </div>

          <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-xs sm:text-sm font-medium">Minimum Payout</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">${minimumThreshold.toFixed(2)}</p>
          </div>

          <div className="p-3 sm:p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <span className="text-xs sm:text-sm font-medium">Bank Account</span>
            </div>
            <div className="text-sm font-medium">
              {bankAccountConnected ? (
                <Badge variant="default" className="bg-green-600 text-white text-xs sm:text-sm">Connected</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs sm:text-sm">Not Connected</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Bank Account Setup Section */}
        <div className="border-theme-strong rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
            <div className="flex-1">
              <h3 className="font-medium text-sm sm:text-base">Bank Account Setup</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Connect bank account to receive payments
              </p>
            </div>
            <Button
              onClick={handleSetupBankAccount}
              disabled={setupLoading}
              variant={bankAccountConnected ? "outline" : "default"}
              size="sm"
              className="w-full sm:w-auto"
            >
              {setupLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  <span className="hidden xs:inline">Setting up...</span>
                  <span className="xs:hidden">Setup...</span>
                </>
              ) : bankAccountConnected ? (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Manage Account</span>
                  <span className="xs:hidden">Manage</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Connect Bank Account</span>
                  <span className="xs:hidden">Connect</span>
                </>
              )}
            </Button>
          </div>

          {stripeAccountStatus && (
            <div className="text-sm text-muted-foreground">
              Status: {stripeAccountStatus.payouts_enabled ? 'Verified and ready for payouts' : 'Pending verification'}
            </div>
          )}
        </div>

        {/* Payout Request Section */}
        <div className="border-theme-strong rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Request Payout</h3>
              <p className="text-sm text-muted-foreground">
                {canRequestPayout
                  ? "Ready to request payout"
                  : `Need $${minimumThreshold} minimum (current: $${currentEarnings.toFixed(2)})`
                }
              </p>
            </div>
            <Button
              onClick={handleRequestPayout}
              disabled={!canRequestPayout || setupLoading}
              variant={canRequestPayout ? "default" : "secondary"}
            >
              {setupLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Request Payout
                </>
              )}
            </Button>
          </div>

          {!bankAccountConnected && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Bank Account Required</AlertTitle>
              <AlertDescription>
                Connect bank account to request payouts
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Payout History */}
        <div className="border-theme-strong rounded-lg p-4">
          <h3 className="font-medium mb-4">Payout History</h3>
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
        </div>
      </CardContent>
    </Card>
  );
}