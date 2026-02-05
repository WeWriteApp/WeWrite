import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

/**
 * Check if the groups feature flag is enabled for a user
 */
async function isGroupsEnabled(userId: string | null): Promise<boolean> {
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
    return Boolean(merged.groups);
  } catch {
    return false;
  }
}

/**
 * POST /api/groups - Create a new group
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    if (!(await isGroupsEnabled(userId))) {
      return createErrorResponse('FEATURE_DISABLED', 'Groups feature is not enabled');
    }

    const body = await request.json();
    const { name, description, visibility } = body;

    if (!name) {
      return createErrorResponse('BAD_REQUEST', 'Name is required');
    }

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    // Get user info
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    const username = userDoc.exists ? userDoc.data()?.username || '' : '';

    const now = new Date().toISOString();
    const groupData = {
      name,
      description: description || '',
      visibility: visibility || 'public',
      ownerId: userId,
      ownerUsername: username,
      memberIds: [userId],
      memberCount: 1,
      pageCount: 0,
      fundDistribution: { [userId]: 100 },
      encrypted: false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };

    const docRef = await db.collection(getCollectionName('groups')).add(groupData);

    // Add owner as member in subcollection
    await db
      .collection(getCollectionName('groups'))
      .doc(docRef.id)
      .collection('members')
      .doc(userId)
      .set({
        userId,
        username,
        role: 'owner',
        joinedAt: now,
      });

    return createApiResponse({ id: docRef.id, ...groupData }, null, 201);
  } catch (error: any) {
    console.error('[Groups API] POST error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}

/**
 * GET /api/groups - List current user's groups
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    if (!(await isGroupsEnabled(userId))) {
      return createErrorResponse('FEATURE_DISABLED', 'Groups feature is not enabled');
    }

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const snap = await db
      .collection(getCollectionName('groups'))
      .where('memberIds', 'array-contains', userId)
      .where('deleted', '!=', true)
      .orderBy('updatedAt', 'desc')
      .get();

    const groups = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return createApiResponse({ groups });
  } catch (error: any) {
    console.error('[Groups API] GET error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}
