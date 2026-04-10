'use client';

/**
 * Subscription Context
 *
 * Handles subscription data separately from balance data.
 * Uses simplified caching and data fetching architecture.
 *
 * Features:
 * - Dedicated subscription data management
 * - Simplified caching with clear expiration
 * - Separation of concerns from balance logic
 * - Clean error handling
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { UsdDataService, type SubscriptionData } from '../services/usdDataService';
import { subscriptionCache } from '../utils/financialDataCache';
import { getDevSubscriptionOverride, type DevSubscriptionOverride } from '../components/dev/DevSubscriptionPanel';

interface SubscriptionContextType {
  // Subscription data
  subscription: SubscriptionData | null;
  hasActiveSubscription: boolean;
  subscriptionAmount: number;
  isLoading: boolean;
  lastUpdated: Date | null;

  // Actions
  refreshSubscription: () => Promise<void>;

  // Helper methods
  isSubscriptionActive: () => boolean;
  getSubscriptionStatus: () => string;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [devOverride, setDevOverride] = useState<DevSubscriptionOverride | null>(null);
  const fetchingRef = useRef<Promise<void> | null>(null);

  /**
   * Fetch subscription data from API or cache
   */
  const fetchSubscription = useCallback(async (forceRefresh = false): Promise<void> => {
    // Handle logged out users
    if (!user?.uid) {
      setSubscription(null);
      setHasActiveSubscription(false);
      setLastUpdated(new Date());
      return;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = subscriptionCache.get(user.uid);
      if (cached) {
        setSubscription(cached);
        setHasActiveSubscription(cached.status === 'active' && (cached.amount || 0) > 0);
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


        const result = await UsdDataService.fetchSubscription();

        if (!result.success) {
          if (UsdDataService.isAuthenticationError(result.status)) {

            setSubscription(null);
            setHasActiveSubscription(false);
            return;
          }

          console.warn('[SubscriptionContext] Subscription fetch failed:', result.error);
          // Don't clear existing data on API errors, just log the warning
          return;
        }

        const subscriptionData = result.data;
        const isActive = subscriptionData?.status === 'active' && (subscriptionData?.amount || 0) > 0;

        setSubscription(subscriptionData);
        setHasActiveSubscription(isActive);
        setLastUpdated(new Date());

        // Cache the result
        if (subscriptionData) {
          subscriptionCache.set(user.uid, subscriptionData);
        }



      } catch (error) {
        console.error('[SubscriptionContext] Fetch error:', error);
      } finally {
        setIsLoading(false);
        fetchingRef.current = null;
      }
    })();

    fetchingRef.current = fetchPromise;
    return fetchPromise;
  }, [user?.uid]);

  /**
   * Refresh subscription data (force refresh from API)
   */
  const refreshSubscription = useCallback(async (): Promise<void> => {
    return fetchSubscription(true);
  }, [fetchSubscription]);

  /**
   * Check if subscription is active
   */
  const isSubscriptionActive = useCallback((): boolean => {
    return hasActiveSubscription;
  }, [hasActiveSubscription]);

  /**
   * Get subscription status string
   */
  const getSubscriptionStatus = useCallback((): string => {
    if (!subscription) return 'none';
    return subscription.status || 'unknown';
  }, [subscription]);

  // Check for dev subscription override on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkOverride = () => {
        setDevOverride(getDevSubscriptionOverride());
      };

      // Check on mount
      checkOverride();

      // Listen for changes from dev panel
      window.addEventListener('devSubscriptionOverrideChange', checkOverride);
      // Legacy event compat
      window.addEventListener('adminPaywallOverrideChange', checkOverride);
      return () => {
        window.removeEventListener('devSubscriptionOverrideChange', checkOverride);
        window.removeEventListener('adminPaywallOverrideChange', checkOverride);
      };
    }
  }, []);

  // Fetch subscription when user changes
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Build mock subscription when dev override is active
  const mockSubscription: SubscriptionData | null = devOverride ? {
    status: devOverride.status,
    amount: devOverride.amount,
    cancelAtPeriodEnd: devOverride.cancelAtPeriodEnd,
    tier: devOverride.amount >= 30 ? 'tier3' : devOverride.amount >= 20 ? 'tier2' : devOverride.amount >= 10 ? 'tier1' : null,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  } : null;

  const effectiveSubscription = devOverride ? mockSubscription : subscription;
  const effectiveHasActive = devOverride
    ? (devOverride.status === 'active' && devOverride.amount > 0)
    : hasActiveSubscription;
  const effectiveAmount = devOverride
    ? (devOverride.status === 'active' ? devOverride.amount : 0)
    : (subscription?.status === 'active' ? (subscription.amount || 0) : 0);

  const contextValue: SubscriptionContextType = {
    subscription: effectiveSubscription,
    hasActiveSubscription: effectiveHasActive,
    subscriptionAmount: effectiveAmount,
    isLoading,
    lastUpdated,
    refreshSubscription,
    isSubscriptionActive: () => effectiveHasActive,
    getSubscriptionStatus
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Hook to use subscription context
 */
export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

/**
 * Hook to get subscription amount (convenience hook)
 */
export function useSubscriptionAmount(): number {
  const { subscription } = useSubscription();
  if (!subscription || subscription.status !== 'active') {
    return 0;
  }
  return subscription.amount || 0;
}

/**
 * Hook to check if user has active subscription (convenience hook)
 */
export function useHasActiveSubscription(): boolean {
  const { hasActiveSubscription } = useSubscription();
  return hasActiveSubscription;
}
