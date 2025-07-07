"use client";

import { useEffect, useState, useMemo, useContext } from 'react';

// Define feature flag types
export type FeatureFlag =
  | 'payments'
  | 'map_view'
  | 'calendar_view'
  | 'inactive_subscription';

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

// Global feature flag state
let globalFeatureFlags: Record<string, boolean> = {};
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize feature flags from database
 */
const initializeFeatureFlags = async (): Promise<void> => {
  if (isInitialized) return;

  try {
    console.log('[FeatureFlags] Initializing feature flags from database...');

    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase/config');

    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const flagsData = featureFlagsDoc.data();
      console.log('[FeatureFlags] Feature flags loaded:', flagsData);

      // Store all flags globally
      globalFeatureFlags = { ...flagsData };
      isInitialized = true;
    } else {
      console.log('[FeatureFlags] No feature flags document found, using defaults');

      // Set default flags
      globalFeatureFlags = {
        payments: true, // Temporarily enabled for testing
        map_view: false,
        calendar_view: false
      };
      isInitialized = true;
    }
  } catch (error) {
    console.error('[FeatureFlags] Error initializing feature flags:', error);

    // Set safe defaults on error
    globalFeatureFlags = {
      payments: false,
      map_view: false,
      calendar_view: false
    };
    isInitialized = true;
  }
};

/**
 * Get the status of a feature flag (synchronous) - only checks global flags
 * @param flag - The feature flag to check
 * @param userEmail - The current user's email (for admin-only features)
 * @returns boolean indicating if the feature is enabled globally
 */
export const isFeatureEnabled = (flag: FeatureFlag, userEmail?: string | null): boolean => {
  // If not initialized, return false (will be updated when initialization completes)
  if (!isInitialized) {
    return false;
  }

  const isEnabled = globalFeatureFlags[flag] === true;
  return isEnabled;
};

/**
 * Check if a feature is enabled for a specific user (async)
 * This checks both global flags and user-specific overrides
 * @param flag - The feature flag to check
 * @param userId - The current user's UID
 * @returns Promise<boolean> indicating if the feature is enabled for this user
 */
export const isFeatureEnabledForUser = async (flag: FeatureFlag, userId?: string | null): Promise<boolean> => {
  // If not initialized, initialize first
  if (!isInitialized) {
    await initializeFeatureFlags();
  }

  // Get global flag status
  const globalEnabled = globalFeatureFlags[flag] === true;

  // If no user ID, return global status
  if (!userId) {
    console.log(`[FeatureFlags] No user ID provided, returning global flag ${flag}: ${globalEnabled}`);
    return globalEnabled;
  }

  try {
    // Check for user-specific override
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase/config');

    const featureOverrideRef = doc(db, 'featureOverrides', `${userId}_${flag}`);
    const featureOverrideDoc = await getDoc(featureOverrideRef);

    if (featureOverrideDoc.exists()) {
      const data = featureOverrideDoc.data();
      const userOverride = data.enabled;
      console.log(`[FeatureFlags] User override found for ${flag} (user: ${userId}): ${userOverride}`);
      return userOverride;
    } else {
      // No override, use global setting
      console.log(`[FeatureFlags] No user override for ${flag} (user: ${userId}), using global: ${globalEnabled}`);
      return globalEnabled;
    }
  } catch (error) {
    console.error(`[FeatureFlags] Error checking user override for ${flag}:`, error);
    // Fall back to global setting on error
    return globalEnabled;
  }
};

/**
 * React hook to check if a feature is enabled for the current user
 * This checks both global flags and user-specific overrides when userId is provided
 * @param flag - The feature flag to check
 * @param userEmail - The current user's email (for logging purposes)
 * @param userId - The current user's UID (for checking overrides) - optional for backward compatibility
 * @returns boolean indicating if the feature is enabled for this user
 *
 * Note: When a feature is disabled, all related UI elements should be completely hidden,
 * not just shown in a disabled state. No explanatory text should be shown.
 */
export const useFeatureFlag = (flag: FeatureFlag, userEmail?: string | null, userId?: string | null): boolean => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const checkFeatureFlag = async () => {
      try {
        console.log(`[FeatureFlags] useFeatureFlag called for ${flag} with userId: ${userId}, userEmail: ${userEmail}`);

        // Special case for inactive_subscription - check localStorage testing tool
        if (flag === 'inactive_subscription') {
          if (typeof window !== 'undefined') {
            const testingEnabled = localStorage.getItem('admin-inactive-subscription-test');
            const enabled = testingEnabled ? JSON.parse(testingEnabled) : false;
            console.log(`[FeatureFlags] Inactive subscription testing tool result: ${enabled}`);
            if (isMounted) {
              setIsEnabled(enabled);
              setInitialized(true);
            }
            return;
          }
        }

        // If userId is provided, check user-specific overrides
        if (userId) {
          console.log(`[FeatureFlags] Checking user-specific overrides for ${flag}`);
          const enabled = await isFeatureEnabledForUser(flag, userId);
          console.log(`[FeatureFlags] User-specific result for ${flag}: ${enabled}`);
          if (isMounted) {
            setIsEnabled(enabled);
            setInitialized(true);
          }
        } else {
          console.log(`[FeatureFlags] No userId provided, using legacy behavior for ${flag}`);
          // Fallback to legacy behavior for backward compatibility
          if (!initializationPromise) {
            initializationPromise = initializeFeatureFlags();
          }

          await initializationPromise;
          const enabled = isFeatureEnabled(flag, userEmail);
          console.log(`[FeatureFlags] Legacy result for ${flag}: ${enabled}`);
          if (isMounted) {
            setIsEnabled(enabled);
            setInitialized(true);
          }
        }
      } catch (error) {
        console.error(`[FeatureFlags] Error in useFeatureFlag for ${flag}:`, error);
        if (isMounted) {
          setIsEnabled(false);
          setInitialized(true);
        }
      }
    };

    checkFeatureFlag();

    return () => {
      isMounted = false;
    };
  }, [flag, userEmail, userId]);

  // Return false until initialized to prevent flashing
  return initialized ? isEnabled : false;
};

/**
 * Legacy hook for backward compatibility - only checks global flags
 * @deprecated Use useFeatureFlag with userId parameter instead
 */
export const useFeatureFlagLegacy = (flag: FeatureFlag, userEmail?: string | null): boolean => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);

  useEffect(() => {
    // Initialize feature flags if not already done
    if (!initializationPromise) {
      initializationPromise = initializeFeatureFlags();
    }

    // Wait for initialization and then set the flag value
    initializationPromise.then(() => {
      const enabled = isFeatureEnabled(flag, userEmail);
      setIsEnabled(enabled);
      setInitialized(true);
    }).catch((error) => {
      console.error(`[FeatureFlags] Error in useFeatureFlagLegacy for ${flag}:`, error);
      setIsEnabled(false);
      setInitialized(true);
    });
  }, [flag, userEmail]);

  // Return false until initialized to prevent flashing
  return initialized ? isEnabled : false;
};