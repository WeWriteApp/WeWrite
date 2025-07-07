'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { getOptimizedUserSubscription } from '../firebase/optimizedSubscription';

// Define the state structure for extensibility
export interface AdminSimulatorState {
  // Core UI state
  isVisible: boolean;
  isExpanded: boolean;
  position: { x: number; y: number };
  
  // Simulated app states
  authState: 'logged-out' | 'logged-in';
  subscriptionState: 'none' | 'active' | 'cancelling' | 'payment-failed';
  spendingState: {
    pastMonthTokensSent: boolean;
  };
  tokenEarningsState: {
    none: boolean;
    unfundedLoggedOut: boolean;
    unfundedNoSubscription: boolean;
    fundedPending: boolean;
    lockedAvailable: boolean;
  };
}

// Default state
const DEFAULT_STATE: AdminSimulatorState = {
  isVisible: true,
  isExpanded: false,
  position: { x: 20, y: 20 },
  authState: 'logged-in',
  subscriptionState: 'active',
  spendingState: {
    pastMonthTokensSent: false
  },
  tokenEarningsState: {
    none: true,
    unfundedLoggedOut: false,
    unfundedNoSubscription: false,
    fundedPending: false,
    lockedAvailable: false
  }
};

// Storage keys
const STORAGE_KEYS = {
  STATE: 'admin-state-simulator',
  HIDDEN_FOR_SESSION: 'admin-state-simulator-hidden'
} as const;

