'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';

interface BankSetupStatus {
  isSetup: boolean;
  loading: boolean;
  error: string | null;
}

export function useBankSetupStatus(): BankSetupStatus {
  const { currentAccount } = useCurrentAccount();
  const [status, setStatus] = useState<BankSetupStatus>({
    isSetup: false,
    loading: true,
    error: null
  });

  useEffect(() => {
    const checkBankSetupStatus = async () => {
      if (!currentAccount?.uid) {
        setStatus({ isSetup: false, loading: false, error: null });
        return;
      }

      // If no stripe connected account ID, bank is not set up
      if (!currentAccount.stripeConnectedAccountId) {
        setStatus({ isSetup: false, loading: false, error: null });
        return;
      }

      try {
        setStatus(prev => ({ ...prev, loading: true, error: null }));

        const response = await fetch('/api/stripe/account-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stripeConnectedAccountId: currentAccount.stripeConnectedAccountId
          })
        });

        if (response.ok) {
          const result = await response.json();
          const isSetup = result.data?.payouts_enabled || false;
          setStatus({ isSetup, loading: false, error: null });
        } else {
          setStatus({ isSetup: false, loading: false, error: 'Failed to check bank status' });
        }
      } catch (error) {
        console.error('Error checking bank setup status:', error);
        setStatus({ isSetup: false, loading: false, error: 'Error checking bank status' });
      }
    };

    checkBankSetupStatus();
  }, [currentAccount?.uid, currentAccount?.stripeConnectedAccountId]);

  return status;
}
