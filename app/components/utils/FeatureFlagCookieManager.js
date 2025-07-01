"use client";

import { useEffect } from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useSyncFeatureFlagToCookie } from '../../utils/feature-flag-cookies';

/**
 * Component that syncs feature flags to cookies for middleware
 * This component doesn't render anything visible
 *
 * Note: Groups feature flag has been removed as the groups feature
 * has been completely removed from the application.
 */
export default function FeatureFlagCookieManager() {
  const { session } = useCurrentAccount();

  // Groups feature flag removed - no longer needed
  // If other feature flags need cookie syncing in the future, add them here

  // This component doesn't render anything visible
  return null;
}