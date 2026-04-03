import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import { createErrorResponse } from '../auth-helper';

/**
 * Check if the groups feature flag is enabled for a user
 */
export async function isGroupsEnabled(userId: string | null): Promise<boolean> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) return false;
    const db = admin.firestore();

    // Check global defaults
    const defaultsDoc = await db.collection(getCollectionName('featureFlags')).doc('defaults').get();
    const defaults = defaultsDoc.exists ? defaultsDoc.data()?.flags || {} : {};

    // Check user overrides
    let overrides: Record<string, boolean> = {};
    if (userId) {
      const overridesDoc = await db.collection(getCollectionName('featureFlagOverrides')).doc(userId).get();
      overrides = overridesDoc.exists ? overridesDoc.data()?.flags || {} : {};
    }

    const merged = { ...defaults, ...overrides };

    // Auto-enable groups for admin users (matches feature-flags route logic)
    if (userId && !merged.groups) {
      const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
      if (userDoc.exists && userDoc.data()?.isAdmin === true) {
        return true;
      }
    }

    return Boolean(merged.groups);
  } catch {
    return false;
  }
}

/**
 * Returns a FEATURE_DISABLED error response if groups is not enabled
 */
export function groupsDisabledResponse() {
  return createErrorResponse('FEATURE_DISABLED', 'Groups feature is not enabled');
}
