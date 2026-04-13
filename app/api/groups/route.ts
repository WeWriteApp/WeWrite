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
 * GET /api/groups - List current user's groups, or discover public groups
 * Query params:
 *   - userId: fetch another user's public groups
 *   - discover: if "true", fetch all public groups (for group discovery)
 */
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) return createErrorResponse('UNAUTHORIZED');

    if (!(await isGroupsEnabled(currentUserId))) {
      return createErrorResponse('FEATURE_DISABLED', 'Groups feature is not enabled');
    }

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const url = new URL(request.url);
    const discover = url.searchParams.get('discover') === 'true';
    const targetUserId = url.searchParams.get('userId') || currentUserId;
    const publicOnly = targetUserId !== currentUserId;

    let groups: any[] = [];

    if (discover) {
      // Discovery mode: fetch all public, non-deleted groups
      try {
        const snap = await db
          .collection(getCollectionName('groups'))
          .where('visibility', '==', 'public')
          .where('deleted', '!=', true)
          .orderBy('updatedAt', 'desc')
          .limit(100)
          .get();

        groups = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (indexError: any) {
        // Fallback if composite index missing
        if (indexError?.code === 9 || indexError?.message?.includes('index')) {
          const snap = await db
            .collection(getCollectionName('groups'))
            .where('visibility', '==', 'public')
            .get();

          groups = snap.docs
            .filter((doc) => doc.data().deleted !== true)
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        } else {
          throw indexError;
        }
      }
    } else {
      try {
        let q = db
          .collection(getCollectionName('groups'))
          .where('memberIds', 'array-contains', targetUserId);

        // When viewing another user's groups, only return public ones
        if (publicOnly) {
          q = q.where('visibility', '==', 'public');
        }

        q = q.where('deleted', '!=', true).orderBy('updatedAt', 'desc');

        const snap = await q.get();

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
            .where('memberIds', 'array-contains', targetUserId)
            .get();

          groups = snap.docs
            .filter((doc) => {
              const data = doc.data();
              if (data.deleted === true) return false;
              if (publicOnly && data.visibility !== 'public') return false;
              return true;
            })
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        } else {
          throw indexError;
        }
      }
    }

    return createApiResponse({ groups });
  } catch (error: any) {
    console.error('[Groups API] GET error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}
