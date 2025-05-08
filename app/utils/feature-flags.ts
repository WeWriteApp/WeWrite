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
  'jamiegray2234@gmail.com',
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
export const isFeatureEnabled = async (flag: FeatureFlag, userEmail?: string | null): Promise<boolean> => {
  console.log(`Checking feature flag ${flag} for user ${userEmail || 'unknown'}`);

  try {
    // Always check the database first, regardless of admin status
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase/database');

    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const flagsData = featureFlagsDoc.data();
      const isEnabledInDb = flagsData[flag] === true;
      console.log(`Feature flag ${flag} in database: ${isEnabledInDb}`);

      // Return the database value regardless of admin status
      return isEnabledInDb;
    } else {
      console.log(`No feature flags document found in database, checking defaults`);

      // If no document exists, fall back to defaults
      // Admin-only features - disabled by default, even for admins
      const adminOnlyFeatures: FeatureFlag[] = [
        'subscription_management',
        'username_management',
      ];

      if (adminOnlyFeatures.includes(flag)) {
        console.log(`Feature flag ${flag}: Admin-only feature, defaulting to OFF`);
        return false;
      }

      // Features that are disabled for everyone
      const disabledFeatures: FeatureFlag[] = [
        'map_view',
        'calendar_view',
      ];

      if (disabledFeatures.includes(flag)) {
        console.log(`Feature flag ${flag}: Globally disabled feature`);
        return false;
      }

      // Default to enabled for all other features
      console.log(`Feature flag ${flag}: Default enabled feature`);
      return true;
    }
  } catch (error) {
    console.error(`Error checking feature flag ${flag}:`, error);

    // On error, default to disabled for admin-only features
    const adminOnlyFeatures: FeatureFlag[] = [
      'subscription_management',
      'username_management',
    ];

    if (adminOnlyFeatures.includes(flag)) {
      return false;
    }

    // Default to enabled for all other features
    return true;
  }
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
    const checkFeatureFlag = async () => {
      try {
        const enabled = await isFeatureEnabled(flag, userEmail);
        console.log(`useFeatureFlag hook for ${flag}, user ${userEmail || 'unknown'}: ${enabled}`);
        setIsEnabled(enabled);
      } catch (error) {
        console.error(`Error in useFeatureFlag for ${flag}:`, error);
        // Default admin features to OFF on error
        if (flag === 'subscription_management' || flag === 'username_management') {
          setIsEnabled(false);
        } else {
          setIsEnabled(true);
        }
      }
    };

    checkFeatureFlag();
  }, [flag, userEmail]);

  return isEnabled;
};
