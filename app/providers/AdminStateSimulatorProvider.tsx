'use client';

import React, { createContext, useContext, ReactNode } from 'react';

// Simplified admin state simulator - old complex system removed
interface AdminStateSimulatorContextType {
  // Default state - no simulation functionality
  isSimulating: () => boolean;
}

const AdminStateSimulatorContext = createContext<AdminStateSimulatorContextType | null>(null);

interface AdminStateSimulatorProviderProps {
  children: ReactNode;
}

export function AdminStateSimulatorProvider({ children }: AdminStateSimulatorProviderProps) {
  const contextValue: AdminStateSimulatorContextType = {
    isSimulating: () => false // No simulation functionality
  };

  return (
    <AdminStateSimulatorContext.Provider value={contextValue}>
      {children}
    </AdminStateSimulatorContext.Provider>
  );
}

export function useAdminStateSimulatorContext() {
  const context = useContext(AdminStateSimulatorContext);
  if (!context) {
    throw new Error('useAdminStateSimulatorContext must be used within AdminStateSimulatorProvider');
  }
  return context;
}

// Simplified hook that returns default state (no simulation)
export function useSimulatedAppState() {
  return {
    auth: { isLoggedIn: true, isLoggedOut: false },
    subscription: { hasNone: false, isActive: true, isCancelling: false, hasPaymentFailed: false },
    spending: { pastMonthTokensSent: false },
    tokenEarnings: {
      none: true,
      unfundedLoggedOut: false,
      unfundedNoSubscription: false,
      fundedPending: false,
      lockedAvailable: false
    }
  };
}

// Simplified hook for backward compatibility
export function useSimulatedState() {
  return useSimulatedAppState();
}
