"use client";

import { useState, useEffect } from 'react';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { useFeatureFlag } from '../utils/feature-flags';
import { getOptimizedUserSubscription } from '../firebase/optimizedSubscription';
import { getSubscriptionStatusInfo } from '../utils/subscriptionStatus';

/**
 * Hook to determine when to show subscription warning indicators
 * 
 * Returns information about whether warning dots should be shown
 * based on the user's subscription status.
 */
export function useSubscriptionWarning() {
  const { session, isAuthenticated } = useCurrentAccount();
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [subscriptionStatusInfo, setSubscriptionStatusInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check payments feature flag with proper user ID for real-time updates
  const paymentsEnabled = useFeatureFlag('payments', session?.email, session?.uid);

  useEffect(() => {
    let isMounted = true;

    const checkSubscriptionStatus = async () => {
      if (!isAuthenticated || !session?.uid || !paymentsEnabled) {
        setHasActiveSubscription(null);
        setSubscriptionStatusInfo(null);
        setIsLoading(false);
        return;
      }

      try {
        const subscription = await getOptimizedUserSubscription(session.uid);
        
        if (!isMounted) return;

        if (subscription) {
          const statusInfo = getSubscriptionStatusInfo(
            subscription.status,
            subscription.cancelAtPeriodEnd,
            subscription.currentPeriodEnd
          );

          console.warn('Subscription warning hook - subscription found:', {
            subscription,
            statusInfo,
            isActive: statusInfo.isActive
          });

          setHasActiveSubscription(statusInfo.isActive);
          setSubscriptionStatusInfo(statusInfo);
        } else {
          console.warn('Subscription warning hook - no subscription found');
          setHasActiveSubscription(false);
          setSubscriptionStatusInfo(null);
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
        if (isMounted) {
          setHasActiveSubscription(false);
          setSubscriptionStatusInfo(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkSubscriptionStatus();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, session?.uid, paymentsEnabled]);

  // Determine if warning should be shown
  // Only show warnings for truly problematic states, not for active subscriptions that are cancelling
  const shouldShowWarning = paymentsEnabled &&
    isAuthenticated &&
    !isLoading &&
    (hasActiveSubscription === false ||
     (subscriptionStatusInfo && ['canceled', 'past_due', 'unpaid', 'incomplete'].includes(subscriptionStatusInfo.status)));

  // Debug warning calculation
  console.warn('Subscription warning calculation:', {
    paymentsEnabled,
    isAuthenticated,
    isLoading,
    hasActiveSubscription,
    subscriptionStatus: subscriptionStatusInfo?.status,
    shouldShowWarning
  });

  // Get warning variant based on subscription status
  const getWarningVariant = () => {
    if (!subscriptionStatusInfo) {
      return 'warning'; // No subscription
    }

    switch (subscriptionStatusInfo.status) {
      case 'past_due':
      case 'unpaid':
        return 'critical';
      case 'incomplete':
        return 'error';
      case 'cancelling':
      case 'canceled':
        return 'warning';
      default:
        return 'warning';
    }
  };

  // Get user-friendly warning message
  const getWarningMessage = () => {
    if (!subscriptionStatusInfo) {
      return 'No active subscription';
    }

    switch (subscriptionStatusInfo.status) {
      case 'past_due':
        return 'Payment failed - subscription at risk';
      case 'unpaid':
        return 'Payment required to continue';
      case 'incomplete':
        return 'Payment information needed';
      case 'cancelling':
        return 'Subscription cancelling soon';
      case 'canceled':
        return 'Subscription has been canceled';
      default:
        return 'Subscription needs attention';
    }
  };

  return {
    shouldShowWarning,
    warningVariant: getWarningVariant(),
    warningMessage: getWarningMessage(),
    subscriptionStatus: subscriptionStatusInfo?.status,
    hasActiveSubscription,
    isLoading,
    paymentsEnabled
  };
}
