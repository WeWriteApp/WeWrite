'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';

interface BankSetupStatus {
  isSetup: boolean;
  loading: boolean;
  error: string | null;
}

export function useBankSetupStatus(): BankSetupStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<BankSetupStatus>({
    isSetup: false,
    loading: true,
    error: null
  });

  useEffect(() => {
    const checkBankSetupStatus = async () => {
      if (!user?.uid) {
        setStatus({ isSetup: false, loading: false, error: null });
        return;
      }

      try {
        setStatus(prev => ({ ...prev, loading: true, error: null }));

        const response = await fetch('/api/stripe/account-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid
          })
        });

        if (response.ok) {
          const result = await response.json();
          const isSetup = result.data?.payouts_enabled || false;
          setStatus({ isSetup, loading: false, error: null });
        } else {
          // If the API returns an error (like no bank account found), that means not set up
          setStatus({ isSetup: false, loading: false, error: null });
        }
      } catch (error) {
        console.error('Error checking bank setup status:', error);
        setStatus({ isSetup: false, loading: false, error: 'Error checking bank status' });
      }
    };

    checkBankSetupStatus();
  }, [user?.uid]);

  return status;
}
