'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { centsToDollars, formatUsdCents } from '../utils/formatCurrency';
import { getCacheItem, setCacheItem, generateCacheKey } from '../utils/cacheUtils';

interface UsdBalance {
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
}

interface CachedUsdBalance {
  data: UsdBalance;
  timestamp: number;
  userId: string;
}

// Global cache for USD balance data - shared across all components
const usdBalanceCache = new Map<string, CachedUsdBalance>();
const CACHE_DURATION = 30 * 60 * 1000; // 🚨 EMERGENCY: 30 minutes (was 5 minutes) to reduce financial API reads by 80%
const STALE_WHILE_REVALIDATE_DURATION = 5 * 60 * 1000; // 🚨 EMERGENCY: 5 minutes (was 30 seconds) for background refresh

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
  const fetchingRef = useRef<Promise<void> | null>(null);

  const fetchUsdBalance = useCallback(async (forceRefresh = false): Promise<void> => {
    if (!user?.uid) {
      console.log('[UsdBalanceContext] Skipping USD balance fetch:', {
        hasAccount: !!user?.uid
      });
      setUsdBalance(null);
      setLastUpdated(null);
      return;
    }

    // Check cache first
    const cached = usdBalanceCache.get(user.uid);
    const now = Date.now();

    if (!forceRefresh && cached && cached.userId === user.uid) {
      const age = now - cached.timestamp;

      // If cache is fresh, use it immediately
      if (age < CACHE_DURATION) {
        console.log('[UsdBalanceContext] ✅ Using fresh cached data (age: ' + Math.round(age / 1000) + 's)');
        setUsdBalance(cached.data);
        setLastUpdated(new Date(cached.timestamp));
        setIsLoading(false);
        return;
      }

      // If cache is stale but not too old, use it while revalidating
      if (age < CACHE_DURATION + STALE_WHILE_REVALIDATE_DURATION) {
        console.log('[UsdBalanceContext] 🔄 Using stale cached data while revalidating (age: ' + Math.round(age / 1000) + 's)');
        setUsdBalance(cached.data);
        setLastUpdated(new Date(cached.timestamp));
        setIsLoading(false);
        // Continue to fetch fresh data in background
      }
    }

    // 🚨 EMERGENCY: Check persistent cache if no memory cache (survives page refreshes)
    if (!forceRefresh && !cached) {
      const persistentCacheKey = generateCacheKey('usd_balance', user.uid);
      const persistentCached = getCacheItem<UsdBalance>(persistentCacheKey);
      if (persistentCached) {
        console.log('[UsdBalanceContext] 💾 Using persistent cached USD balance');
        setUsdBalance(persistentCached);
        setIsLoading(false);
        setLastUpdated(new Date());

        // Also update memory cache
        usdBalanceCache.set(user.uid, {
          data: persistentCached,
          timestamp: Date.now(),
          userId: user.uid
        });
        return;
      }
    }

    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) {
      return fetchingRef.current;
    }

    const fetchPromise = (async () => {
      try {
        if (!cached || forceRefresh) {
          setIsLoading(true);
        }

        console.log('[UsdBalanceContext] Fetching fresh USD balance for user:', user.uid);

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

          // Cache the result in memory
          usdBalanceCache.set(user.uid, {
            data: balance,
            timestamp: now,
            userId: user.uid
          });

          // 🚨 EMERGENCY: Also save to persistent cache (survives page refreshes)
          const persistentCacheKey = generateCacheKey('usd_balance', user.uid);
          setCacheItem(persistentCacheKey, balance, CACHE_DURATION);

          console.log('[UsdBalanceContext] Updated USD balance:', {
            total: formatUsdCents(balance.totalUsdCents),
            allocated: formatUsdCents(balance.allocatedUsdCents),
            available: formatUsdCents(balance.availableUsdCents)
          });
        } else {
          console.log('[UsdBalanceContext] No USD balance found in response');

          // If we have cached data, keep using it on no data response
          if (!cached) {
            setUsdBalance(null);
          }
        }
      } catch (error) {
        console.error('[UsdBalanceContext] Error fetching USD balance:', error);

        // If we have cached data, keep using it on error
        if (!cached) {
          setUsdBalance(null);
        }
      } finally {
        setIsLoading(false);
        fetchingRef.current = null;
      }
    })();

    fetchingRef.current = fetchPromise;
    return fetchPromise;
  }, [user?.uid]);

  const refreshUsdBalance = useCallback(async () => {
    console.log('[UsdBalanceContext] Force refreshing USD balance');
    await fetchUsdBalance(true);
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
