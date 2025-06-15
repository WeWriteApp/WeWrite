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
 * Middleware to check if payments feature is enabled
 * Returns a NextResponse object if the feature is disabled, null if enabled
 * @returns {Promise<NextResponse|null>} - NextResponse object if feature is disabled, null if enabled
 */
export async function checkPaymentsFeatureFlag() {
  try {
    const isEnabled = await isFeatureEnabled('payments');
    console.log(`[FeatureFlag] checkPaymentsFeatureFlag: payments=${isEnabled}`);

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
