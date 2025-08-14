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
import { TokenEarningsService } from '../../services/tokenEarningsService';
import { TokenPayout } from '../../types/database';
import { formatCurrency } from '../../utils/formatCurrency';
import { EmbeddedBankAccountSetup } from './EmbeddedBankAccountSetup';
import { EmbeddedBankAccountManager } from './EmbeddedBankAccountManager';
import { PayoutsHistoryTable } from './PayoutsHistoryTable';

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

// Bank Setup Component - Now uses embedded Stripe Connect components
function BankSetup({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  return (
    <EmbeddedBankAccountSetup
      onSuccess={onSuccess}
      onCancel={onCancel}
      showTitle={false}
    />
  );
}

  const updateAutoPayoutSettings = async (newSettings: AutoPayoutSettings) => {
    setUpdatingSettings(true);
    try {
      localStorage.setItem(`autopayout_${user?.uid}`, JSON.stringify(newSettings));
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

  const loadPayoutData = async () => {
    if (!user?.uid) return;

    try {
      const tokenBalance = await TokenEarningsService.getWriterTokenBalance(user.uid);
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
      const saved = localStorage.getItem(`autopayout_${user?.uid}`);
      if (saved) {
        setAutoPayoutSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading auto payout settings:', error);
    }
  };

  const loadPayoutHistory = async () => {
    if (!user?.uid) return;

    try {
      const payoutHistory = await TokenEarningsService.getPayoutHistory(user.uid, 10);
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
      localStorage.setItem(`autopayout_${user?.uid}`, JSON.stringify(newSettings));
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
    loadBankAccountStatus();
    toast({
      title: "Bank Account Connected",
      description: "Your bank account has been successfully connected for payouts."
    });
  };



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
        <EmbeddedBankAccountManager
          onUpdate={loadBankAccountStatus}
          showTitle={false}
        />
      </div>


      {/* Automatic Payout Settings */}
      {bankAccountStatus.isConnected && bankAccountStatus.isVerified && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Automatic Payouts</h2>
          </div>
          <div className="space-y-4 p-4 border rounded-lg">
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
              <div className="space-y-4 pt-4 border-t border-theme-medium">
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
        <PayoutsHistoryTable showTitle={false} />
      </div>

    </div>
  );
}