"use client";

import Cookies from 'js-cookie';
import { useEffect } from 'react';
import { useFeatureFlag } from './feature-flags';

/**
 * Sets a cookie for a feature flag to be used by middleware
 * @param {string} flag - The feature flag name
 * @param {boolean} enabled - Whether the flag is enabled
 */
export const setFeatureFlagCookie = (flag, enabled) => {
  Cookies.set(`feature_${flag}`, enabled ? 'true' : 'false', { expires: 1 }); // 1 day expiry
};

/**
 * Hook to sync feature flag state to cookies for middleware
 * @param {string} flag - The feature flag to sync
 * @param {string|null} userEmail - The user's email
 */
export const useSyncFeatureFlagToCookie = (flag, userEmail) => {
  const isEnabled = useFeatureFlag(flag, userEmail);
  
  useEffect(() => {
    setFeatureFlagCookie(flag, isEnabled);
  }, [flag, isEnabled]);
  
  return isEnabled;
};