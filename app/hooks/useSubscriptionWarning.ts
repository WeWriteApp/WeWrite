/**
 * useSubscriptionWarning Hook
 *
 * Provides subscription warning state and status information for UI components
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';


interface UseSubscriptionWarningReturn {
  shouldShowWarning: boolean;
  warningVariant: 'warning' | 'error' | 'critical';
  hasActiveSubscription: boolean | null;
  paymentsEnabled: boolean;
  subscriptionStatus: string | null;
  isLoading: boolean;
}

export function useSubscriptionWarning(): UseSubscriptionWarningReturn {
  const { user } = useAuth();
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);



  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      setHasActiveSubscription(null);
      setSubscriptionStatus(null);
      return;
    }

    const checkSubscriptionStatus = async () => {
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
    };

    checkSubscriptionStatus();
  }, [user?.uid, paymentsEnabled]);

  // Determine if we should show a warning
  const shouldShowWarning = paymentsEnabled && 
    hasActiveSubscription !== null && 
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
    paymentsEnabled,
    subscriptionStatus,
    isLoading
  };
}
