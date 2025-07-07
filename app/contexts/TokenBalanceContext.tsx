'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { useFeatureFlag } from '../utils/feature-flags';

interface TokenBalance {
  totalTokens: number;
  allocatedTokens: number;
  availableTokens: number;
}

interface TokenBalanceContextType {
  tokenBalance: TokenBalance | null;
  isLoading: boolean;
  refreshTokenBalance: () => Promise<void>;
  lastUpdated: Date | null;
}

const TokenBalanceContext = createContext<TokenBalanceContextType | undefined>(undefined);

export function TokenBalanceProvider({ children }: { children: React.ReactNode }) {
  const { currentAccount } = useCurrentAccount();
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const paymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  const fetchTokenBalance = useCallback(async () => {
    if (!currentAccount?.uid || !paymentsEnabled) {
      setTokenBalance(null);
      setLastUpdated(null);
      return;
    }

    setIsLoading(true);
    try {
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
          setLastUpdated(new Date());
        } else if (data.balance) {
          // Ensure consistent calculation of available tokens
          const availableTokens = data.balance.totalTokens - data.balance.allocatedTokens;
          setTokenBalance({
            totalTokens: data.balance.totalTokens,
            allocatedTokens: data.balance.allocatedTokens,
            availableTokens: availableTokens
          });
          setLastUpdated(new Date());
        } else {
          setTokenBalance(null);
          setLastUpdated(null);
        }
      } else {
        console.error('Failed to fetch token balance:', response.status);
        setTokenBalance(null);
        setLastUpdated(null);
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
      setTokenBalance(null);
      setLastUpdated(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount?.uid, paymentsEnabled]);

  // Initial load
  useEffect(() => {
    fetchTokenBalance();
  }, [fetchTokenBalance]);

  // Listen for custom events to refresh token balance
  useEffect(() => {
    const handleTokenAllocationChange = () => {
      fetchTokenBalance();
    };

    // Listen for custom events
    window.addEventListener('tokenAllocationChanged', handleTokenAllocationChange);

    return () => {
      window.removeEventListener('tokenAllocationChanged', handleTokenAllocationChange);
    };
  }, [fetchTokenBalance]);

  const refreshTokenBalance = useCallback(async () => {
    await fetchTokenBalance();
  }, [fetchTokenBalance]);

  const value: TokenBalanceContextType = {
    tokenBalance,
    isLoading,
    refreshTokenBalance,
    lastUpdated
  };

  return (
    <TokenBalanceContext.Provider value={value}>
      {children}
    </TokenBalanceContext.Provider>
  );
}

export function useTokenBalanceContext(): TokenBalanceContextType {
  const context = useContext(TokenBalanceContext);
  if (context === undefined) {
    throw new Error('useTokenBalanceContext must be used within a TokenBalanceProvider');
  }
  return context;
}

// Utility function to trigger token balance refresh across all components
export function triggerTokenBalanceRefresh() {
  window.dispatchEvent(new CustomEvent('tokenAllocationChanged'));
}
