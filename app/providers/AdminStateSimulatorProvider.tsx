'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAdminStateSimulator, useSimulatedState, AdminSimulatorState } from '../hooks/useAdminStateSimulator';

interface AdminStateSimulatorContextType {
  // Simulated state for components to use
  simulatedState: ReturnType<typeof useSimulatedState>;
  
  // Admin controls (only available to admin users)
  adminControls: ReturnType<typeof useAdminStateSimulator>;
  
  // Helper to check if a state is being simulated
  isSimulating: (category: keyof AdminSimulatorState) => boolean;
}

const AdminStateSimulatorContext = createContext<AdminStateSimulatorContextType | null>(null);

interface AdminStateSimulatorProviderProps {
  children: ReactNode;
}

export function AdminStateSimulatorProvider({ children }: AdminStateSimulatorProviderProps) {
  const adminControls = useAdminStateSimulator();
  const simulatedState = useSimulatedState();

  const isSimulating = (category: keyof AdminSimulatorState): boolean => {
    // Check if any non-default values are set for this category
    switch (category) {
      case 'authState':
        return adminControls.authState !== 'logged-in';
      case 'subscriptionState':
        return adminControls.subscriptionState !== 'active';
      case 'spendingState':
        return adminControls.spendingState.pastMonthTokensSent;
      case 'tokenEarningsState':
        return !adminControls.tokenEarningsState.none || 
               Object.entries(adminControls.tokenEarningsState)
                 .filter(([key]) => key !== 'none')
                 .some(([, value]) => value);
      default:
        return false;
    }
  };

  const contextValue: AdminStateSimulatorContextType = {
    simulatedState,
    adminControls,
    isSimulating
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

// Convenience hook for components that just need to read simulated state
export function useSimulatedAppState() {
  const context = useContext(AdminStateSimulatorContext);
  return context?.simulatedState || {
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
