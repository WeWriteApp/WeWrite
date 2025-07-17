import { NextResponse } from 'next/server';
import { initAdmin } from '../firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { isTestUser } from '../utils/testUsers';

// Type definitions
interface FeatureFlagData {
  [flagName: string]: boolean;
}

interface FeatureOverrideData {
  enabled: boolean;
  userId?: string;
  flagName?: string;
}

/**
 * Check if a feature flag is enabled using Firebase Admin SDK
 * @param flagName - The name of the feature flag to check
 * @returns Whether the feature flag is enabled
 */
export async function isFeatureEnabled(flagName: string): Promise<boolean> {
  try {
    const app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin not initialized, defaulting feature flag to false');
      return false;
    }

    const db = getFirestore();
    const featureFlagsRef = db.collection(getCollectionName('config')).doc('featureFlags');
    const featureFlagsDoc = await featureFlagsRef.get();

    if (featureFlagsDoc.exists) {
      const flagsData = featureFlagsDoc.data() as FeatureFlagData;
      const isEnabled = flagsData[flagName] === true;
      console.log(`[FeatureFlag] ${flagName}: ${isEnabled}`);
      return isEnabled;
    }

    // Default to disabled if no document exists
    console.log(`[FeatureFlag] ${flagName}: false (no document)`);
    return false;
  } catch (error) {
    console.error(`Error checking feature flag ${flagName}:`, error);
    // Default to disabled on error
    return false;
  }
}

/**
 * Check if a feature is enabled for a specific user (checks both global flags and user overrides)
 * @param flagName - The name of the feature flag to check
 * @param userId - The user ID to check overrides for
 * @returns Whether the feature flag is enabled for this user
 */
export async function isFeatureEnabledForUser(flagName: string, userId: string | null): Promise<boolean> {
  try {
    // If no user ID provided, fall back to global setting
    if (!userId) {
      return await isFeatureEnabled(flagName);
    }

    // Check if the user is a test user - test users always have all features enabled
    if (isTestUser(userId)) {
      console.log(`[FeatureFlag] ${flagName} enabled for test user ${userId}: true (test user override)`);
      return true;
    }

    const app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin not initialized, defaulting feature flag to false');
      return false;
    }

    const db = getFirestore();

    // First check global flag
    const featureFlagsRef = db.collection(getCollectionName('config')).doc('featureFlags');
    const featureFlagsDoc = await featureFlagsRef.get();

    let globalEnabled = false;
    if (featureFlagsDoc.exists) {
      const flagsData = featureFlagsDoc.data() as FeatureFlagData;
      globalEnabled = flagsData[flagName] === true;
    }

    console.log(`[FeatureFlag] ${flagName} global: ${globalEnabled}`);

    // Check for user-specific override
    const featureOverrideRef = db.collection(getCollectionName('featureOverrides')).doc(`${userId}_${flagName}`);
    const featureOverrideDoc = await featureOverrideRef.get();

    if (featureOverrideDoc.exists) {
      const data = featureOverrideDoc.data() as FeatureOverrideData;
      const userOverride = data.enabled;
      console.log(`[FeatureFlag] ${flagName} user override for ${userId}: ${userOverride}`);
      return userOverride;
    } else {
      // No override, use global setting
      console.log(`[FeatureFlag] ${flagName} no user override for ${userId}, using global: ${globalEnabled}`);
      return globalEnabled;
    }
  } catch (error) {
    console.error(`Error checking feature flag ${flagName} for user ${userId}:`, error);
    // Default to disabled on error
    return false;
  }
}

/**
 * Middleware to check if payments feature is enabled for a specific user
 * Returns a NextResponse object if the feature is disabled, null if enabled
 * @param userId - Optional user ID to check user-specific overrides
 * @returns NextResponse object if feature is disabled, null if enabled
 */
export async function checkPaymentsFeatureFlag(userId: string | null = null): Promise<NextResponse | null> {
  try {
    const isEnabled = userId
      ? await isFeatureEnabledForUser('payments', userId)
      : await isFeatureEnabled('payments');

    console.log(`[FeatureFlag] checkPaymentsFeatureFlag: payments=${isEnabled}${userId ? ` (user: ${userId})` : ' (global)'}`);

    if (!isEnabled) {
      return NextResponse.json({
        error: 'Feature not available',
        message: 'Payment functionality is currently disabled'
      }, { status: 404 });
    }

    return null;
  } catch (error) {
    console.error('Error checking payments feature flag:', error);
    return NextResponse.json({
      error: 'Feature not available',
      message: 'Error checking feature availability'
    }, { status: 500 });
  }
}