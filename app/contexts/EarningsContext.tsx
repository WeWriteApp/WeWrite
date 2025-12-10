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

// Fake earnings data for admin testing mode
const FAKE_EARNINGS_DATA: EarningsData = {
  totalEarnings: 21675, // $216.75 total
  availableBalance: 8925, // $89.25 available
  pendingBalance: 12750, // $127.50 pending
  hasEarnings: true,
  lastMonthEarnings: 4532, // $45.32 last month
  monthlyChange: 23.5 // 23.5% increase
};

export function EarningsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [hasEarnings, setHasEarnings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchingRef = useRef<Promise<void> | null>(null);

  // Admin earnings testing mode
  const [earningsTestingMode, setEarningsTestingMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wewrite_admin_earnings_testing_mode') === 'true';
    }
    return false;
  });

  // Listen for admin earnings testing mode changes
  useEffect(() => {
    const handleEarningsTestingChange = () => {
      const isEnabled = localStorage.getItem('wewrite_admin_earnings_testing_mode') === 'true';
      console.log('[EarningsContext] Earnings testing mode changed:', isEnabled);
      setEarningsTestingMode(isEnabled);
    };

    window.addEventListener('adminEarningsTestingChange', handleEarningsTestingChange);
    return () => {
      window.removeEventListener('adminEarningsTestingChange', handleEarningsTestingChange);
    };
  }, []);

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

  // Use fake earnings when testing mode is enabled
  const effectiveEarnings = earningsTestingMode ? FAKE_EARNINGS_DATA : earnings;
  const effectiveHasEarnings = earningsTestingMode ? true : hasEarnings;

  const contextValue: EarningsContextType = {
    earnings: effectiveEarnings,
    hasEarnings: effectiveHasEarnings,
    isLoading: earningsTestingMode ? false : isLoading,
    lastUpdated,
    refreshEarnings,
    getTotalEarnings: () => effectiveEarnings?.totalEarnings || 0,
    getAvailableBalance: () => effectiveEarnings?.availableBalance || 0,
    getPendingBalance: () => effectiveEarnings?.pendingBalance || 0,
    getFormattedTotalEarnings: () => `$${((effectiveEarnings?.totalEarnings || 0) / 100).toFixed(2)}`,
    getFormattedAvailableBalance: () => `$${((effectiveEarnings?.availableBalance || 0) / 100).toFixed(2)}`,
    getFormattedPendingBalance: () => `$${((effectiveEarnings?.pendingBalance || 0) / 100).toFixed(2)}`
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
