"use client";

import { useContext, useEffect } from 'react';
import { AuthContext } from '../../providers/AuthProvider';
import { useSyncFeatureFlagToCookie } from '../../utils/feature-flag-cookies';

/**
 * Component that syncs feature flags to cookies for middleware
 * This component doesn't render anything visible
 *
 * Note: Groups feature flag has been removed as the groups feature
 * has been completely removed from the application.
 */
export default function FeatureFlagCookieManager() {
  const { user } = useContext(AuthContext);

  // Groups feature flag removed - no longer needed
  // If other feature flags need cookie syncing in the future, add them here

  // This component doesn't render anything visible
  return null;
}
