import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from "../../firebase/config';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt?: string;
  lastModified?: string;
}

// Define all available feature flags
const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'groups',
    name: 'Groups',
    description: 'Enable group functionality for organizing pages and collaboration.',
    enabled: true,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Enable in-app notifications for follows, page links, and other activities.',
    enabled: false,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  },
  {
    id: 'payments',
    name: 'Payments',
    description: 'Enable subscription functionality and UI for managing user subscriptions.',
    enabled: false,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  },
  {
    id: 'username_management',
    name: 'Username Management',
    description: 'Allow admins to manage user usernames and handle username-related operations.',
    enabled: false,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  },
  {
    id: 'map_view',
    name: 'Map View',
    description: 'Enable map view for pages with location data and geographic visualization.',
    enabled: false,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  },
  {
    id: 'calendar_view',
    name: 'Calendar View',
    description: 'Enable calendar view for activity tracking and temporal organization.',
    enabled: false,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  },
  {
    id: 'link_functionality',
    name: 'Link Functionality',
    description: 'Enable link creation and editing in page editors. When disabled, shows a modal with social media follow prompt.',
    enabled: true,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  }
];

export function useFeatureFlags() {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>(DEFAULT_FEATURE_FLAGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  // Load feature flags from Firestore with validation
  const loadFeatureFlags = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Prevent excessive API calls
      const now = Date.now();
      if (!forceRefresh && now - lastSyncTime < 5000) {
        console.log('[useFeatureFlags] Skipping load - too recent');
        setIsLoading(false);
        return;
      }

      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      if (featureFlagsDoc.exists()) {
        const flagsData = featureFlagsDoc.data();
        console.log('[useFeatureFlags] Feature flags from database:', flagsData);

        // Validate and filter flags
        const validFlags = {};
        const invalidFlags = [];

        Object.keys(flagsData).forEach(key => {
          if (DEFAULT_FEATURE_FLAGS.some(flag => flag.id === key)) {
            validFlags[key] = flagsData[key];
          } else {
            invalidFlags.push(key);
            console.log(`[useFeatureFlags] Found invalid feature flag: ${key}`);
          }
        });

        // Update local state with validated data
        setFeatureFlags(prev =>
          prev.map(flag => ({
            ...flag,
            enabled: validFlags[flag.id] !== undefined ? validFlags[flag.id] : flag.enabled,
            lastModified: new Date().toISOString()
          }))
        );

        // Clean up invalid flags from database
        if (invalidFlags.length > 0) {
          console.log('[useFeatureFlags] Cleaning up invalid flags:', invalidFlags);
          await setDoc(featureFlagsRef, validFlags);
        }

        setLastSyncTime(now);
      } else {
        // Create initial document
        console.log('[useFeatureFlags] Creating initial feature flags document');
        const initialFlags = {};
        DEFAULT_FEATURE_FLAGS.forEach(flag => {
          initialFlags[flag.id] = flag.enabled;
        });
        await setDoc(featureFlagsRef, initialFlags);
        setLastSyncTime(now);
      }
    } catch (err) {
      console.error('[useFeatureFlags] Error loading feature flags:', err);
      setError('Failed to load feature flags');
    } finally {
      setIsLoading(false);
    }
  }, [lastSyncTime]);

  // Toggle a specific feature flag with validation
  const toggleFeatureFlag = useCallback(async (flagId: string, newState?: boolean) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate flag exists
      const currentFlag = featureFlags.find(flag => flag.id === flagId);
      if (!currentFlag) {
        throw new Error(`Feature flag ${flagId} not found`);
      }

      const newEnabledState = newState !== undefined ? newState : !currentFlag.enabled;
      console.log(`[useFeatureFlags] Toggling ${flagId}: ${currentFlag.enabled} → ${newEnabledState}`);

      // Update local state immediately for UI responsiveness
      setFeatureFlags(prev =>
        prev.map(flag =>
          flag.id === flagId
            ? { ...flag, enabled: newEnabledState, lastModified: new Date().toISOString() }
            : flag
        )
      );

      // Update database
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      let currentData = {};
      if (featureFlagsDoc.exists()) {
        currentData = featureFlagsDoc.data();
      }

      // Update the specific flag
      const updatedData = {
        ...currentData,
        [flagId]: newEnabledState
      };

      await setDoc(featureFlagsRef, updatedData);

      // Update metadata
      const featureMetaRef = doc(db, 'config', 'featureMetadata');
      const timestamp = new Date().toISOString();

      try {
        await updateDoc(featureMetaRef, {
          [`${flagId}.lastModified`]: timestamp
        });
      } catch (metaError) {
        // If metadata document doesn't exist, create it
        const metaData = {};
        DEFAULT_FEATURE_FLAGS.forEach(flag => {
          metaData[flag.id] = {
            createdAt: flag.createdAt || timestamp,
            lastModified: flag.id === flagId ? timestamp : flag.lastModified || timestamp,
            description: flag.description
          };
        });
        await setDoc(featureMetaRef, metaData);
      }

      setLastSyncTime(Date.now());
      console.log(`[useFeatureFlags] Successfully updated ${flagId} to ${newEnabledState}`);

    } catch (err) {
      console.error(`[useFeatureFlags] Error toggling feature flag ${flagId}:`, err);
      setError(`Failed to update ${flagId}: ${err.message}`);

      // Revert local state and reload from database
      await loadFeatureFlags(true);
      throw err; // Re-throw for caller to handle
    } finally {
      setIsLoading(false);
    }
  }, [featureFlags, loadFeatureFlags]);

  // Batch update multiple feature flags
  const batchUpdateFeatureFlags = useCallback(async (updates: Record<string, boolean>) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[useFeatureFlags] Batch updating flags:', updates);

      // Validate all flags exist
      const invalidFlags = Object.keys(updates).filter(
        flagId => !DEFAULT_FEATURE_FLAGS.some(flag => flag.id === flagId)
      );

      if (invalidFlags.length > 0) {
        throw new Error(`Invalid feature flags: ${invalidFlags.join(', ')}`);
      }

      // Update local state
      setFeatureFlags(prev =>
        prev.map(flag => ({
          ...flag,
          enabled: updates[flag.id] !== undefined ? updates[flag.id] : flag.enabled,
          lastModified: new Date().toISOString()
        }))
      );

      // Update database
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      let currentData = {};
      if (featureFlagsDoc.exists()) {
        currentData = featureFlagsDoc.data();
      }

      const updatedData = { ...currentData, ...updates };
      await setDoc(featureFlagsRef, updatedData);

      setLastSyncTime(Date.now());
      console.log('[useFeatureFlags] Batch update completed successfully');

    } catch (err) {
      console.error('[useFeatureFlags] Error in batch update:', err);
      setError(`Batch update failed: ${err.message}`);
      await loadFeatureFlags(true);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadFeatureFlags]);

  // Get a specific feature flag
  const getFeatureFlag = useCallback((flagId: string): FeatureFlag | undefined => {
    return featureFlags.find(flag => flag.id === flagId);
  }, [featureFlags]);

  // Check if a feature is enabled
  const isFeatureEnabled = useCallback((flagId: string): boolean => {
    const flag = getFeatureFlag(flagId);
    return flag ? flag.enabled : false;
  }, [getFeatureFlag]);

  // Validate current state against database
  const validateState = useCallback(async (): Promise<boolean> => {
    try {
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      if (!featureFlagsDoc.exists()) {
        return false;
      }

      const dbData = featureFlagsDoc.data();

      // Check if local state matches database
      for (const flag of featureFlags) {
        if (dbData[flag.id] !== flag.enabled) {
          console.log(`[useFeatureFlags] State mismatch for ${flag.id}: local=${flag.enabled}, db=${dbData[flag.id]}`);
          return false;
        }
      }

      return true;
    } catch (err) {
      console.error('[useFeatureFlags] Error validating state:", err);
      return false;
    }
  }, [featureFlags]);

  // Load feature flags on mount
  useEffect(() => {
    loadFeatureFlags();
  }, [loadFeatureFlags]);

  return {
    featureFlags,
    isLoading,
    error,
    lastSyncTime,
    loadFeatureFlags,
    toggleFeatureFlag,
    batchUpdateFeatureFlags,
    getFeatureFlag,
    isFeatureEnabled,
    validateState
  };
}
