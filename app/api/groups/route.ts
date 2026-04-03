import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import { isGroupsEnabled, groupsDisabledResponse } from './featureFlagCheck';

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

    let groups: any[] = [];
    try {
      const snap = await db
        .collection(getCollectionName('groups'))
        .where('memberIds', 'array-contains', userId)
        .where('deleted', '!=', true)
        .orderBy('updatedAt', 'desc')
        .get();

      groups = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (indexError: any) {
      // Composite index may not exist yet - fall back to simpler query
      if (indexError?.code === 9 || indexError?.message?.includes('index')) {
        console.warn('[Groups API] Missing composite index for groups, falling back to simple query');
        const snap = await db
          .collection(getCollectionName('groups'))
          .where('memberIds', 'array-contains', userId)
          .get();

        groups = snap.docs
          .filter((doc) => doc.data().deleted !== true)
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      } else {
        throw indexError;
      }
    }

    return createApiResponse({ groups });
  } catch (error: any) {
    console.error('[Groups API] GET error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}
