import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';

/**
 * POST /api/groups/[id]/keys - Store a wrapped group key for a member
 * Body: { targetUserId, encryptedGroupKey, keyVersion }
 * Called by the inviter's client after wrapping the group key with the new member's public key.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    // Verify the caller is a member
    const groupDoc = await db.collection(getCollectionName('groups')).doc(groupId).get();
    if (!groupDoc.exists || groupDoc.data()?.deleted) {
      return createErrorResponse('NOT_FOUND', 'Group not found');
    }

    const memberIds: string[] = groupDoc.data()?.memberIds || [];
    if (!memberIds.includes(userId)) {
      return createErrorResponse('FORBIDDEN', 'Not a group member');
    }

    const body = await request.json();
    const { targetUserId, encryptedGroupKey, keyVersion } = body;

    if (!targetUserId || !encryptedGroupKey || keyVersion === undefined) {
      return createErrorResponse('BAD_REQUEST', 'Missing required fields');
    }

    // Target must also be a member
    if (!memberIds.includes(targetUserId)) {
      return createErrorResponse('BAD_REQUEST', 'Target user is not a group member');
    }

    await db
      .collection(getCollectionName('groups'))
      .doc(groupId)
      .collection('keys')
      .doc(targetUserId)
      .set({
        encryptedGroupKey,
        keyVersion,
        grantedBy: userId,
        createdAt: new Date().toISOString(),
      });

    return createApiResponse({ stored: true });
  } catch (error) {
    console.error('[API] POST /api/groups/[id]/keys error:', error);
    return createErrorResponse('INTERNAL_ERROR');
  }
}

/**
 * GET /api/groups/[id]/keys - Get own wrapped group key
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    // Verify membership
    const groupDoc = await db.collection(getCollectionName('groups')).doc(groupId).get();
    if (!groupDoc.exists || groupDoc.data()?.deleted) {
      return createErrorResponse('NOT_FOUND', 'Group not found');
    }

    const memberIds: string[] = groupDoc.data()?.memberIds || [];
    if (!memberIds.includes(userId)) {
      return createErrorResponse('FORBIDDEN', 'Not a group member');
    }

    const keyDoc = await db
      .collection(getCollectionName('groups'))
      .doc(groupId)
      .collection('keys')
      .doc(userId)
      .get();

    if (!keyDoc.exists) {
      return createApiResponse({ hasKey: false });
    }

    return createApiResponse({
      hasKey: true,
      ...keyDoc.data(),
    });
  } catch (error) {
    console.error('[API] GET /api/groups/[id]/keys error:', error);
    return createErrorResponse('INTERNAL_ERROR');
  }
}
