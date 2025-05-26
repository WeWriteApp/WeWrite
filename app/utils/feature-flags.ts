"use client";

import { useEffect, useState, useMemo } from 'react';

// Define feature flag types
export type FeatureFlag =
  | 'payments'
  | 'username_management'
  | 'map_view'
  | 'calendar_view'
  | 'groups'
  | 'notifications'
  | 'link_functionality';

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
    // Check groups flag from Firestore instead of hard-coding it
    if (flag === 'groups') {
      console.log(`[DEBUG] GROUPS FLAG CHECK - Checking groups feature flag from database`);
      // Fall through to normal flag checking logic
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

  // Memoize the flag and userEmail to prevent unnecessary effect re-runs
  const memoizedFlag = useMemo(() => flag, [flag]);
  const memoizedUserEmail = useMemo(() => userEmail, [userEmail]);

  useEffect(() => {
    // Initial check
    const checkFeatureFlag = async () => {
      try {
        console.log(`[DEBUG] Checking feature flag ${memoizedFlag} for user ${memoizedUserEmail || 'unknown'}`);
        const enabled = await isFeatureEnabled(memoizedFlag, memoizedUserEmail);
        console.log(`[DEBUG] useFeatureFlag hook for ${memoizedFlag}, user ${memoizedUserEmail || 'unknown'}: ${enabled}`);

        // Enhanced debugging for groups flag
        if (memoizedFlag === 'groups') {
          console.log(`[DEBUG] GROUPS FLAG HOOK - Setting state to:`, enabled);
        }

        setIsEnabled(enabled);
      } catch (error) {
        console.error(`[DEBUG] Error in useFeatureFlag for ${memoizedFlag}:`, error);
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
        let lastUpdate = 0;
        const THROTTLE_MS = 1000; // Throttle updates to max once per second

        return onSnapshot(featureFlagsRef, (snapshot) => {
          const now = Date.now();

          // Throttle updates to prevent excessive re-renders
          if (now - lastUpdate < THROTTLE_MS) {
            return;
          }
          lastUpdate = now;

          if (snapshot.exists()) {
            const flagsData = snapshot.data();
            const isEnabledInDb = flagsData[memoizedFlag] === true;

            // Enhanced debugging for groups flag
            if (memoizedFlag === 'groups') {
              console.log(`[DEBUG] GROUPS FLAG LISTENER - Raw value in database:`, flagsData[memoizedFlag]);
              console.log(`[DEBUG] GROUPS FLAG LISTENER - Evaluated to:`, isEnabledInDb);
            }

            console.log(`Feature flag ${memoizedFlag} changed in database: ${isEnabledInDb}`);
            setIsEnabled(isEnabledInDb);
          } else {
            // If document doesn't exist, default all features to disabled for consistency
            setIsEnabled(false);
          }
        });
      } catch (error) {
        console.error(`Error setting up listener for feature flag ${memoizedFlag}:`, error);
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
  }, [memoizedFlag, memoizedUserEmail]);

  return isEnabled;
};
