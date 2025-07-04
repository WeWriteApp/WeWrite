'use client';

import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { useSimulatedAppState } from '../providers/AdminStateSimulatorProvider';

/**
 * Hook that provides auth state with admin simulation override
 * This allows admins to simulate different auth states for testing
 */
export function useSimulatedAuth() {
  const realAuth = useCurrentAccount();
  const simulatedState = useSimulatedAppState();

  // If admin is simulating logged out state, override the real auth
  if (simulatedState.auth.isLoggedOut) {
    return {
      currentAccount: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: true,
      error: null,
      switchAccount: realAuth.switchAccount,
      clearCurrentSession: realAuth.clearCurrentSession,
      // Add simulation indicator
      isSimulated: true,
      simulatedState: 'logged-out'
    };
  }

  // Otherwise return real auth state with simulation indicator
  return {
    ...realAuth,
    isSimulated: false,
    simulatedState: null
  };
}

/**
 * Hook for components that need to check auth state
 * Automatically handles simulation overrides
 */
export function useAuthState() {
  const { isAuthenticated, currentAccount, isLoading, isSimulated, simulatedState } = useSimulatedAuth();

  return {
    isAuthenticated,
    user: currentAccount,
    isLoading,
    isSimulated,
    simulatedState
  };
}
