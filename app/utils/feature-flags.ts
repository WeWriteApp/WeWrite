"use client";

import { useEffect, useState } from 'react';

// Define feature flag types
export type FeatureFlag =
  | 'subscription_management'
  | 'username_management'
  | 'map_view'
  | 'calendar_view'
  | 'groups';

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
  console.log(`[DEBUG] Checking feature flag ${flag} for user ${userEmail || 'unknown'}`);

  try {
    // For the 'groups' flag, only allow admin users regardless of database setting
    if (flag === 'groups') {
      const isUserAdmin = isAdmin(userEmail);
      console.log(`[DEBUG] GROUPS FLAG CHECK - User is admin: ${isUserAdmin}`);

      // If user is not an admin, always return false for groups feature
      if (!isUserAdmin) {
        console.log(`[DEBUG] GROUPS FLAG CHECK - Non-admin user, disabling groups feature`);
        return false;
      }

      // For admin users, continue to check the database setting
      console.log(`[DEBUG] GROUPS FLAG CHECK - Admin user, checking database setting`);
    }

    // Check the database for the feature flag setting
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase/database');

    console.log(`[DEBUG] Database reference created for feature flag ${flag}`);
    const featureFlagsRef = doc(db, 'config', 'featureFlags');

    console.log(`[DEBUG] Fetching feature flags document from Firestore`);
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const flagsData = featureFlagsDoc.data();
      console.log(`[DEBUG] Feature flags data:`, flagsData);

      // Enhanced debugging for groups flag
      if (flag === 'groups') {
        console.log(`[DEBUG] GROUPS FLAG CHECK - Raw value in database:`, flagsData[flag]);
        console.log(`[DEBUG] GROUPS FLAG CHECK - Type of value:`, typeof flagsData[flag]);
        console.log(`[DEBUG] GROUPS FLAG CHECK - Strict equality check (=== true):`, flagsData[flag] === true);
        console.log(`[DEBUG] GROUPS FLAG CHECK - Loose equality check (== true):`, flagsData[flag] == true);
        console.log(`[DEBUG] GROUPS FLAG CHECK - Boolean conversion:`, Boolean(flagsData[flag]));
      }

      const isEnabledInDb = flagsData[flag] === true;
      console.log(`[DEBUG] Feature flag ${flag} in database: ${isEnabledInDb}`);

      return isEnabledInDb;
    } else {
      console.log(`[DEBUG] No feature flags document found in database, checking defaults`);

      // If no document exists, fall back to defaults
      // All features are disabled by default for consistency
      console.log(`[DEBUG] Feature flag ${flag}: No document exists, defaulting to OFF`);
      return false;
    }
  } catch (error) {
    console.error(`[DEBUG] Error checking feature flag ${flag}:`, error);
    console.error(`[DEBUG] Error details:`, error);

    // On error, default to disabled for consistency
    return false;
  }
};

/**
 * React hook to check if a feature is enabled
 * @param flag - The feature flag to check
 * @param userEmail - The current user's email (for admin-only features)
 * @returns boolean indicating if the feature is enabled
 *
 * Note: When a feature is disabled, all related UI elements should be completely hidden,
 * not just shown in a disabled state. No explanatory text should be shown.
 */
export const useFeatureFlag = (flag: FeatureFlag, userEmail?: string | null): boolean => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);

  useEffect(() => {
    // Initial check
    const checkFeatureFlag = async () => {
      try {
        console.log(`[DEBUG] Checking feature flag ${flag} for user ${userEmail || 'unknown'}`);
        const enabled = await isFeatureEnabled(flag, userEmail);
        console.log(`[DEBUG] useFeatureFlag hook for ${flag}, user ${userEmail || 'unknown'}: ${enabled}`);

        // Enhanced debugging for groups flag
        if (flag === 'groups') {
          console.log(`[DEBUG] GROUPS FLAG HOOK - Setting state to:`, enabled);
        }

        setIsEnabled(enabled);
      } catch (error) {
        console.error(`[DEBUG] Error in useFeatureFlag for ${flag}:`, error);
        // Default all features to OFF on error for consistency
        setIsEnabled(false);
      }
    };

    checkFeatureFlag();

    // Set up a real-time listener for feature flag changes
    const setupListener = async () => {
      try {
        const { doc, onSnapshot } = await import('firebase/firestore');
        const { db } = await import('../firebase/database');

        const featureFlagsRef = doc(db, 'config', 'featureFlags');

        // Return the unsubscribe function
        return onSnapshot(featureFlagsRef, (snapshot) => {
          if (snapshot.exists()) {
            const flagsData = snapshot.data();
            const isEnabledInDb = flagsData[flag] === true;

            // Enhanced debugging for groups flag
            if (flag === 'groups') {
              console.log(`[DEBUG] GROUPS FLAG LISTENER - Raw value in database:`, flagsData[flag]);
              console.log(`[DEBUG] GROUPS FLAG LISTENER - Evaluated to:`, isEnabledInDb);
            }

            console.log(`Feature flag ${flag} changed in database: ${isEnabledInDb}`);
            setIsEnabled(isEnabledInDb);
          } else {
            // If document doesn't exist, default all features to disabled for consistency
            setIsEnabled(false);
          }
        });
      } catch (error) {
        console.error(`Error setting up listener for feature flag ${flag}:`, error);
        return null;
      }
    };

    // Set up the listener and store the unsubscribe function
    const unsubscribePromise = setupListener();

    // Clean up the listener when the component unmounts
    return () => {
      unsubscribePromise.then(unsubscribe => {
        if (unsubscribe) unsubscribe();
      });
    };
  }, [flag, userEmail]);

  return isEnabled;
};
