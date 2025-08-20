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
 * Demo Balance Context
 * 
 * Handles simulated USD balance for:
 * - Logged out users (demo experience)
 * - Logged in users without active subscriptions (trial experience)
 * 
 * Separated from real balance logic for clarity and maintainability.
 */

export interface DemoBalance {
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
}

interface DemoBalanceContextType {
  // Balance data
  demoBalance: DemoBalance | null;
  isDemoBalance: boolean;
  
  // Actions
  refreshDemoBalance: () => void;
  allocateDemoBalance: (pageId: string, pageTitle: string, newAllocationCents: number) => Promise<boolean>;
  
  // Helper methods for display
  getTotalUsdFormatted: () => string;
  getAvailableUsdFormatted: () => string;
  getAllocatedUsdFormatted: () => string;
}

const DemoBalanceContext = createContext<DemoBalanceContextType | undefined>(undefined);

export function DemoBalanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [demoBalance, setDemoBalance] = useState<DemoBalance | null>(null);
  const [isDemoBalance, setIsDemoBalance] = useState(false);

  /**
   * Load demo balance from localStorage
   * Only use demo balance for logged-out users
   */
  const loadDemoBalance = useCallback(() => {
    if (!user?.uid) {
      // Logged out user - use logged out demo balance
      const loggedOutBalance = getLoggedOutUsdBalance();
      setDemoBalance({
        totalUsdCents: loggedOutBalance.totalUsdCents,
        allocatedUsdCents: loggedOutBalance.allocatedUsdCents,
        availableUsdCents: loggedOutBalance.availableUsdCents
      });
      setIsDemoBalance(true);

    } else {
      // Logged in user - always use real balance, never demo
      setDemoBalance(null);
      setIsDemoBalance(false);
    }
  }, [user?.uid]);

  /**
   * Refresh demo balance from localStorage
   */
  const refreshDemoBalance = useCallback(() => {
    loadDemoBalance();
  }, [loadDemoBalance]);

  /**
   * Allocate demo balance to a page
   */
  const allocateDemoBalance = useCallback(async (
    pageId: string, 
    pageTitle: string, 
    newAllocationCents: number
  ): Promise<boolean> => {
    try {
      if (!user?.uid) {
        // Logged out user allocation
        const result = allocateLoggedOutUsd(pageId, pageTitle, newAllocationCents);
        if (result.success) {
          refreshDemoBalance();
          return true;
        } else {
          console.error('[DemoBalance] Logged out allocation failed:', result.error);
          return false;
        }
      } else {
        // Logged in user without subscription allocation
        const result = allocateUserUsd(user.uid, pageId, pageTitle, newAllocationCents);
        if (result.success) {
          refreshDemoBalance();
          return true;
        } else {
          console.error('[DemoBalance] User demo allocation failed:', result.error);
          return false;
        }
      }
    } catch (error) {
      console.error('[DemoBalance] Allocation error:', error);
      return false;
    }
  }, [user?.uid, refreshDemoBalance]);

  // Helper methods for formatted display
  const getTotalUsdFormatted = useCallback(() => {
    return demoBalance ? formatUsdCents(demoBalance.totalUsdCents) : '$0.00';
  }, [demoBalance]);

  const getAvailableUsdFormatted = useCallback(() => {
    return demoBalance ? formatUsdCents(demoBalance.availableUsdCents) : '$0.00';
  }, [demoBalance]);

  const getAllocatedUsdFormatted = useCallback(() => {
    return demoBalance ? formatUsdCents(demoBalance.allocatedUsdCents) : '$0.00';
  }, [demoBalance]);

  // Load demo balance when user changes
  useEffect(() => {
    loadDemoBalance();
  }, [loadDemoBalance]);

  const contextValue: DemoBalanceContextType = {
    demoBalance,
    isDemoBalance,
    refreshDemoBalance,
    allocateDemoBalance,
    getTotalUsdFormatted,
    getAvailableUsdFormatted,
    getAllocatedUsdFormatted
  };

  return (
    <DemoBalanceContext.Provider value={contextValue}>
      {children}
    </DemoBalanceContext.Provider>
  );
}

export function useDemoBalance() {
  const context = useContext(DemoBalanceContext);
  if (context === undefined) {
    throw new Error('useDemoBalance must be used within a DemoBalanceProvider');
  }
  return context;
}

/**
 * Hook to determine if user should use demo balance
 * This logic can be used by other contexts to decide whether to show real or demo data
 */
export function useShouldUseDemoBalance(hasActiveSubscription: boolean): boolean {
  const { user } = useAuth();

  // Use demo balance only if user is not logged in
  return !user?.uid;
}


