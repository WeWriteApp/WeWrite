'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { formatUsdCents } from '../utils/formatCurrency';
import {
  getLoggedOutUsdBalance,
  getUserUsdBalance,
  allocateLoggedOutUsd,
  allocateUserUsd,
  type SimulatedUsdBalance
} from '../utils/simulatedUsd';

/**
 * Fake Balance Context
 * 
 * Handles simulated USD balance for:
 * - Logged out users (demo experience)
 * - Logged in users without active subscriptions (trial experience)
 * 
 * Separated from real balance logic for clarity and maintainability.
 */

export interface FakeBalance {
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
}

interface FakeBalanceContextType {
  // Balance data
  fakeBalance: FakeBalance | null;
  isFakeBalance: boolean;
  
  // Actions
  refreshFakeBalance: () => void;
  allocateFakeBalance: (pageId: string, pageTitle: string, newAllocationCents: number) => Promise<boolean>;
  
  // Helper methods for display
  getTotalUsdFormatted: () => string;
  getAvailableUsdFormatted: () => string;
  getAllocatedUsdFormatted: () => string;
}

const FakeBalanceContext = createContext<FakeBalanceContextType | undefined>(undefined);

export function FakeBalanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [fakeBalance, setFakeBalance] = useState<FakeBalance | null>(null);
  const [isFakeBalance, setIsFakeBalance] = useState(false);

  /**
   * Load fake balance from localStorage
   */
  const loadFakeBalance = useCallback(() => {
    if (!user?.uid) {
      // Logged out user - use logged out balance
      const loggedOutBalance = getLoggedOutUsdBalance();
      setFakeBalance({
        totalUsdCents: loggedOutBalance.totalUsdCents,
        allocatedUsdCents: loggedOutBalance.allocatedUsdCents,
        availableUsdCents: loggedOutBalance.availableUsdCents
      });
      setIsFakeBalance(true);

    } else {
      // Logged in user without subscription - use user fake balance
      const userBalance = getUserUsdBalance(user.uid);
      if (userBalance) {
        setFakeBalance({
          totalUsdCents: userBalance.totalUsdCents,
          allocatedUsdCents: userBalance.allocatedUsdCents,
          availableUsdCents: userBalance.availableUsdCents
        });
        setIsFakeBalance(true);

      } else {
        // No fake balance found, user might have real subscription
        setFakeBalance(null);
        setIsFakeBalance(false);

      }
    }
  }, [user?.uid]);

  /**
   * Refresh fake balance from localStorage
   */
  const refreshFakeBalance = useCallback(() => {
    loadFakeBalance();
  }, [loadFakeBalance]);

  /**
   * Allocate fake balance to a page
   */
  const allocateFakeBalance = useCallback(async (
    pageId: string, 
    pageTitle: string, 
    newAllocationCents: number
  ): Promise<boolean> => {
    try {
      if (!user?.uid) {
        // Logged out user allocation
        const result = allocateLoggedOutUsd(pageId, pageTitle, newAllocationCents);
        if (result.success) {
          refreshFakeBalance();
          return true;
        } else {
          console.error('[FakeBalance] Logged out allocation failed:', result.error);
          return false;
        }
      } else {
        // Logged in user without subscription allocation
        const result = allocateUserUsd(user.uid, pageId, pageTitle, newAllocationCents);
        if (result.success) {
          refreshFakeBalance();
          return true;
        } else {
          console.error('[FakeBalance] User fake allocation failed:', result.error);
          return false;
        }
      }
    } catch (error) {
      console.error('[FakeBalance] Allocation error:', error);
      return false;
    }
  }, [user?.uid, refreshFakeBalance]);

  // Helper methods for formatted display
  const getTotalUsdFormatted = useCallback(() => {
    return fakeBalance ? formatUsdCents(fakeBalance.totalUsdCents) : '$0.00';
  }, [fakeBalance]);

  const getAvailableUsdFormatted = useCallback(() => {
    return fakeBalance ? formatUsdCents(fakeBalance.availableUsdCents) : '$0.00';
  }, [fakeBalance]);

  const getAllocatedUsdFormatted = useCallback(() => {
    return fakeBalance ? formatUsdCents(fakeBalance.allocatedUsdCents) : '$0.00';
  }, [fakeBalance]);

  // Load fake balance when user changes
  useEffect(() => {
    loadFakeBalance();
  }, [loadFakeBalance]);

  const contextValue: FakeBalanceContextType = {
    fakeBalance,
    isFakeBalance,
    refreshFakeBalance,
    allocateFakeBalance,
    getTotalUsdFormatted,
    getAvailableUsdFormatted,
    getAllocatedUsdFormatted
  };

  return (
    <FakeBalanceContext.Provider value={contextValue}>
      {children}
    </FakeBalanceContext.Provider>
  );
}

export function useFakeBalance() {
  const context = useContext(FakeBalanceContext);
  if (context === undefined) {
    throw new Error('useFakeBalance must be used within a FakeBalanceProvider');
  }
  return context;
}

/**
 * Hook to determine if user should use fake balance
 * This logic can be used by other contexts to decide whether to show real or fake data
 */
export function useShouldUseFakeBalance(hasActiveSubscription: boolean): boolean {
  const { user } = useAuth();
  
  // Use fake balance if:
  // 1. User is not logged in, OR
  // 2. User is logged in but doesn't have an active subscription
  return !user?.uid || !hasActiveSubscription;
}
