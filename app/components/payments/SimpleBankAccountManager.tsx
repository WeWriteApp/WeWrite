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
  // Enhanced status information
  detailsSubmitted?: boolean;
  payoutsEnabled?: boolean;
  requiresAction?: boolean;
  requirements?: {
    currently_due?: string[];
    pending_verification?: string[];
    past_due?: string[];
  };
  accountStatus?: 'none' | 'pending' | 'verified' | 'requires_action' | 'restricted';
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
    isVerified: false,
    accountStatus: 'none'
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

        // Determine account status based on Stripe data
        let accountStatus: BankAccountStatus['accountStatus'] = 'none';
        const hasRequirements = accountData?.requirements?.currently_due?.length > 0;
        const hasPendingVerification = accountData?.requirements?.pending_verification?.length > 0;

        if (accountData?.bankAccount) {
          if (accountData.payouts_enabled) {
            accountStatus = 'verified';
          } else if (hasRequirements) {
            accountStatus = 'requires_action';
          } else if (accountData.details_submitted || hasPendingVerification) {
            accountStatus = 'pending';
          } else {
            accountStatus = 'pending';
          }
        }

        setBankStatus({
          isConnected: !!accountData?.bankAccount,
          isVerified: accountData?.payouts_enabled || false,
          bankName: accountData?.bankAccount?.bankName,
          last4: accountData?.bankAccount?.last4,
          accountType: accountData?.bankAccount?.accountType,
          detailsSubmitted: accountData?.details_submitted || false,
          payoutsEnabled: accountData?.payouts_enabled || false,
          requiresAction: hasRequirements,
          requirements: accountData?.requirements,
          accountStatus
        });

        onUpdate?.();
      } else {
        // Handle case where account exists but needs setup
        const errorData = await response.json();
        if (errorData.needsSetup) {
          setBankStatus({
            isConnected: false,
            isVerified: false,
            accountStatus: 'none'
          });
        }
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
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 bg-muted/30 dark:bg-muted/20 rounded-lg border border-border/50">
                <div className="flex-1">
                  <div className="font-medium text-foreground">
                    {bankStatus.bankName || 'STRIPE TEST BANK'} ••••{bankStatus.last4 || '2227'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getStatusDescription(bankStatus)}
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeStyle(bankStatus)}`}>
                  {getStatusLabel(bankStatus)}
                </div>
              </div>

              {/* Requirements/Action needed */}
              {bankStatus.accountStatus === 'requires_action' && bankStatus.requirements?.currently_due && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-medium">Action Required</div>
                      <div className="text-sm">
                        Stripe needs additional information to verify your account:
                      </div>
                      <ul className="text-sm list-disc list-inside space-y-1">
                        {bankStatus.requirements.currently_due.map((req, index) => (
                          <li key={index}>{formatRequirement(req)}</li>
                        ))}
                      </ul>
                      <div className="text-sm font-medium">
                        Click "Continue Setup" below to provide this information.
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Pending verification */}
              {bankStatus.accountStatus === 'pending' && bankStatus.requirements?.pending_verification && (
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-medium">Verification in Progress</div>
                      <div className="text-sm">
                        Stripe is reviewing your information. This usually takes 1-2 business days.
                      </div>
                      {bankStatus.requirements.pending_verification.length > 0 && (
                        <div className="text-sm">
                          Currently reviewing: {bankStatus.requirements.pending_verification.map(formatRequirement).join(', ')}
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

        {/* Connect Button */}
        <Button
          onClick={handleConnectBank}
          disabled={loading}
          className="w-full"
          variant={getButtonVariant(bankStatus)}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {getLoadingText(bankStatus)}
            </>
          ) : (
            getButtonText(bankStatus)
          )}
        </Button>
      </>
    )}
    </div>
  );
};

// Helper functions for status display
function getStatusDescription(status: BankAccountStatus): string {
  switch (status.accountStatus) {
    case 'verified':
      return 'Verification complete - ready to receive payouts';
    case 'requires_action':
      return 'Additional information required for verification';
    case 'pending':
      return 'Verification in progress - usually takes 1-2 business days';
    default:
      return 'Not connected';
  }
}

function getStatusLabel(status: BankAccountStatus): string {
  switch (status.accountStatus) {
    case 'verified':
      return 'Verified';
    case 'requires_action':
      return 'Action Required';
    case 'pending':
      return 'Pending';
    default:
      return 'Not Connected';
  }
}

function getStatusBadgeStyle(status: BankAccountStatus): string {
  switch (status.accountStatus) {
    case 'verified':
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    case 'requires_action':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    case 'pending':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getButtonText(status: BankAccountStatus): string {
  switch (status.accountStatus) {
    case 'verified':
      return 'Edit Bank Connection';
    case 'requires_action':
      return 'Continue Setup';
    case 'pending':
      return 'Update Information';
    default:
      return 'Add Bank Account';
  }
}

function getButtonVariant(status: BankAccountStatus): "default" | "outline" | "destructive" {
  switch (status.accountStatus) {
    case 'verified':
      return 'outline';
    case 'requires_action':
      return 'destructive';
    case 'pending':
      return 'outline';
    default:
      return 'default';
  }
}

function getLoadingText(status: BankAccountStatus): string {
  switch (status.accountStatus) {
    case 'verified':
      return 'Updating...';
    case 'requires_action':
      return 'Continuing setup...';
    case 'pending':
      return 'Updating...';
    default:
      return 'Connecting...';
  }
}

function formatRequirement(requirement: string): string {
  // Convert Stripe requirement codes to user-friendly text
  const requirementMap: Record<string, string> = {
    'individual.id_number': 'Government-issued ID number',
    'individual.ssn_last_4': 'Last 4 digits of Social Security Number',
    'individual.verification.document': 'Identity verification document',
    'individual.verification.additional_document': 'Additional identity document',
    'business.tax_id': 'Business tax ID',
    'business.verification.document': 'Business verification document',
    'tos_acceptance.date': 'Terms of service acceptance',
    'tos_acceptance.ip': 'Terms of service IP confirmation',
    'external_account': 'Bank account information',
    'document': 'Identity verification document'
  };

  return requirementMap[requirement] || requirement.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default SimpleBankAccountManager;
