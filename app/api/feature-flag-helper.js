import { db } from "../firebase/database";
import { doc, getDoc } from 'firebase/firestore';

/**
 * Check if a feature flag is enabled
 * @param {string} flagName - The name of the feature flag to check
 * @returns {Promise<boolean>} - Whether the feature flag is enabled
 */
export async function isFeatureEnabled(flagName) {
  try {
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const flagsData = featureFlagsDoc.data();
      return flagsData[flagName] === true;
    }

    // Default to disabled if no document exists
    return false;
  } catch (error) {
    console.error(`Error checking feature flag ${flagName}:`, error);
    // Default to disabled on error
    return false;
  }
}

/**
 * Middleware to check if payments feature is enabled
 * Returns a 404 response if the feature is disabled
 * @returns {Promise<Response|null>} - Response object if feature is disabled, null if enabled
 */
export async function checkPaymentsFeatureFlag() {
  const isEnabled = await isFeatureEnabled('payments');
  
  if (!isEnabled) {
    return new Response(JSON.stringify({ 
      error: 'Feature not available',
      message: 'Payment functionality is currently disabled'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return null;
}
