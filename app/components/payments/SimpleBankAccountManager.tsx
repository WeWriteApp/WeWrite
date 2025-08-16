"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2 } from 'lucide-react';

interface BankAccountStatus {
  isConnected: boolean;
  isVerified: boolean;
  bankName?: string;
  last4?: string;
  accountType?: string;
}

interface SimpleBankAccountManagerProps {
  onUpdate?: () => void;
}

export const SimpleBankAccountManager: React.FC<SimpleBankAccountManagerProps> = ({
  onUpdate
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankStatus, setBankStatus] = useState<BankAccountStatus>({
    isConnected: false,
    isVerified: false
  });

  // Load bank account status
  useEffect(() => {
    if (user?.uid) {
      loadBankStatus();
    }
  }, [user?.uid]);

  // Check for success/refresh parameters from Stripe redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === 'true' || urlParams.get('refresh') === 'true') {
      // Reload bank status after returning from Stripe
      setTimeout(() => {
        loadBankStatus();
      }, 1000); // Small delay to ensure Stripe has processed the changes

      // Clean up URL parameters
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  const loadBankStatus = async () => {
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
        setBankStatus({
          isConnected: !!accountData?.bankAccount,
          isVerified: accountData?.payouts_enabled || false,
          bankName: accountData?.bankAccount?.bankName,
          last4: accountData?.bankAccount?.last4,
          accountType: accountData?.bankAccount?.accountType
        });

        onUpdate?.();
      }
    } catch (error) {
      console.error('Error loading bank account status:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  // Simple bank account connection using Stripe Connect account links
  const handleConnectBank = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create account link for bank account setup
      // Note: Stripe Connect account links use Stripe's hosted pages with fixed styling
      const response = await fetch('/api/stripe/account-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          type: 'account_onboarding',
          returnUrl: `${window.location.origin}/settings/earnings?tab=payouts&connected=true`,
          refreshUrl: `${window.location.origin}/settings/earnings?tab=payouts&refresh=true`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create account link');
      }

      const { url } = await response.json();

      // Redirect to Stripe Connect onboarding
      window.location.href = url;

    } catch (error) {
      console.error('Failed to connect bank account:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect bank account');
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Alert>
        <AlertDescription>Please log in to manage your bank account.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-2">Bank Account</h2>
        <p className="text-sm text-muted-foreground">
          Connect your bank account to receive payouts.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {initialLoading ? (
        <div className="flex items-center gap-3 p-4 bg-muted/30 dark:bg-muted/20 rounded-lg border border-border/50">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <div className="text-sm text-muted-foreground">Loading bank account status...</div>
        </div>
      ) : (
        <>
          {/* Bank Account Status */}
          {bankStatus.isConnected && (
        <div className="flex items-center gap-3 p-4 bg-muted/30 dark:bg-muted/20 rounded-lg border border-border/50">
          <div className="flex-1">
            <div className="font-medium text-foreground">
              {bankStatus.bankName || 'STRIPE TEST BANK'} ••••{bankStatus.last4 || '2227'}
            </div>
            <div className="text-sm text-muted-foreground">
              {bankStatus.isVerified ? 'Verification complete' : 'Verification pending'}
            </div>
          </div>
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            bankStatus.isVerified
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
          }`}>
            {bankStatus.isVerified ? 'Verified' : 'Pending'}
          </div>
          </div>
        )}

        {/* Connect Button */}
        <Button
          onClick={handleConnectBank}
          disabled={loading}
          className="w-full"
          variant={bankStatus.isConnected ? "outline" : "default"}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {bankStatus.isConnected ? 'Updating...' : 'Connecting...'}
            </>
          ) : (
            bankStatus.isConnected ? 'Edit Bank Connection' : 'Add Bank Account'
          )}
        </Button>
      </>
    )}
    </div>
  );
};

export default SimpleBankAccountManager;
