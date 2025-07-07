'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { useFeatureFlag } from '../utils/feature-flags';

interface UserEarnings {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  hasEarnings: boolean;
}

export function useUserEarnings(): { earnings: UserEarnings | null; loading: boolean; error: string | null } {
  const { currentAccount } = useCurrentAccount();
  const [earnings, setEarnings] = useState<UserEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  useEffect(() => {
    const fetchEarnings = async () => {
      if (!currentAccount?.uid || !paymentsEnabled) {
        setEarnings(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/earnings/user');
        
        if (!response.ok) {
          if (response.status === 404) {
            // No earnings data found - user has no earnings
            setEarnings({
              totalEarnings: 0,
              availableBalance: 0,
              pendingBalance: 0,
              hasEarnings: false
            });
          } else {
            throw new Error('Failed to fetch earnings');
          }
        } else {
          const data = await response.json();
          
          if (data.success && data.earnings) {
            const totalEarnings = data.earnings.totalEarnings || 0;
            const availableBalance = data.earnings.availableBalance || 0;
            const pendingBalance = data.earnings.pendingBalance || 0;
            
            setEarnings({
              totalEarnings,
              availableBalance,
              pendingBalance,
              hasEarnings: totalEarnings > 0 || availableBalance > 0 || pendingBalance > 0
            });
          } else {
            // No earnings data
            setEarnings({
              totalEarnings: 0,
              availableBalance: 0,
              pendingBalance: 0,
              hasEarnings: false
            });
          }
        }
      } catch (err) {
        console.error('Error fetching user earnings:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch earnings');
        setEarnings(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, [currentAccount?.uid, paymentsEnabled]);

  return { earnings, loading, error };
}
