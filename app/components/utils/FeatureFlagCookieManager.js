"use client";

import { useContext, useEffect } from 'react';
import { AuthContext } from '../../providers/AuthProvider';
import { useSyncFeatureFlagToCookie } from '../../utils/feature-flag-cookies';

/**
 * Component that syncs feature flags to cookies for middleware
 * This component doesn't render anything visible
 */
export default function FeatureFlagCookieManager() {
  const { user } = useContext(AuthContext);

  // Sync the groups feature flag to cookies
  const groupsEnabled = useSyncFeatureFlagToCookie('groups', user?.email);

  // Log for debugging
  useEffect(() => {
    console.log('[DEBUG] FeatureFlagCookieManager - Groups feature flag:', groupsEnabled);
    console.log('[DEBUG] FeatureFlagCookieManager - User:', user?.email);
  }, [groupsEnabled, user?.email]);

  // This component doesn't render anything visible
  return null;
}
