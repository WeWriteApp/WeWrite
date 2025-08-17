'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { UsdDataService, type EarningsData } from '../services/usdDataService';
import { earningsCache } from '../utils/simplifiedCache';

/**
 * Earnings Context
 * 
 * Handles earnings data separately from balance and subscription data.
 * Provides earnings state, caching, and refresh functionality.
 */

interface EarningsContextType {
  // Earnings data
  earnings: EarningsData | null;
  hasEarnings: boolean;
  isLoading: boolean;
  lastUpdated: Date | null;
  
  // Actions
  refreshEarnings: () => Promise<void>;
  
  // Helper methods
  getTotalEarnings: () => number;
  getAvailableBalance: () => number;
  getPendingBalance: () => number;
  getFormattedTotalEarnings: () => string;
  getFormattedAvailableBalance: () => string;
  getFormattedPendingBalance: () => string;
}

const EarningsContext = createContext<EarningsContextType | undefined>(undefined);

export function EarningsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [hasEarnings, setHasEarnings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchingRef = useRef<Promise<void> | null>(null);

  /**
   * Fetch earnings data from API or cache
   */
  const fetchEarnings = useCallback(async (forceRefresh = false): Promise<void> => {
    console.log('[EarningsContext] fetchEarnings called', { userId: user?.uid, forceRefresh });

    // Handle logged out users
    if (!user?.uid) {
      console.log('[EarningsContext] No user, clearing earnings');
      setEarnings(null);
      setHasEarnings(false);
      setLastUpdated(new Date());
      return;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = earningsCache.get(user.uid);
      if (cached) {
        console.log('[EarningsContext] Using cached data:', cached);
        setEarnings(cached);
        setHasEarnings(cached.hasEarnings || false);
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
        console.log('[EarningsContext] Starting API call to fetchEarnings');
        setIsLoading(true);

        const result = await UsdDataService.fetchEarnings();
        console.log('[EarningsContext] API call result:', result);

        if (!result.success) {
          if (UsdDataService.isAuthenticationError(result.status)) {

            setEarnings(null);
            setHasEarnings(false);
            return;
          }
          
          console.warn('[EarningsContext] Earnings fetch failed:', result.error);
          // Don't clear existing data on API errors, just log the warning
          return;
        }

        const earningsData = result.data;
        const hasEarningsData = earningsData?.hasEarnings || false;

        setEarnings(earningsData);
        setHasEarnings(hasEarningsData);
        setLastUpdated(new Date());

        // Cache the result
        if (earningsData) {
          earningsCache.set(user.uid, earningsData);
        }



      } catch (error) {
        console.error('[EarningsContext] Fetch error:', error);
      } finally {
        setIsLoading(false);
        fetchingRef.current = null;
      }
    })();

    fetchingRef.current = fetchPromise;
    return fetchPromise;
  }, [user?.uid]);

  /**
   * Refresh earnings data (force refresh from API)
   */
  const refreshEarnings = useCallback(async (): Promise<void> => {
    return fetchEarnings(true);
  }, [fetchEarnings]);

  /**
   * Get total earnings in cents
   */
  const getTotalEarnings = useCallback((): number => {
    return earnings?.totalEarnings || 0;
  }, [earnings]);

  /**
   * Get available balance in cents
   */
  const getAvailableBalance = useCallback((): number => {
    return earnings?.availableBalance || 0;
  }, [earnings]);

  /**
   * Get pending balance in cents
   */
  const getPendingBalance = useCallback((): number => {
    return earnings?.pendingBalance || 0;
  }, [earnings]);

  /**
   * Get formatted total earnings
   */
  const getFormattedTotalEarnings = useCallback((): string => {
    const cents = getTotalEarnings();
    return `$${(cents / 100).toFixed(2)}`;
  }, [getTotalEarnings]);

  /**
   * Get formatted available balance
   */
  const getFormattedAvailableBalance = useCallback((): string => {
    const cents = getAvailableBalance();
    return `$${(cents / 100).toFixed(2)}`;
  }, [getAvailableBalance]);

  /**
   * Get formatted pending balance
   */
  const getFormattedPendingBalance = useCallback((): string => {
    const cents = getPendingBalance();
    return `$${(cents / 100).toFixed(2)}`;
  }, [getPendingBalance]);

  // Fetch earnings when user changes
  useEffect(() => {
    console.log('[EarningsContext] useEffect triggered, user:', user?.uid);
    // Clear cache and force refresh to get fresh data
    if (user?.uid) {
      earningsCache.clear(user.uid);
    }
    fetchEarnings(true);
  }, [fetchEarnings]);

  const contextValue: EarningsContextType = {
    earnings,
    hasEarnings,
    isLoading,
    lastUpdated,
    refreshEarnings,
    getTotalEarnings,
    getAvailableBalance,
    getPendingBalance,
    getFormattedTotalEarnings,
    getFormattedAvailableBalance,
    getFormattedPendingBalance
  };

  return (
    <EarningsContext.Provider value={contextValue}>
      {children}
    </EarningsContext.Provider>
  );
}

export function useEarnings() {
  const context = useContext(EarningsContext);
  if (context === undefined) {
    throw new Error('useEarnings must be used within an EarningsProvider');
  }
  return context;
}
