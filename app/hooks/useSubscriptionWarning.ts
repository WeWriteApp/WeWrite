/**
 * useSubscriptionWarning Hook
 *
 * Provides subscription warning state and status information for UI components
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';


interface UseSubscriptionWarningReturn {
  shouldShowWarning: boolean;
  warningVariant: 'warning' | 'error' | 'critical';
  hasActiveSubscription: boolean | null;
  subscriptionStatus: string | null;
  isLoading: boolean;
}

export function useSubscriptionWarning(): UseSubscriptionWarningReturn {
  const { user } = useAuth();
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);



  const checkSubscriptionStatus = useCallback(async () => {
    if (!user?.uid) {
      setIsLoading(false);
      setHasActiveSubscription(null);
      setSubscriptionStatus(null);
      return;
    }
      try {
        setIsLoading(true);

        // Use the single source of truth API
        const response = await fetch('/api/account-subscription');

        if (!response.ok) {
          console.warn('Failed to fetch subscription data:', response.status);
          setHasActiveSubscription(false);
          setSubscriptionStatus(null);
          return;
        }

        const data = await response.json();

        if (data?.hasSubscription && data.fullData) {
          const subscription = data.fullData;

          // Proper active check - active status and not cancelled at period end
          const isActive = subscription.status === 'active' && !subscription.cancelAtPeriodEnd;

          setHasActiveSubscription(isActive);
          setSubscriptionStatus(subscription.status);
        } else {
          // No subscription found
          setHasActiveSubscription(false);
          setSubscriptionStatus(null);
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
        setHasActiveSubscription(false);
        setSubscriptionStatus(null);
      } finally {
        setIsLoading(false);
      }
  }, [user?.uid]);

  useEffect(() => {
    checkSubscriptionStatus();
  }, [user?.uid, checkSubscriptionStatus]);

  // Listen for cache invalidation events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSubscriptionCacheInvalidation = (event: CustomEvent) => {
      const { userId, forceRefresh } = event.detail || {};
      if (!userId || userId === user?.uid) {
        console.log('[useSubscriptionWarning] Subscription cache invalidation event received, refreshing...', { forceRefresh });
        checkSubscriptionStatus();
      }
    };

    window.addEventListener('invalidate-subscription-cache', handleSubscriptionCacheInvalidation as EventListener);

    return () => {
      window.removeEventListener('invalidate-subscription-cache', handleSubscriptionCacheInvalidation as EventListener);
    };
  }, [user?.uid]);

  // Determine if we should show a warning
  const shouldShowWarning = hasActiveSubscription !== null &&
    hasActiveSubscription === false;

  // Determine warning variant based on subscription status
  const getWarningVariant = (): 'warning' | 'error' | 'critical' => {
    if (!subscriptionStatus) {
      return 'warning'; // No subscription
    }

    switch (subscriptionStatus.toLowerCase()) {
      case 'past_due':
      case 'unpaid':
        return 'critical';
      case 'canceled':
      case 'incomplete':
        return 'error';
      default:
        return 'warning';
    }
  };

  return {
    shouldShowWarning,
    warningVariant: getWarningVariant(),
    hasActiveSubscription,
    subscriptionStatus,
    isLoading
  };
}
