'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { formatUsdCents } from '../utils/formatCurrency';
import { UsdDataService, type UsdBalance } from '../services/usdDataService';
import { usdBalanceCache } from '../utils/simplifiedCache';
import { useSubscription } from './SubscriptionContext';
import { useShouldUseDemoBalance } from './DemoBalanceContext';
import { createNotification } from '../services/notificationsApi';
import { getCurrentMonth } from '../utils/usdConstants';

/**
 * Simplified USD Balance Context
 *
 * Now focuses only on USD balance data, with subscription and earnings
 * handled by their dedicated contexts.
 */

interface UsdBalanceContextType {
  // Balance data (real balance only - demo balance handled by DemoBalanceContext)
  usdBalance: UsdBalance | null;
  isLoading: boolean;
  lastUpdated: Date | null;

  // Actions
  refreshUsdBalance: () => Promise<void>;
  updateOptimisticBalance: (changeCents: number) => void;

  // Helper methods for display
  getTotalUsdFormatted: () => string;
  getAvailableUsdFormatted: () => string;
  getAllocatedUsdFormatted: () => string;
}

const UsdBalanceContext = createContext<UsdBalanceContextType | undefined>(undefined);

export function UsdBalanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { hasActiveSubscription } = useSubscription();
  const shouldUseDemoBalance = useShouldUseDemoBalance(hasActiveSubscription);

  const [usdBalance, setUsdBalance] = useState<UsdBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchingRef = useRef<Promise<void> | null>(null);
  const notified90Ref = useRef<string | null>(null);

  const fetchUsdBalance = useCallback(async (forceRefresh = false): Promise<void> => {
    // Only fetch real balance for authenticated users with subscriptions
    if (!user?.uid || shouldUseDemoBalance) {
      // Clear any existing real balance data
      setUsdBalance(null);
      setLastUpdated(new Date());
      return;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = usdBalanceCache.get(user.uid);
      if (cached) {
        setUsdBalance(cached);
        setLastUpdated(new Date());
        console.log('[UsdBalanceContext] Using cached balance data');
        return;
      }
    }

    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) {
      return fetchingRef.current;
    }

    const fetchPromise = (async () => {
      try {
        setIsLoading(true);


        const result = await UsdDataService.fetchBalance();

        if (!result.success) {
          if (UsdDataService.isAuthenticationError(result.status)) {

            setUsdBalance(null);
            return;
          }


          // Don't clear existing data on API errors, just log the warning
          return;
        }

        const balanceData = result.data;
        setUsdBalance(balanceData);
        setLastUpdated(new Date());

        // Cache the result
        if (balanceData) {
          usdBalanceCache.set(user.uid, balanceData);
        }

        // Threshold notification: 90% allocation warning (once per month)
        try {
          if (balanceData && balanceData.totalUsdCents > 0) {
            const allocationRatio = balanceData.allocatedUsdCents / balanceData.totalUsdCents;
            const monthKey = `${user.uid}_${getCurrentMonth()}`;
            notified90Ref.current = notified90Ref.current || localStorage.getItem('wewrite_notified_90');

            if (allocationRatio >= 0.9) {
              const alreadyNotifiedKey = localStorage.getItem('wewrite_notified_90_key');
              if (alreadyNotifiedKey !== monthKey) {
                await createNotification({
                  userId: user.uid,
                  type: 'allocation_threshold',
                  title: 'You have used 90% of your monthly funds',
                  message: 'Top off or adjust allocations to keep supporting pages.',
                  criticality: 'normal',
                  metadata: {
                    allocatedUsdCents: balanceData.allocatedUsdCents,
                    totalUsdCents: balanceData.totalUsdCents,
                    threshold: 0.9,
                    month: getCurrentMonth()
                  }
                });
                localStorage.setItem('wewrite_notified_90', 'true');
                localStorage.setItem('wewrite_notified_90_key', monthKey);
              }
            }
          }
        } catch (notifyError) {
          console.warn('[UsdBalanceContext] Failed to emit 90% allocation notification:', notifyError);
        }



      } catch (error) {

      } finally {
        setIsLoading(false);
        fetchingRef.current = null;
      }
    })();

    fetchingRef.current = fetchPromise;
    return fetchPromise;
  }, [user?.uid, shouldUseDemoBalance]);

  /**
   * Refresh USD balance (force refresh from API)
   */
  const refreshUsdBalance = useCallback(async (): Promise<void> => {
    return fetchUsdBalance(true);
  }, [fetchUsdBalance]);

  /**
   * Update balance optimistically (for real balances only)
   * Demo balance optimistic updates are handled by DemoBalanceContext
   */
  const updateOptimisticBalance = useCallback((changeCents: number) => {
    // Only handle optimistic updates for real balances
    if (shouldUseDemoBalance) {
      return;
    }



    setUsdBalance(prev => {
      if (!prev) return null;

      const newAllocatedCents = Math.max(0, prev.allocatedUsdCents + changeCents);
      const newAvailableCents = prev.totalUsdCents - newAllocatedCents;

      // CRITICAL FIX: Allow over-allocation (overspending)
      // The system is designed to allow users to allocate more than their budget
      // Overspent amounts will be shown as orange "overspent" sections in allocation bars
      // Only reject truly impossible states (negative allocations)
      if (newAllocatedCents < 0) {
        return prev; // Return unchanged balance - can't have negative allocations
      }

      const newBalance = {
        ...prev,
        allocatedUsdCents: newAllocatedCents,
        availableUsdCents: newAvailableCents
      };

      // REMOVED: Force refresh that was causing layout shifts
      // The optimistic update is the source of truth, backend should follow UI
      // Only refresh on explicit user action or error recovery

      return newBalance;
    });
  }, [shouldUseDemoBalance, fetchUsdBalance]);

  // Helper methods for formatted display
  const getTotalUsdFormatted = useCallback(() => {
    return usdBalance ? formatUsdCents(usdBalance.totalUsdCents) : '$0.00';
  }, [usdBalance]);

  const getAvailableUsdFormatted = useCallback(() => {
    if (!usdBalance) return '$0.00';
    return usdBalance.availableUsdCents <= 0 ? 'Out' : formatUsdCents(usdBalance.availableUsdCents);
  }, [usdBalance]);

  const getAllocatedUsdFormatted = useCallback(() => {
    return usdBalance ? formatUsdCents(usdBalance.allocatedUsdCents) : '$0.00';
  }, [usdBalance]);

  // Fetch balance when user or subscription status changes
  useEffect(() => {
    fetchUsdBalance();
  }, [fetchUsdBalance]);

  const contextValue: UsdBalanceContextType = {
    usdBalance,
    isLoading,
    lastUpdated,
    refreshUsdBalance,
    updateOptimisticBalance,
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