export function useAdminStateSimulator() {
  const [state, setState] = useState<AdminSimulatorState>(DEFAULT_STATE);

  // Get actual user state for reset functionality
  const { currentAccount } = useCurrentAccount();

  // Load state from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // Check if hidden for this session
      const hiddenForSession = sessionStorage.getItem(STORAGE_KEYS.HIDDEN_FOR_SESSION);
      if (hiddenForSession === 'true') {
        setState(prev => ({ ...prev, isVisible: false }));
        return;
      }

      // Load persisted state
      const savedState = localStorage.getItem(STORAGE_KEYS.STATE);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        setState(prev => ({
          ...prev,
          ...parsedState,
          isVisible: true, // Always show on load unless hidden for session
          isExpanded: false // Always start collapsed
        }));
      }
    } catch (error) {
      console.warn('Failed to load admin state simulator state:', error);
    }
  }, []);

  // Save state to localStorage whenever it changes
  const saveState = useCallback((newState: AdminSimulatorState) => {
    if (typeof window === 'undefined') return;

    try {
      // Don't save UI state (isVisible, isExpanded), only simulation state
      const stateToSave = {
        position: newState.position,
        authState: newState.authState,
        subscriptionState: newState.subscriptionState,
        spendingState: newState.spendingState,
        tokenEarningsState: newState.tokenEarningsState
      };
      localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to save admin state simulator state:', error);
    }
  }, []);

  // Update state and save
  const updateState = useCallback((updates: Partial<AdminSimulatorState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      saveState(newState);
      return newState;
    });
  }, [saveState]);

  // UI Controls
  const toggleVisibility = useCallback(() => {
    updateState({ isVisible: !state.isVisible });
  }, [state.isVisible, updateState]);

  const toggleExpanded = useCallback(() => {
    updateState({ isExpanded: !state.isExpanded });
  }, [state.isExpanded, updateState]);

  const updatePosition = useCallback((position: { x: number; y: number }) => {
    updateState({ position });
  }, [updateState]);

  const hideForSession = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    sessionStorage.setItem(STORAGE_KEYS.HIDDEN_FOR_SESSION, 'true');
    setState(prev => ({ ...prev, isVisible: false }));
  }, []);

  // State setters
  const setAuthState = useCallback((authState: AdminSimulatorState['authState']) => {
    updateState({ authState });
  }, [updateState]);

  const setSubscriptionState = useCallback((subscriptionState: AdminSimulatorState['subscriptionState']) => {
    updateState({ subscriptionState });
  }, [updateState]);

  const setSpendingState = useCallback((updates: Partial<AdminSimulatorState['spendingState']>) => {
    updateState({ 
      spendingState: { ...state.spendingState, ...updates }
    });
  }, [state.spendingState, updateState]);

  const setTokenEarningsState = useCallback((updates: Partial<AdminSimulatorState['tokenEarningsState']>) => {
    updateState({ 
      tokenEarningsState: { ...state.tokenEarningsState, ...updates }
    });
  }, [state.tokenEarningsState, updateState]);

  // Extensibility: Add new state categories
  const addStateCategory = useCallback((categoryName: string, defaultValue: any) => {
    updateState({ [categoryName]: defaultValue } as any);
  }, [updateState]);

  const updateStateCategory = useCallback((categoryName: string, updates: any) => {
    updateState({
      [categoryName]: { ...(state as any)[categoryName], ...updates }
    } as any);
  }, [state, updateState]);

  // Reset to actual state (detect and match real user state)
  const resetToActualState = useCallback(async () => {
    // Detect actual authentication state
    const actualAuthState: AdminSimulatorState['authState'] = currentAccount ? 'logged-in' : 'logged-out';

    // Detect actual subscription state
    let actualSubscriptionState: AdminSimulatorState['subscriptionState'] = 'none';

    if (currentAccount?.uid) {
      try {
        const subscription = await getOptimizedUserSubscription(currentAccount.uid, {
          useCache: false, // Get fresh data for reset
          verbose: false
        });

        if (subscription) {
          switch (subscription.status) {
            case 'active':
              // Check if subscription is set to cancel at period end
              if (subscription.cancelAtPeriodEnd) {
                actualSubscriptionState = 'cancelling';
              } else {
                actualSubscriptionState = 'active';
              }
              break;
            case 'canceled':
            case 'cancelled':
            case 'canceling':
              actualSubscriptionState = 'cancelling';
              break;
            case 'past_due':
            case 'unpaid':
            case 'incomplete':
            case 'incomplete_expired':
              actualSubscriptionState = 'payment-failed';
              break;
            case 'trialing':
              // Treat trial as active
              actualSubscriptionState = 'active';
              break;
            case 'pending':
              // Treat pending as none until it becomes active
              actualSubscriptionState = 'none';
              break;
            default:
              actualSubscriptionState = 'none';
          }
        }
      } catch (error) {
        console.warn('Failed to fetch subscription for reset:', error);
        // Keep default 'none' state if fetch fails
      }
    }

    const resetState = {
      ...DEFAULT_STATE,
      position: state.position, // Keep current position
      isVisible: state.isVisible, // Keep current visibility
      isExpanded: state.isExpanded, // Keep current expansion state
      authState: actualAuthState, // Set to actual auth state
      subscriptionState: actualSubscriptionState, // Set to actual subscription state
      // Reset other states to defaults since we can't easily detect them
      spendingState: {
        pastMonthTokensSent: false
      },
      tokenEarningsState: {
        none: true,
        unfundedLoggedOut: false,
        unfundedNoSubscription: false,
        fundedPending: false,
        lockedAvailable: false
      }
    };

    setState(resetState);
    saveState(resetState);

    // Return the detected state for potential use in UI feedback
    return {
      authState: actualAuthState,
      subscriptionState: actualSubscriptionState
    };
  }, [state.position, state.isVisible, state.isExpanded, saveState, currentAccount]);

  return {
    // Current state
    isVisible: state.isVisible,
    isExpanded: state.isExpanded,
    position: state.position,
    authState: state.authState,
    subscriptionState: state.subscriptionState,
    spendingState: state.spendingState,
    tokenEarningsState: state.tokenEarningsState,
    
    // UI controls
    toggleVisibility,
    toggleExpanded,
    updatePosition,
    hideForSession,
    
    // State setters
    setAuthState,
    setSubscriptionState,
    setSpendingState,
    setTokenEarningsState,
    
    // Extensibility
    addStateCategory,
    updateStateCategory,

    // Reset functionality
    resetToActualState,

    // Raw state access for extensions
    rawState: state,
    updateState
  };
}

// Hook for components to read simulated state
export function useSimulatedState() {
  const {
    authState,
    subscriptionState,
    spendingState,
    tokenEarningsState
  } = useAdminStateSimulator();

  return {
    auth: {
      isLoggedIn: authState === 'logged-in',
      isLoggedOut: authState === 'logged-out'
    },
    subscription: {
      hasNone: subscriptionState === 'none',
      isActive: subscriptionState === 'active',
      isCancelling: subscriptionState === 'cancelling',
      hasPaymentFailed: subscriptionState === 'payment-failed'
    },
    spending: spendingState,
    tokenEarnings: tokenEarningsState
  };
}
