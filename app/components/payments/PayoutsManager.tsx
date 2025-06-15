"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
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
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import PayoutDashboard from './PayoutDashboard';
import { realPledgeService } from '../../services/realPledgeService';

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
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email, user?.uid);

  const [setup, setSetup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [realEarnings, setRealEarnings] = useState<any>(null);
  const [bankAccountConnected, setBankAccountConnected] = useState(false);
  const [stripeAccountStatus, setStripeAccountStatus] = useState<any>(null);

  useEffect(() => {
    if (user && isPaymentsEnabled) {
      loadPayoutSetup();
      loadRealEarningsData();
      checkBankAccountStatus();
    }
  }, [user, isPaymentsEnabled]);

  const loadRealEarningsData = async () => {
    if (!user?.uid) return;

    try {
      // Get real user earnings
      const userEarnings = await realPledgeService.getUserEarnings(user.uid);
      setRealEarnings(userEarnings);
    } catch (error) {
      console.error('Error loading real earnings data:', error);
    }
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
    if (!user?.stripeConnectedAccountId) {
      setBankAccountConnected(false);
      return;
    }

    try {
      // Check if Stripe account exists and is set up
      const response = await fetch('/api/stripe/account-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeConnectedAccountId: user.stripeConnectedAccountId
        }),
      });

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
          userId: user?.uid,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetupBankAccount = async () => {
    try {
      setSetupLoading(true);

      // Ensure we have a valid user
      if (!user?.uid) {
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
          if (user.uid) {
            Cookies.set('wewrite_user_id', user.uid, { expires: 7 });
            Cookies.set('wewrite_authenticated', 'true', { expires: 7 });
            Cookies.set('userSession', JSON.stringify({
              uid: user.uid,
              email: user.email,
              username: user.username
            }), { expires: 7 });
          }
        }
      } catch (tokenError) {
        console.warn('Could not get Firebase ID token, using session-based auth:', tokenError);
        // Ensure session cookies are set as fallback
        if (user.uid) {
          Cookies.set('wewrite_user_id', user.uid, { expires: 7 });
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
        body: JSON.stringify({ userId: user.uid }),
      });

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
              body: JSON.stringify({ userId: user.uid }),
            });

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
          userId: user?.uid,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          stripeConnectedAccountId: user?.stripeConnectedAccountId,
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });
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
            stripeConnectedAccountId: user.stripeConnectedAccountId,
            country: 'US', // Default to US, could be made dynamic
            forceCreate: true // Force creation of payout recipient
          }),
        });

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
        body: JSON.stringify({ action: 'request_payout' }),
      });

      if (response.ok) {
        toast({
          title: "Payout Requested",
          description: "Your payout request has been submitted successfully!",
        });
        loadPayoutSetup(); // Refresh data
        loadRealEarningsData(); // Refresh earnings data
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
          userId: user?.uid,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });
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
            Creator Payouts
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
            Manage your creator earnings and payout settings
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
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Payouts
        </CardTitle>
        <CardDescription>
          Manage your creator earnings and payout settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Earnings Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Current Earnings</span>
            </div>
            <p className="text-2xl font-bold">${currentEarnings.toFixed(2)}</p>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Minimum Payout</span>
            </div>
            <p className="text-2xl font-bold">${minimumThreshold.toFixed(2)}</p>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Bank Account</span>
            </div>
            <div className="text-sm font-medium">
              {bankAccountConnected ? (
                <Badge variant="default" className="bg-green-100 text-green-800">Connected</Badge>
              ) : (
                <Badge variant="secondary">Not Connected</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Bank Account Setup Section */}
        <div className="border-theme-strong rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Bank Account Setup</h3>
              <p className="text-sm text-muted-foreground">
                Connect your bank account to receive payments from supporters
              </p>
            </div>
            <Button
              onClick={handleSetupBankAccount}
              disabled={setupLoading}
              variant={bankAccountConnected ? "outline" : "default"}
            >
              {setupLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Setting up...
                </>
              ) : bankAccountConnected ? (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage Account
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Bank Account
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
                  ? "You can request a payout of your current earnings"
                  : `Minimum payout amount is $${minimumThreshold}. Current balance: $${currentEarnings.toFixed(2)}`
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
                You need to connect a bank account before you can request payouts.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* How it Works */}
        <div className="p-4 bg-muted/30 rounded-lg">
          <h4 className="font-medium mb-2">How it works:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Supporters pledge monthly amounts to your content</li>
            <li>• You earn 93% of pledges (7% platform fee)</li>
            <li>• Payouts processed monthly on the 1st</li>
            <li>• Minimum payout threshold: $25</li>
            <li>• International payouts supported</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
