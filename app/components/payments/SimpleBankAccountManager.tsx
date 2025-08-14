"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface BankAccountStatus {
  isConnected: boolean;
  isVerified: boolean;
  bankName?: string;
  last4?: string;
  accountType?: string;
}

interface SimpleBankAccountManagerProps {
  onUpdate?: () => void;
  showTitle?: boolean;
}

export const SimpleBankAccountManager: React.FC<SimpleBankAccountManagerProps> = ({
  onUpdate,
  showTitle = true
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
          isConnected: !!accountData?.bank_account,
          isVerified: accountData?.payouts_enabled || false,
          bankName: accountData?.bank_account?.bank_name,
          last4: accountData?.bank_account?.last4,
          accountType: accountData?.bank_account?.account_type
        });

        // Notify parent component of status change
        onUpdate?.();
      }
    } catch (error) {
      console.error('Error loading bank account status:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleConnectBank = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create Stripe Connect account link
      const response = await fetch('/api/stripe/create-account-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: bankStatus.isConnected ? 'account_update' : 'account_onboarding',
          return_url: `${window.location.origin}/settings/earnings?connected=true`,
          refresh_url: `${window.location.origin}/settings/earnings?refresh=true`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create account link');
      }

      const { url } = await response.json();

      // Redirect to Stripe Connect onboarding/management
      window.location.href = url;

    } catch (error) {
      console.error('Bank connection error:', error);
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

  // Show loading state while fetching initial bank status
  if (initialLoading) {
    return (
      <div className="space-y-4">
        {showTitle && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Bank Account</h2>
            <p className="text-sm text-muted-foreground">
              Connect your bank account to receive payouts.
            </p>
          </div>
        )}
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-muted-foreground">Loading bank account status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showTitle && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Bank Account</h2>
          <p className="text-sm text-muted-foreground">
            Connect your bank account to receive payouts.
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Bank Account Status */}
      {bankStatus.isConnected && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          {bankStatus.isVerified ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          )}
          <div className="flex-1">
            <div className="font-medium">
              {bankStatus.bankName || 'Bank Account'} ••••{bankStatus.last4}
            </div>
            <div className="text-sm text-muted-foreground">
              {bankStatus.isVerified ? 'Verified and ready for payouts' : 'Verification pending'}
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default SimpleBankAccountManager;
