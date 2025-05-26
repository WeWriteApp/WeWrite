/**
 * Feature flags hook for WeWrite
 * Provides React hooks for checking feature flags
 */

import { useMemo } from 'react';
import { isFeatureEnabled, FEATURE_FLAGS } from './featureFlags';

/**
 * React hook to check if a feature is enabled for the current user
 * @param {string} featureFlag - The feature flag to check
 * @param {string} userEmail - The user's email address
 * @returns {boolean} - Whether the feature is enabled for this user
 */
export const useFeatureFlag = (featureFlag, userEmail) => {
  return useMemo(() => {
    // Map feature flag names to our constants
    const flagMap = {
      'link_functionality': FEATURE_FLAGS.LINK_INSERTION,
      'link_insertion': FEATURE_FLAGS.LINK_INSERTION,
      'payments': FEATURE_FLAGS.PAYMENTS,
    };

    const mappedFlag = flagMap[featureFlag] || featureFlag;
    return isFeatureEnabled(mappedFlag, userEmail);
  }, [featureFlag, userEmail]);
};

/**
 * React hook to get all enabled features for the current user
 * @param {string} userEmail - The user's email address
 * @returns {string[]} - Array of enabled feature flags
 */
export const useEnabledFeatures = (userEmail) => {
  return useMemo(() => {
    if (!userEmail) return [];

    return Object.keys(FEATURE_FLAGS).filter(flag =>
      isFeatureEnabled(FEATURE_FLAGS[flag], userEmail)
    );
  }, [userEmail]);
};
