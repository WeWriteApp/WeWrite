'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { formatUsdCents } from '../utils/formatCurrency';
import { UsdDataService, type UsdBalance } from '../services/usdDataService';
import { usdBalanceCache } from '../utils/financialDataCache';
import { useSubscription } from './SubscriptionContext';
import { useShouldUseDemoBalance } from './DemoBalanceContext';
import { createNotification } from '../services/notificationsService';
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
        // Uses localStorage to prevent duplicate notifications during rapid re-renders
        try {
          if (balanceData && balanceData.totalUsdCents > 0) {
            const allocationRatio = balanceData.allocatedUsdCents / balanceData.totalUsdCents;
            const monthKey = `${user.uid}_${getCurrentMonth()}`;
            const percentage = Math.round(allocationRatio * 100);

            if (allocationRatio >= 0.9) {
              const alreadyNotifiedKey = localStorage.getItem('wewrite_notified_90_key');
              const lastNotifiedTime = localStorage.getItem('wewrite_notified_90_timestamp');
              const now = Date.now();

              // Only create notification if:
              // 1. Haven't notified for this month yet
              // 2. AND last notification was more than 1 hour ago (prevent rapid duplicates during re-renders)
              const shouldNotify = alreadyNotifiedKey !== monthKey &&
                (!lastNotifiedTime || (now - parseInt(lastNotifiedTime)) > 60 * 60 * 1000);

              if (shouldNotify) {
                const allocatedFormatted = formatUsdCents(balanceData.allocatedUsdCents);
                const totalFormatted = formatUsdCents(balanceData.totalUsdCents);

                await createNotification({
                  userId: user.uid,
                  type: 'allocation_threshold',
                  title: `${percentage}% of monthly funds allocated`,
                  message: `You've allocated ${allocatedFormatted} of ${totalFormatted}. Top off your account or adjust allocations to keep supporting pages.`,
                  criticality: 'normal',
                  actionUrl: '/settings/fund-account',
                  metadata: {
                    allocatedUsdCents: balanceData.allocatedUsdCents,
                    totalUsdCents: balanceData.totalUsdCents,
                    threshold: 0.9,
                    percentage,
                    month: getCurrentMonth()
                  }
                });
                localStorage.setItem('wewrite_notified_90', 'true');
                localStorage.setItem('wewrite_notified_90_key', monthKey);
                localStorage.setItem('wewrite_notified_90_timestamp', now.toString());
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
