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

    const defaultsPromise = db.collection(getCollectionName('featureFlags')).doc('defaults').get();
    const overridesPromise = userId
      ? db.collection(getCollectionName('featureFlagOverrides')).doc(userId).get()
      : Promise.resolve(null);

    const [defaultsDoc, overridesDoc] = await Promise.all([defaultsPromise, overridesPromise]);

    const defaults = defaultsDoc.exists ? defaultsDoc.data()?.flags || {} : {};
    const overrides: Record<string, boolean> = overridesDoc?.exists ? overridesDoc.data()?.flags || {} : {};
    const merged = { ...defaults, ...overrides };

    // Keep historical behavior: groups defaults to enabled unless explicitly set false.
    return merged.groups !== false;
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
