'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';

interface TokenBalance {
  totalTokens: number;
  allocatedTokens: number;
  availableTokens: number;
}

export function useTokenBalance(): TokenBalance | null {
  const { currentAccount } = useCurrentAccount();
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);

  useEffect(() => {
    const loadTokenBalance = async () => {
      if (!currentAccount?.uid) {
        setTokenBalance(null);
        return;
      }

      try {
        // Fetch token balance from the real API (same as header)
        const response = await fetch('/api/tokens/balance');
        if (response.ok) {
          const data = await response.json();

          if (data.summary) {
            // Ensure consistent calculation of available tokens
            const availableTokens = data.summary.totalTokens - data.summary.allocatedTokens;
            setTokenBalance({
              totalTokens: data.summary.totalTokens,
              allocatedTokens: data.summary.allocatedTokens,
              availableTokens: availableTokens
            });
          } else if (data.balance) {
            // Ensure consistent calculation of available tokens
            const availableTokens = data.balance.totalTokens - data.balance.allocatedTokens;
            setTokenBalance({
              totalTokens: data.balance.totalTokens,
              allocatedTokens: data.balance.allocatedTokens,
              availableTokens: availableTokens
            });
          } else {
            setTokenBalance(null);
          }
        } else {
          console.error('Failed to fetch token balance:', response.status);
          setTokenBalance(null);
        }
      } catch (error) {
        console.error('Error loading token balance:', error);
        setTokenBalance(null);
      }
    };

    loadTokenBalance();
  }, [currentAccount?.uid]);

  return tokenBalance;
}
