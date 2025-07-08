"use client";

import { useState, useEffect } from 'react';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { useFeatureFlag } from '../utils/feature-flags';
import { getSubscriptionStatusInfo } from '../utils/subscriptionStatus';
import { useSmartSubscriptionState } from './useSmartSubscriptionState';

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
  // Check payments feature flag with proper user ID for real-time updates
  const paymentsEnabled = useFeatureFlag('payments', session?.email, session?.uid);

  // Use smart subscription state with optimized polling for warning checks
  const { subscription, isLoading } = useSmartSubscriptionState({
    enableRealTime: false, // Use polling for warning checks to reduce real-time listeners
    pollInterval: 10 * 60 * 1000, // 10 minutes for warning checks
    staleThreshold: 15 * 60 * 1000, // 15 minutes stale threshold
    offlineFirst: true
  });

  useEffect(() => {
    if (!isAuthenticated || !session?.uid || !paymentsEnabled) {
      setHasActiveSubscription(null);
      setSubscriptionStatusInfo(null);
      return;
    }

    if (subscription) {
      const statusInfo = getSubscriptionStatusInfo(
        subscription.status,
        subscription.cancelAtPeriodEnd,
        subscription.currentPeriodEnd
      );

      // Reduced logging: only log when status changes
      // console.warn('Subscription warning hook - subscription found:', {
      //   subscription,
      //   statusInfo,
      //   isActive: statusInfo.isActive
      // });

      setHasActiveSubscription(statusInfo.isActive);
      setSubscriptionStatusInfo(statusInfo);
    } else {
      // Reduced logging: console.warn('Subscription warning hook - no subscription found');
      setHasActiveSubscription(false);
      setSubscriptionStatusInfo(null);
    }
  }, [isAuthenticated, session?.uid, paymentsEnabled, subscription]);

  // Determine if warning should be shown
  // Only show warnings for truly problematic states, not for active subscriptions that are cancelling
  const shouldShowWarning = paymentsEnabled &&
    isAuthenticated &&
    !isLoading &&
    (hasActiveSubscription === false ||
     (subscriptionStatusInfo && ['canceled', 'past_due', 'unpaid', 'incomplete'].includes(subscriptionStatusInfo.status)));

  // Reduced debug logging - only log when there are actual warnings
  if (shouldShowWarning) {
    console.warn('Subscription warning active:', {
      paymentsEnabled,
      isAuthenticated,
      hasActiveSubscription,
      subscriptionStatus: subscriptionStatusInfo?.status,
      shouldShowWarning
    });
  }

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
