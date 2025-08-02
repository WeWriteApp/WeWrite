'use client';

/**
 * @deprecated This context is deprecated and will be removed in a future version.
 * Use UsdBalanceContext instead for USD-based balance management.
 *
 * Legacy token balance context - replaced by USD system.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';

interface TokenBalance {
  totalTokens: number;
  allocatedTokens: number;
  availableTokens: number;
}

interface TokenBalanceContextType {
  tokenBalance: TokenBalance | null;
  isLoading: boolean;
  refreshTokenBalance: () => Promise<void>;
  updateOptimisticBalance: (change: number) => void;
  lastUpdated: Date | null;
}

const TokenBalanceContext = createContext<TokenBalanceContextType | undefined>(undefined);

export function TokenBalanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);


  const fetchTokenBalance = useCallback(async () => {
    if (!user?.uid) {
      console.log('[TokenBalanceContext] Skipping token balance fetch:', {
        hasAccount: !!user?.uid
      });
      setTokenBalance(null);
      setLastUpdated(null);
      return;
    }

    // Prevent excessive API calls - only fetch if it's been more than 10 seconds
    const now = Date.now();
    const lastFetchTime = lastUpdated?.getTime() || 0;
    const timeSinceLastFetch = now - lastFetchTime;

    if (timeSinceLastFetch < 10000 && tokenBalance) {
      console.log('[TokenBalanceContext] Skipping fetch - too recent:', timeSinceLastFetch + 'ms ago');
      return;
    }

    console.log('[TokenBalanceContext] Fetching token balance for user:', user.uid);
    setIsLoading(true);
    try {
      const response = await fetch('/api/tokens/balance');
      console.log('[TokenBalanceContext] Token balance API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[TokenBalanceContext] Token balance data received:', {
          hasBalance: !!data.balance,
          hasSummary: !!data.summary,
          totalTokens: data.balance?.totalTokens || data.summary?.totalTokens,
          allocatedTokens: data.balance?.allocatedTokens || data.summary?.allocatedTokens,
          availableTokens: data.balance?.availableTokens || data.summary?.availableTokens
        });

        if (data.summary) {
          // Prefer summary data as it's more accurate
          const availableTokens = data.summary.totalTokens - data.summary.allocatedTokens;
          const balance = {
            totalTokens: data.summary.totalTokens,
            allocatedTokens: data.summary.allocatedTokens,
            availableTokens: availableTokens
          };
          console.log('[TokenBalanceContext] Setting token balance from summary:', balance);
          setTokenBalance(balance);
          setLastUpdated(new Date());
        } else if (data.balance) {
          // Fall back to balance data
          const availableTokens = data.balance.totalTokens - data.balance.allocatedTokens;
          const balance = {
            totalTokens: data.balance.totalTokens,
            allocatedTokens: data.balance.allocatedTokens,
            availableTokens: availableTokens
          };
          console.log('[TokenBalanceContext] Setting token balance from balance:', balance);
          setTokenBalance(balance);
          setLastUpdated(new Date());
        } else {
          console.log('[TokenBalanceContext] No balance or summary data found');
          setTokenBalance(null);
          setLastUpdated(null);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[TokenBalanceContext] Failed to fetch token balance:', {
          status: response.status,
          error: errorData
        });
        setTokenBalance(null);
        setLastUpdated(null);
      }
    } catch (error) {
      console.error('[TokenBalanceContext] Error fetching token balance:', error);
      setTokenBalance(null);
      setLastUpdated(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

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

  // Update balance optimistically for immediate UI feedback
  const updateOptimisticBalance = useCallback((change: number) => {
    setTokenBalance(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        allocatedTokens: prev.allocatedTokens + change,
        availableTokens: prev.availableTokens - change
      };
    });
  }, []);

  const value: TokenBalanceContextType = {
    tokenBalance,
    isLoading,
    refreshTokenBalance,
    updateOptimisticBalance,
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
