"use client";

import { useEffect, useState } from 'react';

// Define feature flag types
export type FeatureFlag = 
  | 'subscription_management'
  | 'username_management'
  | 'map_view'
  | 'calendar_view';

// Define admin user IDs
const ADMIN_USER_IDS = [
  'jameigray2234@gmail.com',
];

/**
 * Check if a user is an admin
 * @param userEmail - The user's email
 * @returns boolean indicating if the user is an admin
 */
export const isAdmin = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return ADMIN_USER_IDS.includes(userEmail);
};

/**
 * Get the status of a feature flag
 * @param flag - The feature flag to check
 * @param userEmail - The current user's email (for admin-only features)
 * @returns boolean indicating if the feature is enabled
 */
export const isFeatureEnabled = (flag: FeatureFlag, userEmail?: string | null): boolean => {
  // Admin-only features
  const adminOnlyFeatures: FeatureFlag[] = [
    'subscription_management',
    'username_management',
  ];

  // If it's an admin-only feature, check if the user is an admin
  if (adminOnlyFeatures.includes(flag)) {
    return isAdmin(userEmail);
  }

  // Features that are disabled for everyone
  const disabledFeatures: FeatureFlag[] = [
    'map_view',
    'calendar_view',
  ];

  if (disabledFeatures.includes(flag)) {
    return false;
  }

  // Default to enabled for all other features
  return true;
};

/**
 * React hook to check if a feature is enabled
 * @param flag - The feature flag to check
 * @param userEmail - The current user's email (for admin-only features)
 * @returns boolean indicating if the feature is enabled
 */
export const useFeatureFlag = (flag: FeatureFlag, userEmail?: string | null): boolean => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);

  useEffect(() => {
    setIsEnabled(isFeatureEnabled(flag, userEmail));
  }, [flag, userEmail]);

  return isEnabled;
};
