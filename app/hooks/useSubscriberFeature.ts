'use client';

/**
 * useSubscriberFeature Hook
 *
 * Combines feature flags with subscription status to determine
 * if a feature is available to the current user.
 *
 * Used for features that require both:
 * 1. The feature flag to be enabled
 * 2. An active subscription
 *
 * Examples: private_pages, groups
 */

import { useFeatureFlags } from '../contexts/FeatureFlagContext';
import { useSubscription } from '../contexts/SubscriptionContext';

export interface SubscriberFeatureResult {
  /** Feature is fully available (flag enabled + has subscription) */
  isAvailable: boolean;
  /** Feature flag is enabled but user needs subscription */
  requiresSubscription: boolean;
  /** Feature flag is disabled entirely */
  isDisabled: boolean;
  /** Loading state for either flags or subscription */
  isLoading: boolean;
}

/**
 * Check if a subscriber-only feature is available to the current user
 *
 * @param featureFlag - The feature flag name (e.g., 'private_pages', 'groups')
 * @returns Object with availability status
 *
 * @example
 * const { isAvailable, requiresSubscription } = useSubscriberFeature('private_pages');
 *
 * if (isAvailable) {
 *   // Show the feature
 * } else if (requiresSubscription) {
 *   // Show subscription upsell
 * } else {
 *   // Feature is disabled - don't show anything
 * }
 */
export function useSubscriberFeature(featureFlag: string): SubscriberFeatureResult {
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const { hasActiveSubscription, isLoading: subscriptionLoading } = useSubscription();

  const flagEnabled = isEnabled(featureFlag);
  const isLoading = flagsLoading || subscriptionLoading;

  return {
    isAvailable: flagEnabled && hasActiveSubscription,
    requiresSubscription: flagEnabled && !hasActiveSubscription,
    isDisabled: !flagEnabled,
    isLoading,
  };
}

/**
 * Hook for checking multiple subscriber features at once
 *
 * @example
 * const features = useSubscriberFeatures(['private_pages', 'groups']);
 * // features.private_pages.isAvailable, features.groups.isAvailable, etc.
 */
export function useSubscriberFeatures(
  featureFlags: string[]
): Record<string, SubscriberFeatureResult> {
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const { hasActiveSubscription, isLoading: subscriptionLoading } = useSubscription();

  const isLoading = flagsLoading || subscriptionLoading;

  const result: Record<string, SubscriberFeatureResult> = {};

  for (const flag of featureFlags) {
    const flagEnabled = isEnabled(flag);
    result[flag] = {
      isAvailable: flagEnabled && hasActiveSubscription,
      requiresSubscription: flagEnabled && !hasActiveSubscription,
      isDisabled: !flagEnabled,
      isLoading,
    };
  }

  return result;
}
