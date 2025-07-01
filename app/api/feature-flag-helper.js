/**
 * Check if a feature flag is enabled using Firebase Admin SDK
 * @param {string} flagName - The name of the feature flag to check
 * @returns {Promise<boolean>} - Whether the feature flag is enabled
 */
export async function isFeatureEnabled(flagName) {
  try {
    // Use Firebase Admin SDK for server-side operations
    const { initAdmin } = await import('../firebase/admin');
    const { getFirestore } = await import('firebase-admin/firestore');

    const app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin not initialized, defaulting feature flag to false');
      return false;
    }

    const db = getFirestore();
    const featureFlagsRef = db.collection('config').doc('featureFlags');
    const featureFlagsDoc = await featureFlagsRef.get();

    if (featureFlagsDoc.exists) {
      const flagsData = featureFlagsDoc.data();
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
 * @param {string} flagName - The name of the feature flag to check
 * @param {string} userId - The user ID to check overrides for
 * @returns {Promise<boolean>} - Whether the feature flag is enabled for this user
 */
export async function isFeatureEnabledForUser(flagName, userId) {
  try {
    // Use Firebase Admin SDK for server-side operations
    const { initAdmin } = await import('../firebase/admin');
    const { getFirestore } = await import('firebase-admin/firestore');

    const app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin not initialized, defaulting feature flag to false');
      return false;
    }

    const db = getFirestore();

    // First check global flag
    const featureFlagsRef = db.collection('config').doc('featureFlags');
    const featureFlagsDoc = await featureFlagsRef.get();

    let globalEnabled = false;
    if (featureFlagsDoc.exists) {
      const flagsData = featureFlagsDoc.data();
      globalEnabled = flagsData[flagName] === true;
    }

    console.log(`[FeatureFlag] ${flagName} global: ${globalEnabled}`);

    // If no user ID provided, return global setting
    if (!userId) {
      return globalEnabled;
    }

    // Check for user-specific override
    const featureOverrideRef = db.collection('featureOverrides').doc(`${userId}_${flagName}`);
    const featureOverrideDoc = await featureOverrideRef.get();

    if (featureOverrideDoc.exists) {
      const data = featureOverrideDoc.data();
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
 * @param {string} userId - Optional user ID to check user-specific overrides
 * @returns {Promise<NextResponse|null>} - NextResponse object if feature is disabled, null if enabled
 */
export async function checkPaymentsFeatureFlag(userId = null) {
  try {
    const isEnabled = userId
      ? await isFeatureEnabledForUser('payments', userId)
      : await isFeatureEnabled('payments');

    console.log(`[FeatureFlag] checkPaymentsFeatureFlag: payments=${isEnabled}${userId ? ` (user: ${userId})` : ' (global)'}`);

    if (!isEnabled) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({
        error: 'Feature not available',
        message: 'Payment functionality is currently disabled'
      }, { status: 404 });
    }

    return null;
  } catch (error) {
    console.error('Error checking payments feature flag:', error);
    const { NextResponse } = await import('next/server');
    return NextResponse.json({
      error: 'Feature not available',
      message: 'Error checking feature availability'
    }, { status: 500 });
  }
}