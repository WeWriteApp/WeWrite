'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { formatUsdCents } from '../utils/formatCurrency';
import { UsdDataService, type UsdBalance, type SubscriptionData, type EarningsData } from '../services/usdDataService';

/**
 * Optimized Financial Context
 * 
 * Consolidates all financial data fetching into a single API call to reduce redundancy.
 * This replaces the separate UsdBalanceContext, SubscriptionContext, and EarningsContext
 * for better performance and reduced database calls.
 */

interface OptimizedFinancialContextType {
  // Balance data
  usdBalance: UsdBalance | null;
  
  // Subscription data
  subscription: SubscriptionData | null;
  hasActiveSubscription: boolean;
  subscriptionAmount: number;
  
  // Earnings data
  earnings: EarningsData | null;
  hasEarnings: boolean;
  
  // Loading states
  isLoading: boolean;
  lastUpdated: Date | null;
  
  // Actions
  refreshAllData: () => Promise<void>;
  updateOptimisticBalance: (changeCents: number) => void;
  
  // Helper methods
  getTotalUsdFormatted: () => string;
  getAvailableUsdFormatted: () => string;
  getAllocatedUsdFormatted: () => string;
  getFormattedTotalEarnings: () => string;
  getFormattedAvailableBalance: () => string;
}

const OptimizedFinancialContext = createContext<OptimizedFinancialContextType | undefined>(undefined);

export function OptimizedFinancialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // State for all financial data
  const [usdBalance, setUsdBalance] = useState<UsdBalance | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [hasEarnings, setHasEarnings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const fetchingRef = useRef<Promise<void> | null>(null);
  const cacheRef = useRef<{ data: any; timestamp: number } | null>(null);
  
  // Cache TTL: 5 minutes for consolidated data
  const CACHE_TTL = 5 * 60 * 1000;

  /**
   * Fetch all financial data in a single API call
   */
  const fetchAllFinancialData = useCallback(async (forceRefresh = false): Promise<void> => {
    // Handle logged out users
    if (!user?.uid) {
      setUsdBalance(null);
      setSubscription(null);
      setHasActiveSubscription(false);
      setEarnings(null);
      setHasEarnings(false);
      setLastUpdated(new Date());
      return;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh && cacheRef.current) {
      const { data, timestamp } = cacheRef.current;
      if (Date.now() - timestamp < CACHE_TTL) {
        console.log('[OptimizedFinancialContext] Using cached data');
        setUsdBalance(data.balance);
        setSubscription(data.subscription);
        setHasActiveSubscription(data.hasActiveSubscription);
        setEarnings(data.earnings);
        setHasEarnings(data.earnings?.hasEarnings || false);
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
        
        const result = await UsdDataService.fetchAllFinancialData();
        
        if (!result.success) {
          console.warn('[OptimizedFinancialContext] Financial data fetch failed:', result.error);
          return;
        }

        const data = result.data;
        if (!data) return;

        // Update all state at once
        setUsdBalance(data.balance);
        setSubscription(data.subscription);
        setHasActiveSubscription(data.hasActiveSubscription);
        setEarnings(data.earnings);
        setHasEarnings(data.earnings?.hasEarnings || false);
        setLastUpdated(new Date());

        // Cache the result
        cacheRef.current = {
          data,
          timestamp: Date.now()
        };

        console.log('[OptimizedFinancialContext] All financial data updated');
      } catch (error) {
        console.error('[OptimizedFinancialContext] Error fetching financial data:', error);
      } finally {
        setIsLoading(false);
        fetchingRef.current = null;
      }
    })();

    fetchingRef.current = fetchPromise;
    return fetchPromise;
  }, [user?.uid]);

  /**
   * Refresh all financial data (force refresh)
   */
  const refreshAllData = useCallback(async (): Promise<void> => {
    return fetchAllFinancialData(true);
  }, [fetchAllFinancialData]);

  /**
   * Update balance optimistically
   */
  const updateOptimisticBalance = useCallback((changeCents: number) => {
    if (!usdBalance) return;

    setUsdBalance(prevBalance => {
      if (!prevBalance) return null;
      
      const newAllocated = Math.max(0, prevBalance.allocatedUsdCents + changeCents);
      const newAvailable = Math.max(0, prevBalance.totalUsdCents - newAllocated);
      
      return {
        ...prevBalance,
        allocatedUsdCents: newAllocated,
        availableUsdCents: newAvailable
      };
    });
  }, [usdBalance]);

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

  const getFormattedTotalEarnings = useCallback(() => {
    return earnings ? `$${(earnings.totalEarnings / 100).toFixed(2)}` : '$0.00';
  }, [earnings]);

  const getFormattedAvailableBalance = useCallback(() => {
    return earnings ? `$${(earnings.availableBalance / 100).toFixed(2)}` : '$0.00';
  }, [earnings]);

  // Fetch data when user changes
  useEffect(() => {
    fetchAllFinancialData();
  }, [fetchAllFinancialData]);

  const contextValue: OptimizedFinancialContextType = {
    usdBalance,
    subscription,
    hasActiveSubscription,
    subscriptionAmount: subscription?.amount || 0,
    earnings,
    hasEarnings,
    isLoading,
    lastUpdated,
    refreshAllData,
    updateOptimisticBalance,
    getTotalUsdFormatted,
    getAvailableUsdFormatted,
    getAllocatedUsdFormatted,
    getFormattedTotalEarnings,
    getFormattedAvailableBalance
  };

  return (
    <OptimizedFinancialContext.Provider value={contextValue}>
      {children}
    </OptimizedFinancialContext.Provider>
  );
}

/**
 * Hook to use optimized financial context
 */
export function useOptimizedFinancial(): OptimizedFinancialContextType {
  const context = useContext(OptimizedFinancialContext);
  if (context === undefined) {
    throw new Error('useOptimizedFinancial must be used within an OptimizedFinancialProvider');
  }
  return context;
}
