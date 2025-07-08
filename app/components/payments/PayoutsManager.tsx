"use client";

import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Wallet, DollarSign, Settings, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useFeatureFlag } from '../../utils/feature-flags';
import { useToast } from '../ui/use-toast';
import { Alert, AlertDescription } from '../ui/alert';
import { TokenEarningsService } from '../../services/tokenEarningsService';
import { TokenPayout } from '../../types/database';
import { formatCurrency } from '../../utils/formatCurrency';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { getStripePublishableKey } from '../../utils/stripeConfig';

// Initialize Stripe
const stripePromise = loadStripe(getStripePublishableKey() || '');

interface PayoutData {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  lastPayoutAmount?: number;
  lastPayoutDate?: string;
}

interface BankAccountStatus {
  isConnected: boolean;
  isVerified: boolean;
  bankName?: string;
  last4?: string;
  accountType?: string;
}

interface AutoPayoutSettings {
  enabled: boolean;
  minimumAmount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
}

// Embedded Bank Setup Component
function EmbeddedBankSetup({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentAccount } = useCurrentAccount();
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !currentAccount) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create or update Stripe Connect account with bank details
      const response = await fetch('/api/create-connect-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentAccount.uid,
          embedded: true
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Bank Account Connected",
          description: "Your bank account has been successfully connected for payouts."
        });
        onSuccess();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to connect bank account');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Connect Your Bank Account</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Securely connect your bank account to receive payouts from your supporters.
        </p>
      </div>

      {error && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement />

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!stripe || loading}
            className="flex-1"
          >
            {loading ? 'Connecting...' : 'Connect Bank Account'}
          </Button>
        </div>
      </form>
    </div>
  );
}

  const updateAutoPayoutSettings = async (newSettings: AutoPayoutSettings) => {
    setUpdatingSettings(true);
    try {
      localStorage.setItem(`autopayout_${currentAccount?.uid}`, JSON.stringify(newSettings));
      setAutoPayoutSettings(newSettings);

      toast({
        title: "Settings Updated",
        description: "Your automatic payout preferences have been saved."
      });
    } catch (error) {
      console.error('Error updating auto payout settings:', error);
      toast({
        title: "Error",
        description: "Failed to update payout settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleBankSetupSuccess = () => {
    setShowBankSetup(false);
    loadBankAccountStatus();
    toast({
      title: "Bank Account Connected",
      description: "Your bank account has been successfully connected for payouts."
    });
  };

export function PayoutsManager() {
  const { currentAccount } = useCurrentAccount();
  const { toast } = useToast();
  const isPaymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  const [payoutData, setPayoutData] = useState<PayoutData | null>(null);
  const [bankAccountStatus, setBankAccountStatus] = useState<BankAccountStatus>({
    isConnected: false,
    isVerified: false
  });
  const [autoPayoutSettings, setAutoPayoutSettings] = useState<AutoPayoutSettings>({
    enabled: false,
    minimumAmount: 10,
    frequency: 'weekly'
  });
  const [loading, setLoading] = useState(true);
  const [showBankSetup, setShowBankSetup] = useState(false);
  const [payouts, setPayouts] = useState<TokenPayout[]>([]);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  useEffect(() => {
    if (currentAccount && isPaymentsEnabled) {
      loadPayoutData();
      loadBankAccountStatus();
      loadAutoPayoutSettings();
      loadPayoutHistory();
    }
  }, [currentAccount, isPaymentsEnabled]);

  const loadPayoutData = async () => {
    if (!currentAccount?.uid) return;

    try {
      const tokenBalance = await TokenEarningsService.getWriterTokenBalance(currentAccount.uid);
      if (tokenBalance) {
        setPayoutData({
          totalEarnings: tokenBalance.totalUsdEarned,
          availableBalance: tokenBalance.availableUsdValue,
          pendingBalance: tokenBalance.pendingUsdValue,
          lastPayoutAmount: payouts.length > 0 ? payouts[0].amount : undefined,
          lastPayoutDate: payouts.length > 0 ? payouts[0].completedAt : undefined
        });
      }
    } catch (error) {
      console.error('Error loading payout data:', error);
    }
  };

  const loadBankAccountStatus = async () => {
    if (!currentAccount?.uid) return;

    try {
      const response = await fetch('/api/stripe/account-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentAccount.uid })
      });

      if (response.ok) {
        const result = await response.json();
        const accountData = result.data;
        setBankAccountStatus({
          isConnected: !!accountData?.bank_account,
          isVerified: accountData?.payouts_enabled || false,
          bankName: accountData?.bank_account?.bank_name,
          last4: accountData?.bank_account?.last4,
          accountType: accountData?.bank_account?.account_type
        });
      }
    } catch (error) {
      console.error('Error loading bank account status:', error);
    }
  };

  const loadAutoPayoutSettings = async () => {
    // Load auto payout settings from API or localStorage
    try {
      const saved = localStorage.getItem(`autopayout_${currentAccount?.uid}`);
      if (saved) {
        setAutoPayoutSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading auto payout settings:', error);
    }
  };

  const loadPayoutHistory = async () => {
    if (!currentAccount?.uid) return;

    try {
      const payoutHistory = await TokenEarningsService.getPayoutHistory(currentAccount.uid, 10);
      setPayouts(payoutHistory);
    } catch (error) {
      console.error('Error loading payout history:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAutoPayoutSettings = async (newSettings: AutoPayoutSettings) => {
    setUpdatingSettings(true);
    try {
      // Save to localStorage for now (could be API endpoint later)
      localStorage.setItem(`autopayout_${currentAccount?.uid}`, JSON.stringify(newSettings));
      setAutoPayoutSettings(newSettings);

      toast({
        title: "Settings Updated",
        description: "Your automatic payout preferences have been saved."
      });
    } catch (error) {
      console.error('Error updating auto payout settings:', error);
      toast({
        title: "Error",
        description: "Failed to update payout settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleBankSetupSuccess = () => {
    setShowBankSetup(false);
    loadBankAccountStatus();
    toast({
      title: "Bank Account Connected",
      description: "Your bank account has been successfully connected for payouts."
    });
  };

  // If payments feature flag is disabled, don't render anything
  if (!isPaymentsEnabled) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading payout information...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-background border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-muted-foreground">Available</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(payoutData?.availableBalance || 0)}
          </p>
        </div>

        <div className="bg-background border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-muted-foreground">Pending</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">
            {formatCurrency(payoutData?.pendingBalance || 0)}
          </p>
        </div>

        <div className="bg-background border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-muted-foreground">Total Earned</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(payoutData?.totalEarnings || 0)}
          </p>
        </div>
      </div>

      {/* Bank Account Section */}
      <div className="bg-background border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-medium">Bank Account</h3>
          </div>
          {bankAccountStatus.isConnected && bankAccountStatus.isVerified && (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
        </div>

        {!bankAccountStatus.isConnected ? (
          <div className="text-center py-6">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No Bank Account Connected</h4>
            <p className="text-muted-foreground mb-4">
              Connect your bank account to receive payouts from supporters.
            </p>
            <Button onClick={() => setShowBankSetup(true)}>
              Connect Bank Account
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="font-medium">{bankAccountStatus.bankName || 'Bank Account'}</p>
                <p className="text-sm text-muted-foreground">
                  ****{bankAccountStatus.last4} • {bankAccountStatus.accountType}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {bankAccountStatus.isVerified ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Clock className="h-4 w-4 text-yellow-600" />
                )}
                <span className="text-sm text-muted-foreground">
                  {bankAccountStatus.isVerified ? 'Verified' : 'Pending Verification'}
                </span>
              </div>
            </div>

            {bankAccountStatus.isVerified && (
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Manage Account
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Automatic Payout Settings */}
      {bankAccountStatus.isConnected && bankAccountStatus.isVerified && (
        <div className="bg-background border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-medium">Automatic Payouts</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-payout" className="text-base font-medium">
                  Enable Automatic Payouts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically transfer earnings to your bank account
                </p>
              </div>
              <Switch
                id="auto-payout"
                checked={autoPayoutSettings.enabled}
                onCheckedChange={(enabled) =>
                  updateAutoPayoutSettings({ ...autoPayoutSettings, enabled })
                }
                disabled={updatingSettings}
              />
            </div>

            {autoPayoutSettings.enabled && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minimum-amount">Minimum Amount</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="minimum-amount"
                        type="number"
                        min="1"
                        max="1000"
                        value={autoPayoutSettings.minimumAmount}
                        onChange={(e) =>
                          updateAutoPayoutSettings({
                            ...autoPayoutSettings,
                            minimumAmount: parseInt(e.target.value) || 10
                          })
                        }
                        className="pl-10"
                        disabled={updatingSettings}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Minimum balance required to trigger automatic payout
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="frequency">Payout Frequency</Label>
                    <Select
                      value={autoPayoutSettings.frequency}
                      onValueChange={(frequency: 'daily' | 'weekly' | 'monthly') =>
                        updateAutoPayoutSettings({ ...autoPayoutSettings, frequency })
                      }
                      disabled={updatingSettings}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      How often to check for automatic payouts
                    </p>
                  </div>
                </div>

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Automatic payouts will be processed {autoPayoutSettings.frequency} when your
                    available balance reaches ${autoPayoutSettings.minimumAmount} or more.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Embedded Bank Setup Modal */}
      {showBankSetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <Elements stripe={stripePromise}>
              <EmbeddedBankSetup
                onSuccess={handleBankSetupSuccess}
                onCancel={() => setShowBankSetup(false)}
              />
            </Elements>
          </div>
        </div>
      )}
    </div>
  );
}