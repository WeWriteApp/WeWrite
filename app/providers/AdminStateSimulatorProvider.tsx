'use client';

import React, { ReactNode } from 'react';

// Admin state simulator functionality completely removed
// This file is kept only for backward compatibility with existing imports

interface AdminStateSimulatorProviderProps {
  children: ReactNode;
}

export function AdminStateSimulatorProvider({ children }: AdminStateSimulatorProviderProps) {
  // No simulation functionality - just pass through children
  return <>{children}</>;
}

// Stub hooks for backward compatibility - return default state
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

// Backward compatibility hooks
export function useSimulatedState() {
  return useSimulatedAppState();
}

export function useAdminStateSimulatorContext() {
  return { isSimulating: () => false };
}
