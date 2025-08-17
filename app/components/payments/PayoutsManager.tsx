"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Wallet, DollarSign, Settings, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

import { useToast } from '../ui/use-toast';
import { Alert, AlertDescription } from '../ui/alert';
// Use API calls instead of complex services
import { TokenPayout } from '../../types/database';
import { formatCurrency } from '../../utils/formatCurrency';
import { SimpleBankAccountManager } from './SimpleBankAccountManager';
import { PayoutsHistoryTable } from './PayoutsHistoryTable';
import PayoutCountdownTimer from './PayoutCountdownTimer';

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

// Bank Setup Component - Embedded Stripe implementation
function BankSetup({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  return (
    <SimpleBankAccountManager
      onUpdate={onSuccess}
    />
  );
}



export function PayoutsManager() {
  const { user } = useAuth();
  const { toast } = useToast();




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
  const [payouts, setPayouts] = useState<TokenPayout[]>([]);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  useEffect(() => {
    if (user) {
      loadPayoutData();
      loadBankAccountStatus();
      loadAutoPayoutSettings();
      loadPayoutHistory();
    }
  }, [user]);

  // Set up periodic refresh for payout status (every 30 seconds)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      // Only refresh if user is on the payouts tab and page is visible
      if (document.visibilityState === 'visible' && window.location.hash === '#payouts') {
        loadBankAccountStatus();
        loadPayoutHistory();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  const loadPayoutData = async () => {
    if (!user?.uid) return;

    try {
      // Use the correct earnings API endpoint
      const response = await fetch('/api/earnings/user');
      if (response.ok) {
        const data = await response.json();
        const earnings = data.earnings || {};
        setPayoutData({
          totalEarnings: earnings.totalEarnings || 0,
          availableBalance: earnings.availableBalance || 0,
          pendingBalance: earnings.pendingBalance || 0,
          lastPayoutAmount: payouts.length > 0 ? payouts[0].amount : undefined,
          lastPayoutDate: payouts.length > 0 ? payouts[0].completedAt : undefined
        });
      } else {
        // Set default values if API fails
        setPayoutData({
          totalEarnings: 0,
          availableBalance: 0,
          pendingBalance: 0
        });
      }
    } catch (error) {
      console.error('Error loading payout data:', error);
      // Set default values on error
      setPayoutData({
        totalEarnings: 0,
        availableBalance: 0,
        pendingBalance: 0
      });
    }
  };

  const loadBankAccountStatus = async () => {
    if (!user?.uid) return;

    try {
      const response = await fetch('/api/stripe/account-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });

      if (response.ok) {
        const result = await response.json();
        const accountData = result.data;
        setBankAccountStatus({
          isConnected: !!accountData?.bankAccount,
          isVerified: accountData?.payouts_enabled || false,
          bankName: accountData?.bankAccount?.bankName,
          last4: accountData?.bankAccount?.last4,
          accountType: accountData?.bankAccount?.accountType
        });
      }
    } catch (error) {
      console.error('Error loading bank account status:', error);
    }
  };

  const loadAutoPayoutSettings = async () => {
    if (!user?.uid) return;

    try {
      const response = await fetch('/api/payouts/preferences', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setAutoPayoutSettings({
            enabled: result.data.autoPayoutEnabled || false,
            minimumAmount: result.data.minimumThreshold || 25,
            frequency: result.data.schedule === 'weekly' ? 'weekly' : 'monthly'
          });
        }
      } else if (response.status === 404) {
        // No preferences set yet, use defaults
        setAutoPayoutSettings({
          enabled: false,
          minimumAmount: 25,
          frequency: 'monthly'
        });
      }
    } catch (error) {
      console.error('Error loading auto payout settings:', error);
      // Fallback to localStorage for backward compatibility
      try {
        const saved = localStorage.getItem(`autopayout_${user?.uid}`);
        if (saved) {
          setAutoPayoutSettings(JSON.parse(saved));
        }
      } catch (fallbackError) {
        console.error('Error loading fallback settings:', fallbackError);
      }
    }
  };

  const loadPayoutHistory = async () => {
    if (!user?.uid) return;

    try {
      // Try to load USD payouts first (new system)
      const response = await fetch('/api/payouts/history', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Convert API data to expected format
          const formattedPayouts = result.data.map((payout: any) => ({
            id: payout.id,
            amount: payout.amountCents ? payout.amountCents / 100 : payout.amount,
            currency: payout.currency || 'usd',
            status: payout.status,
            createdAt: payout.requestedAt || payout.createdAt,
            processedAt: payout.processedAt,
            bankAccount: payout.bankAccount || 'Connected Bank Account',
            stripeTransferId: payout.stripeTransferId
          }));
          setPayouts(formattedPayouts);
        } else {
          setPayouts([]);
        }
      } else {
        // Use simple API for payout history
        const response = await fetch('/api/payouts/history');
        const payoutHistory = response.ok ? await response.json() : [];
        setPayouts(payoutHistory.map(payout => ({
          id: payout.id,
          amount: payout.amountCents / 100,
          status: payout.status,
          completedAt: payout.completedAt,
          requestedAt: payout.requestedAt
        })));
      }
    } catch (error) {
      console.error('Error loading payout history:', error);
      // Set empty array on error
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  };

  const updateAutoPayoutSettings = async (newSettings: AutoPayoutSettings) => {
    setUpdatingSettings(true);
    try {
      // Convert UI settings to API format
      const apiPreferences = {
        autoPayoutEnabled: newSettings.enabled,
        minimumThreshold: newSettings.minimumAmount,
        schedule: newSettings.frequency,
        notificationsEnabled: true // Default to enabled
      };

      const response = await fetch('/api/payouts/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPreferences)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAutoPayoutSettings(newSettings);

          // Also save to localStorage as backup
          localStorage.setItem(`autopayout_${user?.uid}`, JSON.stringify(newSettings));

          toast({
            title: "Settings Updated",
            description: "Your automatic payout preferences have been saved."
          });
        } else {
          throw new Error(result.error || 'Failed to update preferences');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update preferences');
      }
    } catch (error) {
      console.error('Error updating auto payout settings:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update payout settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleBankSetupSuccess = () => {
    // Refresh all payout-related data
    loadBankAccountStatus();
    loadAutoPayoutSettings();
    loadPayoutHistory();

    toast({
      title: "Bank Account Connected",
      description: "Your bank account has been successfully connected for payouts."
    });
  };

  // Check for URL parameters indicating return from Stripe
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === 'true') {
      // User returned from successful Stripe onboarding
      setTimeout(() => {
        handleBankSetupSuccess();
      }, 1000); // Small delay to ensure Stripe has processed changes

      // Clean up URL parameters
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    } else if (urlParams.get('refresh') === 'true') {
      // User returned from Stripe but may need to retry
      setTimeout(() => {
        loadBankAccountStatus();
      }, 1000);

      // Clean up URL parameters
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);



  // Payments are always enabled - no feature flag check needed

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
      {/* Single clean bank account section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Bank Account</h2>
        </div>

        <SimpleBankAccountManager
          onUpdate={loadBankAccountStatus}
        />
      </div>

      {/* Payout Countdown Timer */}
      <div>
        <PayoutCountdownTimer
          showExplanation={true}
          className="w-full"
        />
      </div>

      {/* Automatic Payout Settings */}
      {bankAccountStatus.isConnected && bankAccountStatus.isVerified && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Automatic Payouts</h2>
          </div>
          <div className="space-y-4 p-4 border border-border rounded-lg">
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
              <div className="space-y-4 pt-4 border-t border-border">
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

      {/* Payout History Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Payout History</h2>
        </div>
        <PayoutsHistoryTable
          showTitle={false}
          onRefresh={loadPayoutHistory}
        />
      </div>

    </div>
  );
}