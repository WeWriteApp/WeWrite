import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * GET /api/groups/invitations - Get pending invitations for current user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const snap = await db
      .collection(getCollectionName('groupInvitations'))
      .where('inviteeId', '==', userId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    const invitations = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return createApiResponse({ invitations });
  } catch (error: any) {
    console.error('[Groups API] GET invitations error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}

/**
 * PATCH /api/groups/invitations - Accept or decline an invitation
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    const body = await request.json();
    const { invitationId, action } = body;

    if (!invitationId || !['accept', 'decline'].includes(action)) {
      return createErrorResponse('BAD_REQUEST', 'invitationId and action (accept/decline) are required');
    }

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const inviteRef = db.collection(getCollectionName('groupInvitations')).doc(invitationId);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return createErrorResponse('NOT_FOUND', 'Invitation not found');
    }

    const invitation = inviteSnap.data()!;

    // Verify the invitation belongs to this user
    if (invitation.inviteeId !== userId) {
      return createErrorResponse('FORBIDDEN', 'This invitation is not for you');
    }

    if (invitation.status !== 'pending') {
      return createErrorResponse('BAD_REQUEST', 'Invitation has already been processed');
    }

    const now = new Date().toISOString();
    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    await inviteRef.update({
      status: newStatus,
      updatedAt: now,
    });

    // If accepted, add user to the group
    if (action === 'accept') {
      const groupRef = db.collection(getCollectionName('groups')).doc(invitation.groupId);
      const groupSnap = await groupRef.get();

      if (groupSnap.exists && !groupSnap.data()?.deleted) {
        const groupData = groupSnap.data()!;

        // Get user info
        const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
        const username = userDoc.exists ? userDoc.data()?.username || '' : '';

        // Add to members subcollection
        await groupRef.collection('members').doc(userId).set({
          userId,
          username,
          role: 'member',
          joinedAt: now,
        });

        // Update memberIds and count
        const newMemberIds = [...(groupData.memberIds || []), userId];
        await groupRef.update({
          memberIds: newMemberIds,
          memberCount: newMemberIds.length,
          updatedAt: now,
        });
      }
    }

    return createApiResponse({ invitationId, status: newStatus });
  } catch (error: any) {
    console.error('[Groups API] PATCH invitations error:', error);
    return createErrorResponse('INTERNAL_ERROR', error?.message);
  }
}
