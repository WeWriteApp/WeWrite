"use client";

import { useEffect, useState, useMemo, useContext } from 'react';

// Define feature flag types
export type FeatureFlag =
  | 'payments'
  | 'username_management'
  | 'map_view'
  | 'calendar_view'
  | 'groups'
  | 'notifications'
  | 'link_functionality'
  | 'daily_notes';

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
    const { db } = await import('../firebase/database');

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
        payments: false,
        username_management: false,
        map_view: false,
        calendar_view: false,
        groups: true,
        notifications: false,
        link_functionality: true,
        daily_notes: false
      };
      isInitialized = true;
    }
  } catch (error) {
    console.error('[FeatureFlags] Error initializing feature flags:', error);

    // Set safe defaults on error
    globalFeatureFlags = {
      payments: false,
      username_management: false,
      map_view: false,
      calendar_view: false,
      groups: true,
      notifications: false,
      link_functionality: true,
      daily_notes: false
    };
    isInitialized = true;
  }
};

/**
 * Get the status of a feature flag (synchronous)
 * @param flag - The feature flag to check
 * @param userEmail - The current user's email (for admin-only features)
 * @returns boolean indicating if the feature is enabled
 */
export const isFeatureEnabled = (flag: FeatureFlag, userEmail?: string | null): boolean => {
  // If not initialized, return false (will be updated when initialization completes)
  if (!isInitialized) {
    console.log(`[FeatureFlags] Flag ${flag} checked before initialization, returning false`);
    return false;
  }

  const isEnabled = globalFeatureFlags[flag] === true;
  console.log(`[FeatureFlags] Flag ${flag} for user ${userEmail || 'unknown'}: ${isEnabled}`);
  return isEnabled;
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
      console.error(`[FeatureFlags] Error in useFeatureFlag for ${flag}:`, error);
      setIsEnabled(false);
      setInitialized(true);
    });
  }, [flag, userEmail]);

  // Return false until initialized to prevent flashing
  return initialized ? isEnabled : false;
};
