'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { centsToDollars, formatUsdCents } from '../utils/formatCurrency';

interface UsdBalance {
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
}

interface UsdBalanceContextType {
  usdBalance: UsdBalance | null;
  isLoading: boolean;
  refreshUsdBalance: () => Promise<void>;
  updateOptimisticBalance: (changeCents: number) => void;
  lastUpdated: Date | null;
  // Helper methods for display
  getTotalUsdFormatted: () => string;
  getAvailableUsdFormatted: () => string;
  getAllocatedUsdFormatted: () => string;
}

const UsdBalanceContext = createContext<UsdBalanceContextType | undefined>(undefined);

export function UsdBalanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [usdBalance, setUsdBalance] = useState<UsdBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchUsdBalance = useCallback(async () => {
    if (!user?.uid) {
      console.log('[UsdBalanceContext] Skipping USD balance fetch:', {
        hasAccount: !!user?.uid
      });
      setUsdBalance(null);
      setLastUpdated(null);
      return;
    }

    // Prevent excessive API calls - only fetch if it's been more than 10 seconds
    const now = Date.now();
    const lastFetchTime = lastUpdated?.getTime() || 0;
    const timeSinceLastFetch = now - lastFetchTime;

    if (timeSinceLastFetch < 10000 && usdBalance) {
      console.log('[UsdBalanceContext] Skipping fetch - too recent:', timeSinceLastFetch + 'ms ago');
      return;
    }

    console.log('[UsdBalanceContext] Fetching USD balance for user:', user.uid);
    setIsLoading(true);

    try {
      const response = await fetch('/api/usd/balance', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('[UsdBalanceContext] User not authenticated');
          setUsdBalance(null);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[UsdBalanceContext] Received USD balance data:', data);

      if (data.balance) {
        const balance: UsdBalance = {
          totalUsdCents: data.balance.totalUsdCents || 0,
          allocatedUsdCents: data.balance.allocatedUsdCents || 0,
          availableUsdCents: data.balance.availableUsdCents || 0,
        };
        setUsdBalance(balance);
        setLastUpdated(new Date());
        console.log('[UsdBalanceContext] Updated USD balance:', {
          total: formatUsdCents(balance.totalUsdCents),
          allocated: formatUsdCents(balance.allocatedUsdCents),
          available: formatUsdCents(balance.availableUsdCents)
        });
      } else {
        console.log('[UsdBalanceContext] No USD balance found in response');
        setUsdBalance(null);
      }
    } catch (error) {
      console.error('[UsdBalanceContext] Error fetching USD balance:', error);
      // Don't clear existing balance on error, just log it
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, lastUpdated, usdBalance]);

  const refreshUsdBalance = useCallback(async () => {
    console.log('[UsdBalanceContext] Force refreshing USD balance');
    setLastUpdated(null); // Reset to force fetch
    await fetchUsdBalance();
  }, [fetchUsdBalance]);

  const updateOptimisticBalance = useCallback((changeCents: number) => {
    console.log('[UsdBalanceContext] Optimistic balance update:', {
      changeCents,
      changeFormatted: formatUsdCents(Math.abs(changeCents)),
      direction: changeCents > 0 ? 'increase' : 'decrease'
    });
    
    setUsdBalance(prev => {
      if (!prev) return null;
      
      const newAllocatedCents = Math.max(0, prev.allocatedUsdCents + changeCents);
      const newAvailableCents = prev.totalUsdCents - newAllocatedCents;
      
      return {
        ...prev,
        allocatedUsdCents: newAllocatedCents,
        availableUsdCents: newAvailableCents
      };
    });
  }, []);

  // Helper methods for formatted display
  const getTotalUsdFormatted = useCallback(() => {
    return usdBalance ? formatUsdCents(usdBalance.totalUsdCents) : '$0.00';
  }, [usdBalance]);

  const getAvailableUsdFormatted = useCallback(() => {
    return usdBalance ? formatUsdCents(usdBalance.availableUsdCents) : '$0.00';
  }, [usdBalance]);

  const getAllocatedUsdFormatted = useCallback(() => {
    return usdBalance ? formatUsdCents(usdBalance.allocatedUsdCents) : '$0.00';
  }, [usdBalance]);

  // Fetch balance when user changes
  useEffect(() => {
    fetchUsdBalance();
  }, [fetchUsdBalance]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!user?.uid) return;

    const interval = setInterval(() => {
      console.log('[UsdBalanceContext] Auto-refreshing USD balance');
      fetchUsdBalance();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user?.uid, fetchUsdBalance]);

  const contextValue: UsdBalanceContextType = {
    usdBalance,
    isLoading,
    refreshUsdBalance,
    updateOptimisticBalance,
    lastUpdated,
    getTotalUsdFormatted,
    getAvailableUsdFormatted,
    getAllocatedUsdFormatted
  };

  return (
    <UsdBalanceContext.Provider value={contextValue}>
      {children}
    </UsdBalanceContext.Provider>
  );
}

export function useUsdBalance() {
  const context = useContext(UsdBalanceContext);
  if (context === undefined) {
    throw new Error('useUsdBalance must be used within a UsdBalanceProvider');
  }
  return context;
}

// Legacy hook for backward compatibility during migration
/**
 * @deprecated Use useUsdBalance instead
 */
export function useTokenBalance() {
  const usdContext = useUsdBalance();
  
  // Convert USD balance to token format for backward compatibility
  const tokenBalance = usdContext.usdBalance ? {
    totalTokens: Math.floor(centsToDollars(usdContext.usdBalance.totalUsdCents) * 10),
    allocatedTokens: Math.floor(centsToDollars(usdContext.usdBalance.allocatedUsdCents) * 10),
    availableTokens: Math.floor(centsToDollars(usdContext.usdBalance.availableUsdCents) * 10)
  } : null;

  return {
    tokenBalance,
    isLoading: usdContext.isLoading,
    refreshTokenBalance: usdContext.refreshUsdBalance,
    updateOptimisticBalance: (tokenChange: number) => {
      // Convert token change to USD cents change
      const usdCentsChange = Math.floor(tokenChange / 10 * 100);
      usdContext.updateOptimisticBalance(usdCentsChange);
    },
    lastUpdated: usdContext.lastUpdated
  };
}
